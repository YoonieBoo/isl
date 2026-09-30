"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";
import { parseDatasetFile } from "@/lib/dataset-parsing";
import { suggestColumns } from "@/lib/dataset-column-detection";
import { normalizeStudentId } from "@/lib/student-id";

export type FormState = { error: string } | undefined;

function stripExtension(fileName: string): string {
  return fileName.replace(/\.(csv|xlsx)$/i, "");
}

// Supabase Storage rejects object keys containing characters outside
// [A-Za-z0-9._-] (e.g. the em dash real course filenames often use, or
// spaces) — this only affects the storage path, not the dataset's display
// name, which keeps the original file name untouched.
function sanitizeForStorageKey(fileName: string): string {
  return fileName.replace(/[^A-Za-z0-9._-]+/g, "_");
}

// Uploads one dataset from an already-parsed file. Shared by the multi-file
// upload loop below — every file becomes its own dataset (its own name,
// validation, and Analyze-ready rows), same as uploading them one at a time.
async function uploadOneDataset(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  environmentId: string,
  file: File,
) {
  const parsed = await parseDatasetFile(file);
  if (parsed.rows.length === 0) throw new Error("No data rows found in the file.");

  const name = stripExtension(file.name);
  const { idColumn, nameColumn } = suggestColumns(parsed.columns);

  const { data: dataset, error: datasetError } = await supabase
    .from("datasets")
    .insert({
      environment_id: environmentId,
      name,
      original_file_name: file.name,
      storage_reference: "",
      record_count: parsed.rows.length,
      validation_status: "pending",
      validation_summary: { columns: parsed.columns, suggestedIdColumn: idColumn, suggestedNameColumn: nameColumn },
      uploaded_by: userId,
    })
    .select("id")
    .single();

  if (datasetError || !dataset) throw new Error(datasetError?.message ?? "Failed to create dataset record.");

  // From here on, any failure must remove the dataset row we just created —
  // otherwise a mid-upload failure leaves a "dataset" behind that claims a
  // record count but has zero actual rows, which is confusing clutter at
  // best and silently wrong at worst.
  try {
    const storagePath = `${environmentId}/${dataset.id}/${sanitizeForStorageKey(file.name)}`;
    const { error: uploadError } = await supabase.storage
      .from("datasets")
      .upload(storagePath, file, { contentType: file.type || undefined });
    if (uploadError) throw new Error(`"${name}": file upload failed — ${uploadError.message}`);

    await supabase.from("datasets").update({ storage_reference: storagePath }).eq("id", dataset.id);

    const recordsToInsert = parsed.rows.map((row, index) => ({
      dataset_id: dataset.id,
      source_record_id: String(index + 1),
      source_data: row,
      validation_status: "pending" as const,
    }));

    const { error: recordsError } = await supabase.from("dataset_records").insert(recordsToInsert);
    if (recordsError) throw new Error(`"${name}": records failed to save — ${recordsError.message}`);
  } catch (e) {
    await supabase.from("datasets").delete().eq("id", dataset.id);
    throw e;
  }

  await logActivity(supabase, userId, "uploaded", "dataset", dataset.id, `Uploaded dataset "${name}" (${parsed.rows.length} records)`);

  // A confidently-detected ID column (e.g. "Student ID") is enough to
  // validate automatically instead of leaving the dataset sitting there
  // waiting for someone to click through and pick columns by hand — this is
  // what makes "upload, then Analyze" a two-step flow instead of three.
  // Runs via after() rather than inline: validation does one DB round-trip
  // per learner, which for a real multi-hundred-row file (or a multi-file
  // batch) would otherwise make the upload request itself take minutes.
  if (idColumn) {
    after(async () => {
      try {
        await runDatasetValidation(supabase, userId, dataset.id, idColumn, nameColumn ?? null);
      } catch {
        // Leave the dataset "pending" — it's still fully usable from the
        // normal Datasets page, just needs a person to validate it by hand.
      }
    });
  }

  return dataset.id;
}

