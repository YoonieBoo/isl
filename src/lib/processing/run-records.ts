import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { getProcessingAdapter } from "@/lib/processing";
import type { ProcessingContextInput } from "@/lib/processing/types";
import { autoEvidenceFields } from "@/lib/answer-fields";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type Run = Database["public"]["Tables"]["processing_runs"]["Row"];

export type RunCounts = {
  total: number;
  processed: number;
  successCount: number;
  warningCount: number;
  failedCount: number;
  skippedCount: number;
};

// Sends each of a run's form responses through the AI and stores the
// results. Shared by the classic run page (in the background) and the
// course's "Update all students" button (one student per request).
// onlyUnprocessed skips responses that already have a result, so updating
// after a new upload only spends AI calls on the new answers.
export async function processRunRecords(
  supabase: Supabase,
  run: Run,
  { onlyUnprocessed = false }: { onlyUnprocessed?: boolean } = {},
): Promise<RunCounts> {
  const runId = run.id;
  const context = run.processing_context as ProcessingContextInput;
  const evidenceFields = String((context as { evidenceFields?: string }).evidenceFields ?? "")
    .split(",")
    .map((f) => f.trim())
    .filter(Boolean);

  const adapter = getProcessingAdapter(run.ai_source, run.model_or_tool);

  // A learner-scoped on-demand run (run.learner_id set, run.dataset_id
  // null) pulls that learner's records from every dataset in this
  // environment rather than one pre-selected dataset.
  let recordsQuery = supabase
    .from("dataset_records")
    .select("id, learner_id, source_data, datasets!inner(environment_id), processing_results(status)")
    .in("validation_status", ["valid", "valid_with_warnings"])
    .not("learner_id", "is", null);

  recordsQuery = run.learner_id
    ? recordsQuery.eq("learner_id", run.learner_id).eq("datasets.environment_id", run.environment_id)
    : recordsQuery.eq("dataset_id", run.dataset_id!);

  const { data: allRecords } = await recordsQuery;
  const records = onlyUnprocessed
    ? (allRecords ?? []).filter(
        (r) => !(r.processing_results ?? []).some((pr) => ["success", "warning", "skipped"].includes(pr.status)),
      )
    : allRecords;

  const total = records?.length ?? 0;
  let processed = 0;
  let successCount = 0;
  let warningCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  // DDI1311_ISL_Data_Guide.xlsx defines evidence_scope specifically to
  // mark rows that are team-level (e.g. a Soft Pitch team score flattened
  // to one row per member) rather than the learner's own individual
  // evidence — "must not automatically be interpreted as individual
  // learner capability." The Q3/2026 validation cycle found real data
  // using this column that was being read as personal evidence anyway
  // because nothing consumed it. Any non-"individual_response" value is
  // excluded here before it ever reaches an adapter.
  for (const record of records ?? []) {
    const sourceData = record.source_data as Record<string, string>;
    const evidenceScope = sourceData["evidence_scope"]?.trim();

    if (evidenceScope && evidenceScope.toLowerCase() !== "individual_response") {
      await supabase.from("processing_results").insert({
        processing_run_id: runId,
        dataset_record_id: record.id,
        learner_id: record.learner_id,
        status: "skipped",
        raw_ai_output: { evidence_scope: evidenceScope } as never,
        structured_output: { signals: [] } as never,
        warning: `Excluded from individual signal extraction — evidence_scope is "${evidenceScope}", not individual_response. This looks like team-level or non-individual evidence and should not be read as this learner's personal capability.`,
        source_type: adapter.sourceType,
        model_or_tool: adapter.modelOrTool,
      });
      skippedCount += 1;
      processed += 1;
      if (processed % 3 === 0 || processed === total) {
        await supabase
          .from("processing_runs")
          .update({
            processing_configuration: {
              ...(run.processing_configuration as object),
              progress: { processed, total, successCount, warningCount, failedCount, skippedCount },
            },
          })
          .eq("id", runId);
      }
      continue;
    }

    const output = await adapter.processRecord({
      sourceData: record.source_data as Record<string, string>,
      // No question list set up for this course -> read every answer column.
      evidenceFields: evidenceFields.length > 0 ? evidenceFields : autoEvidenceFields(record.source_data as Record<string, unknown>),
      context,
    });

    const { data: result, error: resultError } = await supabase
      .from("processing_results")
      .insert({
        processing_run_id: runId,
        dataset_record_id: record.id,
        learner_id: record.learner_id,
        status: output.status,
        raw_ai_output: output.rawOutput as never,
        structured_output: { signals: output.signals } as never,
        warning: output.warning ?? null,
        error: output.error ?? null,
        source_type: adapter.sourceType,
        model_or_tool: adapter.modelOrTool,
      })
      .select("id")
      .single();

    if (resultError || !result) {
      failedCount += 1;
    } else if (output.status === "success") {
      successCount += 1;
      if (output.signals.length > 0 && record.learner_id) {
        await supabase.from("learner_signals").insert(
          output.signals.map((s) => ({
            processing_result_id: result.id,
            learner_id: record.learner_id!,
            signal_type: s.signalType,
            label: s.label,
            normalized_label: s.label.trim().toLowerCase(),
            evidence_text: s.evidenceText,
            source_field: s.sourceField,
            interpretation_note: s.interpretationNote ?? null,
          })),
        );
      }
    } else if (output.status === "warning") {
      warningCount += 1;
    } else {
      failedCount += 1;
    }

    processed += 1;

    if (processed % 3 === 0 || processed === total) {
      await supabase
        .from("processing_runs")
        .update({
          processing_configuration: {
            ...(run.processing_configuration as object),
            progress: { processed, total, successCount, warningCount, failedCount, skippedCount },
          },
        })
        .eq("id", runId);
    }
  }

  return { total, processed, successCount, warningCount, failedCount, skippedCount };
}
