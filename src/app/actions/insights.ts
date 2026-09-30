"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";
import { gatherReviewedSignals, gatherReviewedSignalsForEnvironment, buildInsightHighlights } from "@/lib/insight-evidence";
import type { Database } from "@/lib/supabase/database.types";

export type FormState = { error: string } | undefined;

function splitLines(value: FormDataEntryValue | null): string[] {
  return String(value ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

export async function createLearnerInsight(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const learnerId = String(formData.get("learnerId") ?? "").trim();
  const environmentId = String(formData.get("environmentId") ?? "").trim();
  const processingRunId = String(formData.get("processingRunId") ?? "").trim() || null;
  const title = String(formData.get("title") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim();
  const interpretationBoundary = String(formData.get("interpretationBoundary") ?? "").trim();

  if (!learnerId || !environmentId || !title || !summary) {
    return { error: "Learner, environment, title, and summary are required." };
  }

  const { data: insight, error } = await supabase
    .from("learner_insights")
    .insert({
      learner_id: learnerId,
      environment_id: environmentId,
      processing_run_id: processingRunId,
      title,
      summary,
      observed_strengths: splitLines(formData.get("observedStrengths")),
      development_needs: splitLines(formData.get("developmentNeeds")),
      learning_preferences: splitLines(formData.get("learningPreferences")),
      concerns: splitLines(formData.get("concerns")),
      interpretation_boundary: interpretationBoundary || null,
      status: "candidate",
    })
    .select("id")
    .single();

  if (error || !insight) {
    return { error: error?.message ?? "Failed to create insight." };
  }

  const evidenceIds = formData.getAll("evidenceSignalId") as string[];
  const evidenceTexts = formData.getAll("evidenceText") as string[];
  const evidenceRows = evidenceIds
    .map((signalId, i) => ({
      learner_insight_id: insight.id,
      learner_signal_id: signalId || null,
      evidence_text: evidenceTexts[i] ?? "",
    }))
    .filter((row) => row.evidence_text);

  if (evidenceRows.length > 0) {
    await supabase.from("insight_evidence").insert(evidenceRows);
  }

  await logActivity(
    supabase,
    user.id,
    "created",
    "learner_insight",
    insight.id,
    `Created candidate insight "${title}"`,
  );

  revalidatePath("/insights");
  redirect(`/insights/${insight.id}`);
}

function groupByType(signals: { signal_type: string; label: string; evidence_text: string }[], type: string): string[] {
  return signals.filter((s) => s.signal_type === type).map((s) => `${s.label}: ${s.evidence_text}`);
}

// One click from a reviewed result straight to an approved, profile-visible
// insight — skips the "fill in a form on a separate page, save, navigate to
// another page, click Approve" flow. The real human judgment already
// happened at the review step (Agree/Revise/Reject); this just removes the
// clerical typing in between, since instructors reviewing hundreds of
// results don't have time to hand-author a title/summary for each one.
// Title/summary are generated from the reviewer-corrected signals' own
// (already human-approved-via-review) interpretation notes, never invented.
export async function quickApproveInsight(processingResultId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const source = await gatherReviewedSignals(supabase, processingResultId);
  if (!source) throw new Error("Could not find reviewed evidence for this result.");
  if (source.signals.length === 0) throw new Error("No reviewed signals to draft an insight from.");

  const observedStrengths = groupByType(source.signals, "strength");
  const developmentNeeds = groupByType(source.signals, "need");
  const learningPreferences = groupByType(source.signals, "preference");
  const concerns = groupByType(source.signals, "concern");

  const title = `Insight for ${source.learnerName}`;
  const countsSentence =
    `Based on ${source.signals.length} reviewed signal${source.signals.length === 1 ? "" : "s"}, ` +
    `${source.learnerName} shows ${observedStrengths.length} strength${observedStrengths.length === 1 ? "" : "s"}, ` +
    `${developmentNeeds.length} development need${developmentNeeds.length === 1 ? "" : "s"}, ` +
    `${learningPreferences.length} learning preference${learningPreferences.length === 1 ? "" : "s"}, and ` +
    `${concerns.length} concern${concerns.length === 1 ? "" : "s"}.`;
  const highlights = buildInsightHighlights(source.signals.map((s) => s.interpretation_note));
  const summary = highlights ? `${countsSentence} ${highlights}` : countsSentence;

  const approvedOutput = {
    title,
    summary,
    observed_strengths: observedStrengths,
    development_needs: developmentNeeds,
    learning_preferences: learningPreferences,
    concerns,
  };

  const { data: insight, error } = await supabase
    .from("learner_insights")
    .insert({
      learner_id: source.learnerId,
      environment_id: source.environmentId,
      processing_run_id: source.processingRunId,
      title,
      summary,
      observed_strengths: observedStrengths,
      development_needs: developmentNeeds,
      learning_preferences: learningPreferences,
      concerns,
      interpretation_boundary: "Auto-drafted from reviewed AI signals — not individually hand-written. Verify before relying on it.",
      status: "approved",
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      approved_output: approvedOutput as never,
    })
    .select("id")
    .single();

  if (error || !insight) throw new Error(error?.message ?? "Failed to create insight.");

  const evidenceRows = source.signals
    .map((s) => ({
      learner_insight_id: insight.id,
      learner_signal_id: s.id,
      evidence_text: `${s.label}: ${s.evidence_text}`,
    }))
    .filter((row) => row.evidence_text);

  if (evidenceRows.length > 0) {
    await supabase.from("insight_evidence").insert(evidenceRows);
  }

  await logActivity(supabase, user.id, "created", "learner_insight", insight.id, `Auto-drafted candidate insight "${title}"`);
  await logActivity(supabase, user.id, "approved", "learner_insight", insight.id, `Insight status set to approved`);

  revalidatePath("/insights");
  revalidatePath(`/profiles/${source.learnerId}`);
  redirect(`/insights/${insight.id}`);
}

// Same one-click draft-and-approve as quickApproveInsight, but consolidated
// across every reviewed result for a learner in one course (not just one
// dataset's run) — see gatherReviewedSignalsForEnvironment. A concatenation
// of every interpretation note reads as an unreadable wall of text once a
// learner has dozens of reviewed items, so the summary here picks a
// representative few notes per category instead of all of them.
export async function quickApproveConsolidatedInsight(learnerId: string, environmentId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const source = await gatherReviewedSignalsForEnvironment(supabase, learnerId, environmentId);
  if (!source) throw new Error("Could not find this learner.");
  if (source.signals.length === 0) throw new Error("No reviewed signals to draft an insight from.");

  const { data: env } = await supabase.from("learning_environments").select("name").eq("id", environmentId).single();

  const observedStrengths = groupByType(source.signals, "strength");
  const developmentNeeds = groupByType(source.signals, "need");
  const learningPreferences = groupByType(source.signals, "preference");
  const concerns = groupByType(source.signals, "concern");

  const title = `Insight for ${source.learnerName} — ${env?.name ?? "course"}`;
  const countsSentence =
    `Based on ${source.evidenceItemCount} reviewed piece${source.evidenceItemCount === 1 ? "" : "s"} of evidence in ${env?.name ?? "this course"}, ` +
    `${source.learnerName} shows ${observedStrengths.length} strength${observedStrengths.length === 1 ? "" : "s"}, ` +
    `${developmentNeeds.length} development need${developmentNeeds.length === 1 ? "" : "s"}, ` +
    `${learningPreferences.length} learning preference${learningPreferences.length === 1 ? "" : "s"}, and ` +
    `${concerns.length} concern${concerns.length === 1 ? "" : "s"}.`;
  const highlights = buildInsightHighlights(source.signals.map((s) => s.interpretation_note));
  const summary = highlights ? `${countsSentence} ${highlights}` : countsSentence;

  const approvedOutput = {
    title,
    summary,
    observed_strengths: observedStrengths,
    development_needs: developmentNeeds,
    learning_preferences: learningPreferences,
    concerns,
  };

  const { data: insight, error } = await supabase
    .from("learner_insights")
    .insert({
      learner_id: source.learnerId,
      environment_id: environmentId,
      processing_run_id: null,
      title,
      summary,
      observed_strengths: observedStrengths,
      development_needs: developmentNeeds,
      learning_preferences: learningPreferences,
      concerns,
      interpretation_boundary: `Auto-drafted from ${source.evidenceItemCount} reviewed AI signals across every dataset in this course — not individually hand-written. Verify before relying on it.`,
      status: "approved",
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      approved_output: approvedOutput as never,
    })
    .select("id")
    .single();

  if (error || !insight) throw new Error(error?.message ?? "Failed to create insight.");

  const evidenceRows = source.signals
    .map((s) => ({
      learner_insight_id: insight.id,
      learner_signal_id: s.id,
      evidence_text: `${s.label}: ${s.evidence_text}`,
    }))
    .filter((row) => row.evidence_text);

  if (evidenceRows.length > 0) {
    await supabase.from("insight_evidence").insert(evidenceRows);
  }

  await logActivity(supabase, user.id, "created", "learner_insight", insight.id, `Auto-drafted consolidated candidate insight "${title}"`);
  await logActivity(supabase, user.id, "approved", "learner_insight", insight.id, `Insight status set to approved`);

  revalidatePath("/insights");
  revalidatePath(`/profiles/${source.learnerId}`);
  redirect(`/insights/${insight.id}`);
}

export async function setInsightReviewStatus(
  insightId: string,
  status: "under_review" | "revised" | "approved" | "rejected",
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { data: insight } = await supabase
    .from("learner_insights")
    .select("title, summary, observed_strengths, development_needs, learning_preferences, concerns")
    .eq("id", insightId)
    .single();

  const update: Database["public"]["Tables"]["learner_insights"]["Update"] = { status };
  if (status === "approved") {
    update.approved_by = user.id;
    update.approved_at = new Date().toISOString();
    update.approved_output = (insight ?? {}) as never;
  }

  const { error } = await supabase.from("learner_insights").update(update).eq("id", insightId);
  if (error) throw new Error(error.message);

  await logActivity(
    supabase,
    user.id,
    status,
    "learner_insight",
    insightId,
    `Insight status set to ${status}`,
  );

  revalidatePath("/insights");
  revalidatePath(`/insights/${insightId}`);
}