export async function uploadDatasets(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const environmentId = String(formData.get("environmentId") ?? "").trim();
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);

  if (!environmentId || files.length === 0) {
    return { error: "Environment and at least one CSV/XLSX file are required." };
  }

  const errors: string[] = [];
  let successCount = 0;

  for (const file of files) {
    try {
      await uploadOneDataset(supabase, user.id, environmentId, file);
      successCount += 1;
    } catch (e) {
      errors.push(`${file.name}: ${e instanceof Error ? e.message : "Upload failed."}`);
    }
  }

  if (successCount === 0) {
    return { error: errors.join(" · ") || "All uploads failed." };
  }

  revalidatePath("/datasets");
  revalidatePath(`/learning-environments/${environmentId}`);

  // Only honor an internal path — never redirect somewhere off-site based on
  // form input.
  const returnTo = String(formData.get("returnTo") ?? "").trim();
  const base = returnTo.startsWith("/") ? returnTo : `/datasets?environment=${environmentId}`;
  const separator = base.includes("?") ? "&" : "?";
  const failedParam = errors.length > 0 ? `&failed=${errors.length}` : "";

  if (returnTo.startsWith("/")) revalidatePath(returnTo);
  redirect(`${base}${separator}uploaded=${successCount}${failedParam}`);
}

type ValidationCounts = {
  totalRecords: number;
  missingIds: number;
  duplicateIds: number;
  emptyRecords: number;
  newLearnersCreated: number;
  matchedExistingLearners: number;
};

