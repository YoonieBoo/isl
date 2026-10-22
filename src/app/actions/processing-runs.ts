"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";
import { executeProcessingRun } from "@/app/actions/execute-processing-run";
import { resolveCourseRunSettings } from "@/lib/processing/course-settings";

export type FormState = { error: string } | undefined;

export type ProcessingContext = {
  learningObjective: string;
  activityContext: string;
  learnerPopulation: string;
  activityType: string;
  interpretationFocus: string;
  signalCategories: string;
  taxonomyGuidance: string;
  processingNotes: string;
  evidenceFields: string;
};

export async function createProcessingRun(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const environmentId = String(formData.get("environmentId") ?? "").trim();
  const datasetId = String(formData.get("datasetId") ?? "").trim();
  const learnerId = String(formData.get("learnerId") ?? "").trim();
  const aiSource = String(formData.get("aiSource") ?? "external_ai").trim();
  const modelOrTool = String(formData.get("modelOrTool") ?? "").trim();

  if (!environmentId || (!datasetId && !learnerId)) {
    return { error: "Environment and a dataset (or learner) are required." };
  }

  const processingContext: ProcessingContext = {
    learningObjective: String(formData.get("learningObjective") ?? "").trim(),
    activityContext: String(formData.get("activityContext") ?? "").trim(),
    learnerPopulation: String(formData.get("learnerPopulation") ?? "").trim(),
    activityType: String(formData.get("activityType") ?? "").trim(),
    interpretationFocus: String(formData.get("interpretationFocus") ?? "").trim(),
    signalCategories: String(formData.get("signalCategories") ?? "").trim(),
    taxonomyGuidance: String(formData.get("taxonomyGuidance") ?? "").trim(),
    processingNotes: String(formData.get("processingNotes") ?? "").trim(),
    evidenceFields: String(formData.get("evidenceFields") ?? "").trim(),
  };

  if (!processingContext.learningObjective || !processingContext.evidenceFields) {
    return { error: "Learning objective and evidence fields are required." };
  }

  const { data: run, error } = await supabase
    .from("processing_runs")
    .insert({
      environment_id: environmentId,
      dataset_id: datasetId || null,
      learner_id: learnerId || null,
      status: "draft",
      processing_context: processingContext,
      processing_configuration: {},
      ai_source: aiSource as "smartdiscovery" | "external_ai" | "manual" | "mock",
      model_or_tool: modelOrTool || null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !run) {
    return { error: error?.message ?? "Failed to create processing run." };
  }

  await logActivity(
    supabase,
    user.id,
    "created",
    "processing_run",
    run.id,
    "Created processing run (draft)",
  );

  revalidatePath("/processing-runs");
  redirect(`/processing-runs/${run.id}`);
}

export async function confirmProcessingRun(runId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { error } = await supabase
    .from("processing_runs")
    .update({ status: "queued" })
    .eq("id", runId)
    .eq("status", "draft");

  if (error) throw new Error(error.message);

  await logActivity(
    supabase,
    user.id,
    "confirmed",
    "processing_run",
    runId,
    "Confirmed processing run configuration — queued for execution",
  );

  revalidatePath(`/processing-runs/${runId}`);
}

// On-demand, single-learner analysis: reuse the most recent run's
// processing context/adapter for this environment (proven interpretation
// guidance) instead of asking the user to refill the full context form
// every time. Falls back to the manual form when no prior run exists yet.
export async function createLearnerAnalysisRun(learnerId: string, environmentId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  // Reuses the course's last finished run settings, or fills in sensible
  // defaults for a brand-new course — never the technical setup form.
  const priorRun = await resolveCourseRunSettings(supabase, environmentId);

  const { data: run, error } = await supabase
    .from("processing_runs")
    .insert({
      environment_id: environmentId,
      dataset_id: null,
      learner_id: learnerId,
      // Settings come from the course itself (see resolveCourseRunSettings),
      // so there is nothing to confirm — the run starts straight away
      // instead of stopping at the draft/confirm screens.
      status: "queued",
      processing_context: priorRun.processing_context,
      processing_configuration: {},
      ai_source: priorRun.ai_source,
      model_or_tool: priorRun.model_or_tool,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !run) throw new Error(error?.message ?? "Failed to create analysis run.");

  await logActivity(
    supabase,
    user.id,
    "created",
    "processing_run",
    run.id,
    "Started single-learner analysis",
  );

  // Runs in the background (after()); the learner's insights page shows an
  // "Updating insights…" message and refreshes itself until it finishes.
  await executeProcessingRun(run.id);

  revalidatePath("/processing-runs");
  redirect(`/profiles/${learnerId}?environment=${environmentId}&updating=${run.id}`);
}