// Shared by the manual "Run validation" button and by auto-validation right
// after upload (when the ID/name columns were confidently guessed) — same
// matching logic either way, so a dataset validated automatically behaves
// identically to one a person validated by hand.
async function runDatasetValidation(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  datasetId: string,
  idColumn: string,
  nameColumn: string | null,
) {
  const { data: dataset, error: datasetError } = await supabase
    .from("datasets")
    .select("id, name, environment_id, validation_summary")
    .eq("id", datasetId)
    .single();
  if (datasetError || !dataset) throw new Error("Dataset not found.");

  const { data: records, error: recordsError } = await supabase
    .from("dataset_records")
    .select("id, source_data")
    .eq("dataset_id", datasetId);
  if (recordsError || !records) throw new Error("Failed to load dataset records.");

  const counts: ValidationCounts = {
    totalRecords: records.length,
    missingIds: 0,
    duplicateIds: 0,
    emptyRecords: 0,
    newLearnersCreated: 0,
    matchedExistingLearners: 0,
  };

  // A dataset shaped as a Learning Evidence log (one row per evidence item)
  // will legitimately have the same learner ID on many rows — that's not a
  // data problem, it's the expected structure. Flagging every repeat as
  // "Duplicate learner ID" (as an earlier version of this check did) buried
  // genuine repeated-submission issues in noise on real course data (818 of
  // 819 rows flagged in one validation run). A duplicate is now defined as
  // the SAME learner ID with IDENTICAL content across every other column —
  // an actual repeated submission, not just another piece of evidence from
  // the same learner.
  function rowSignature(sourceData: Record<string, string>): string {
    return Object.entries(sourceData)
      .filter(([field]) => field !== idColumn)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([field, value]) => `${field}=${(value ?? "").trim()}`)
      .join("|");
  }

  const rowOccurrences = new Map<string, number>();
  for (const record of records) {
    const sourceData = record.source_data as Record<string, string>;
    const idValue = normalizeStudentId(sourceData[idColumn] ?? "");
    if (idValue) {
      const key = `${idValue}::${rowSignature(sourceData)}`;
      rowOccurrences.set(key, (rowOccurrences.get(key) ?? 0) + 1);
    }
  }

  // Cache learner lookups/creates within this run so repeated IDs across
  // rows don't each trigger their own select + insert round-trip.
  const learnerCache = new Map<string, string>();

  for (const record of records) {
    const sourceData = record.source_data as Record<string, string>;
    const idValue = normalizeStudentId(sourceData[idColumn] ?? "");
    const hasAnyValue = Object.values(sourceData).some((v) => (v ?? "").toString().trim() !== "");

    if (!hasAnyValue) {
      counts.emptyRecords += 1;
      await supabase
        .from("dataset_records")
        .update({ validation_status: "invalid", validation_notes: "Empty record", learner_id: null })
        .eq("id", record.id);
      continue;
    }

    if (!idValue) {
      counts.missingIds += 1;
      await supabase
        .from("dataset_records")
        .update({ validation_status: "invalid", validation_notes: "Missing learner ID", learner_id: null })
        .eq("id", record.id);
      continue;
    }

    const rowKey = `${idValue}::${rowSignature(sourceData)}`;
    const isDuplicate = (rowOccurrences.get(rowKey) ?? 0) > 1;
    if (isDuplicate) counts.duplicateIds += 1;

    let learnerId = learnerCache.get(idValue);
    if (!learnerId) {
      // A multi-file upload validates every file's learner matches
      // concurrently (see the after() call in uploadOneDataset below), so a
      // plain check-then-insert here races: two files can both see "no
      // existing learner" for the same student and each create their own
      // row. The unique index on external_reference makes this upsert
      // atomic — at most one insert ever wins; everyone else falls through
      // to the select and finds the winner's row.
      const displayName = nameColumn ? (sourceData[nameColumn] ?? "").trim() || idValue : idValue;
      const { data: inserted, error: upsertError } = await supabase
        .from("learners")
        .upsert(
          { external_reference: idValue, display_name: displayName },
          { onConflict: "external_reference", ignoreDuplicates: true },
        )
        .select("id")
        .maybeSingle();
      if (upsertError) throw new Error(`Failed to create learner for ID "${idValue}": ${upsertError.message}`);

      if (inserted) {
        learnerId = inserted.id;
        counts.newLearnersCreated += 1;
        await supabase.from("learner_profiles").insert({ learner_id: learnerId });
      } else {
        const { data: existingLearner, error: findError } = await supabase
          .from("learners")
          .select("id")
          .eq("external_reference", idValue)
          .single();
        if (findError || !existingLearner) {
          throw new Error(`Failed to find learner for ID "${idValue}" after upsert conflict: ${findError?.message}`);
        }
        learnerId = existingLearner.id;
        counts.matchedExistingLearners += 1;
      }
      learnerCache.set(idValue, learnerId);

      await supabase
        .from("learner_environments")
        .upsert(
          { learner_id: learnerId, environment_id: dataset.environment_id },
          { onConflict: "learner_id,environment_id", ignoreDuplicates: true },
        );
    }

    await supabase
      .from("dataset_records")
      .update({
        validation_status: isDuplicate ? "valid_with_warnings" : "valid",
        validation_notes: isDuplicate ? "Duplicate submission — identical to another row for this learner" : null,
        learner_id: learnerId,
      })
      .eq("id", record.id);
  }

  const overallStatus =
    counts.missingIds > 0 || counts.emptyRecords > 0
      ? "invalid"
      : counts.duplicateIds > 0
        ? "valid_with_warnings"
        : "valid";

  const previousSummary = (dataset.validation_summary as Record<string, unknown>) ?? {};

  await supabase
    .from("datasets")
    .update({
      validation_status: overallStatus,
      validation_summary: { ...previousSummary, idColumn, nameColumn, ...counts },
    })
    .eq("id", datasetId);

  await logActivity(
    supabase,
    userId,
    "validated",
    "dataset",
    datasetId,
    `Validated dataset "${dataset.name}" — ${counts.matchedExistingLearners} matched, ${counts.newLearnersCreated} new learners created`,
  );

  revalidatePath(`/datasets/${datasetId}`);
  revalidatePath("/learners");
}

export async function validateDataset(
  datasetId: string,
  idColumn: string,
  nameColumn: string | null,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  await runDatasetValidation(supabase, user.id, datasetId, idColumn, nameColumn);
}
