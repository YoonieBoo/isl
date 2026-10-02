import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { getSkillFramework, readSkillRatings } from "@/lib/skills/frameworks";
import { rateLearnerSkills } from "@/lib/skills/rate-skills";

type Supabase = Awaited<ReturnType<typeof createClient>>;

type CorrectedSignal = { signalType: string; label: string; evidenceText: string; interpretationNote?: string };
export type EvidenceSignal = {
  id: string;
  signal_type: string;
  label: string;
  evidence_text: string;
  interpretation_note?: string | null;
};

export type InsightDraftSource = {
  learnerId: string;
  learnerName: string;
  environmentId: string;
  processingRunId: string;
  signals: EvidenceSignal[];
  evidenceItemCount: number;
  correctedCount: number;
};

// Shared by the manual "New Learner Insight" form and the one-click
// draft-and-approve action — every reviewed (agree/revise) result for this
// learner in this processing run contributes its evidence, using the
// reviewer's correction when one exists rather than the original AI signal.
export async function gatherReviewedSignals(
  supabase: Supabase,
  resultId: string,
): Promise<InsightDraftSource | null> {
  const { data: triggerResult, error } = await supabase
    .from("processing_results")
    .select("id, processing_run_id, learner_id, learners(id, display_name), processing_runs(id, environment_id)")
    .eq("id", resultId)
    .single();

  if (error || !triggerResult || !triggerResult.learners || !triggerResult.processing_runs || !triggerResult.learner_id) {
    return null;
  }

  const { data: candidateResults } = await supabase
    .from("processing_results")
    .select("id, learner_signals(id, signal_type, label, evidence_text, interpretation_note)")
    .eq("processing_run_id", triggerResult.processing_run_id)
    .eq("learner_id", triggerResult.learner_id);

  const candidateIds = (candidateResults ?? []).map((r) => r.id);
  const { data: reviews } = candidateIds.length
    ? await supabase
        .from("reviews")
        .select("processing_result_id, decision, corrected_output, reviewed_at")
        .in("processing_result_id", candidateIds)
        .in("decision", ["agree", "revise"])
        .order("reviewed_at", { ascending: false })
    : { data: [] as { processing_result_id: string; decision: string; corrected_output: unknown; reviewed_at: string }[] };

  const latestReviewByResult = new Map<string, { decision: string; corrected_output: unknown }>();
  for (const r of reviews ?? []) {
    if (!latestReviewByResult.has(r.processing_result_id)) {
      latestReviewByResult.set(r.processing_result_id, r);
    }
  }

  let signals: EvidenceSignal[] = [];
  let correctedCount = 0;
  let evidenceItemCount = 0;

  for (const res of candidateResults ?? []) {
    const review = latestReviewByResult.get(res.id);
    if (!review) continue;

    evidenceItemCount += 1;
    const corrected = (review.corrected_output as { signals?: CorrectedSignal[] } | null)?.signals;

    if (review.decision === "revise" && Array.isArray(corrected) && corrected.length > 0) {
      const fallbackId = res.learner_signals[0]?.id ?? res.id;
      signals.push(
        ...corrected.map((s, i) => ({
          id: res.learner_signals[i]?.id ?? fallbackId,
          signal_type: s.signalType,
          label: s.label,
          evidence_text: s.evidenceText,
          interpretation_note: s.interpretationNote ?? res.learner_signals[i]?.interpretation_note ?? null,
        })),
      );
      correctedCount += 1;
    } else {
      signals.push(...res.learner_signals);
    }
  }

  if (evidenceItemCount === 0) {
    const { data: fallback } = await supabase
      .from("processing_results")
      .select("learner_signals(id, signal_type, label, evidence_text, interpretation_note)")
      .eq("id", resultId)
      .single();
    signals = fallback?.learner_signals ?? [];
  }

  return {
    learnerId: triggerResult.learners.id,
    learnerName: triggerResult.learners.display_name,
    environmentId: triggerResult.processing_runs.environment_id,
    processingRunId: triggerResult.processing_runs.id,
    signals,
    evidenceItemCount,
    correctedCount,
  };
}

// learner_insights.environment_id is required (spec §7 scopes an insight to
// one course), but each dataset in a course is its own processing_run — so
// a learner with evidence across many weekly datasets in the same course
// would otherwise get one fragmented insight per dataset instead of one
// coherent per-course picture. This pulls every reviewed (agree/revise)
// result for a learner across every run in one environment, the same way
// gatherReviewedSignals consolidates within a single run.
export async function gatherReviewedSignalsForEnvironment(
  supabase: Supabase,
  learnerId: string,
  environmentId: string,
): Promise<InsightDraftSource | null> {
  const { data: learner } = await supabase.from("learners").select("id, display_name").eq("id", learnerId).single();
  if (!learner) return null;

  const { data: runs } = await supabase
    .from("processing_runs")
    .select("id")
    .eq("environment_id", environmentId);
  const runIds = (runs ?? []).map((r) => r.id);
  if (runIds.length === 0) return { learnerId, learnerName: learner.display_name, environmentId, processingRunId: "", signals: [], evidenceItemCount: 0, correctedCount: 0 };

  const { data: candidateResults } = await supabase
    .from("processing_results")
    .select("id, learner_signals(id, signal_type, label, evidence_text, interpretation_note)")
    .in("processing_run_id", runIds)
    .eq("learner_id", learnerId);

  const candidateIds = (candidateResults ?? []).map((r) => r.id);
  const { data: reviews } = candidateIds.length
    ? await supabase
        .from("reviews")
        .select("processing_result_id, decision, corrected_output, reviewed_at")
        .in("processing_result_id", candidateIds)
        .in("decision", ["agree", "revise"])
        .order("reviewed_at", { ascending: false })
    : { data: [] as { processing_result_id: string; decision: string; corrected_output: unknown; reviewed_at: string }[] };

  const latestReviewByResult = new Map<string, { decision: string; corrected_output: unknown }>();
  for (const r of reviews ?? []) {
    if (!latestReviewByResult.has(r.processing_result_id)) latestReviewByResult.set(r.processing_result_id, r);
  }

  let signals: EvidenceSignal[] = [];
  let correctedCount = 0;
  let evidenceItemCount = 0;

  for (const res of candidateResults ?? []) {
    const review = latestReviewByResult.get(res.id);
    if (!review) continue;

    evidenceItemCount += 1;
    const corrected = (review.corrected_output as { signals?: CorrectedSignal[] } | null)?.signals;

    if (review.decision === "revise" && Array.isArray(corrected) && corrected.length > 0) {
      const fallbackId = res.learner_signals[0]?.id ?? res.id;
      signals.push(
        ...corrected.map((s, i) => ({
          id: res.learner_signals[i]?.id ?? fallbackId,
          signal_type: s.signalType,
          label: s.label,
          evidence_text: s.evidenceText,
          interpretation_note: s.interpretationNote ?? res.learner_signals[i]?.interpretation_note ?? null,
        })),
      );
      correctedCount += 1;
    } else {
      signals.push(...res.learner_signals);
    }
  }

  return {
    learnerId: learner.id,
    learnerName: learner.display_name,
    environmentId,
    processingRunId: "",
    signals,
    evidenceItemCount,
    correctedCount,
  };
}

// Same shape as gatherReviewedSignalsForEnvironment, but does NOT require a
// review to exist — used by autoUpdateEnvironmentInsight below. Still
// respects an explicit human "revise" (uses the correction) or "reject"
// (excludes the item) wherever one already happened; everything else
// (no review yet, agree, unsure, needs_more_evidence, request_rerun) is
// included as the AI originally produced it.
async function gatherAllSignalsForEnvironment(
  supabase: Supabase,
  learnerId: string,
  environmentId: string,
): Promise<InsightDraftSource | null> {
  const { data: learner } = await supabase.from("learners").select("id, display_name").eq("id", learnerId).single();
  if (!learner) return null;

  const { data: runs } = await supabase.from("processing_runs").select("id").eq("environment_id", environmentId);
  const runIds = (runs ?? []).map((r) => r.id);
  if (runIds.length === 0) {
    return { learnerId, learnerName: learner.display_name, environmentId, processingRunId: "", signals: [], evidenceItemCount: 0, correctedCount: 0 };
  }

  const { data: candidateResults } = await supabase
    .from("processing_results")
    .select("id, learner_signals(id, signal_type, label, evidence_text, interpretation_note)")
    .in("processing_run_id", runIds)
    .eq("learner_id", learnerId);

  const candidateIds = (candidateResults ?? []).map((r) => r.id);
  const { data: reviews } = candidateIds.length
    ? await supabase
        .from("reviews")
        .select("processing_result_id, decision, corrected_output, reviewed_at")
        .in("processing_result_id", candidateIds)
        .order("reviewed_at", { ascending: false })
    : { data: [] as { processing_result_id: string; decision: string; corrected_output: unknown; reviewed_at: string }[] };

  const latestReviewByResult = new Map<string, { decision: string; corrected_output: unknown }>();
  for (const r of reviews ?? []) {
    if (!latestReviewByResult.has(r.processing_result_id)) latestReviewByResult.set(r.processing_result_id, r);
  }

  let signals: EvidenceSignal[] = [];
  let correctedCount = 0;
  let evidenceItemCount = 0;

  for (const res of candidateResults ?? []) {
    const review = latestReviewByResult.get(res.id);
    if (review?.decision === "reject") continue;

    evidenceItemCount += 1;
    const corrected = (review?.corrected_output as { signals?: CorrectedSignal[] } | null)?.signals;

    if (review?.decision === "revise" && Array.isArray(corrected) && corrected.length > 0) {
      const fallbackId = res.learner_signals[0]?.id ?? res.id;
      signals.push(
        ...corrected.map((s, i) => ({
          id: res.learner_signals[i]?.id ?? fallbackId,
          signal_type: s.signalType,
          label: s.label,
          evidence_text: s.evidenceText,
          interpretation_note: s.interpretationNote ?? res.learner_signals[i]?.interpretation_note ?? null,
        })),
      );
      correctedCount += 1;
    } else {
      signals.push(...res.learner_signals);
    }
  }

  return {
    learnerId: learner.id,
    learnerName: learner.display_name,
    environmentId,
    processingRunId: "",
    signals,
    evidenceItemCount,
    correctedCount,
  };
}

function groupByTypeForAuto(signals: EvidenceSignal[], type: string): string[] {
  return signals.filter((s) => s.signal_type === type).map((s) => `${s.label}: ${s.evidence_text}`);
}

// The AI model prefaces nearly every interpretation_note with the same
// template phrase ("Current evidence suggests..."), so concatenating raw
// notes into a summary reads as that phrase repeated verbatim 3-4 times.
// This strips just that boilerplate lead-in (not the actual content) so the
// real substance survives instead of getting deleted along with the phrase.
export function buildInsightHighlights(notes: (string | null | undefined)[], max = 3): string {
  const cleaned = notes
    .filter((n): n is string => Boolean(n))
    .slice(0, max)
    .map((note) => {
      const stripped = note.trim().replace(/^current evidence (suggests|indicates|shows)\s*/i, "");
      return stripped.charAt(0).toUpperCase() + stripped.slice(1);
    });
  return cleaned.join(" ");
}

// Auto-drafts and auto-approves a per-environment insight straight from
// Analyze output, with NO human review gate — approved_by is left null so
// every consumer (profile page, exports) can tell this apart from a real
// human-approved insight. This is a deliberate, temporary product decision
// (the review requirement was asked to be removed from the flow "for now")
// that trades the spec's "Human Review Is Required" guarantee for immediate
// visibility; the review system itself (reviews table, /reviews pages, the
// review-all queue) is untouched and still fully usable — this just stops
// gating insight generation on it. Re-running Analyze for the same
// learner+environment updates this same row in place rather than creating a
// new one each time, so it "keeps updating" as more evidence comes in.
export async function autoUpdateEnvironmentInsight(
  supabase: Supabase,
  learnerId: string,
  environmentId: string,
): Promise<void> {
  const source = await gatherAllSignalsForEnvironment(supabase, learnerId, environmentId);
  if (!source) return;

  const { data: env } = await supabase.from("learning_environments").select("name").eq("id", environmentId).single();

  // Fixed per-course skill ratings, rated from the learner's raw answers —
  // what the profile, PDF and class grid show. Free-form signals below are
  // still kept alongside as supporting detail.
  const framework = getSkillFramework(env?.name);
  const skillRatings = framework
    ? await rateLearnerSkills(supabase, learnerId, source.learnerName, environmentId, framework)
    : null;
  if (source.signals.length === 0 && !skillRatings) return;

  const observedStrengths = groupByTypeForAuto(source.signals, "strength");
  const developmentNeeds = groupByTypeForAuto(source.signals, "need");
  const learningPreferences = groupByTypeForAuto(source.signals, "preference");
  const concerns = groupByTypeForAuto(source.signals, "concern");

  const title = `Insight for ${source.learnerName} — ${env?.name ?? "course"}`;
  const countsSentence =
    `Based on ${source.evidenceItemCount} piece${source.evidenceItemCount === 1 ? "" : "s"} of evidence in ${env?.name ?? "this course"}, ` +
    `${source.learnerName} shows ${observedStrengths.length} strength${observedStrengths.length === 1 ? "" : "s"}, ` +
    `${developmentNeeds.length} development need${developmentNeeds.length === 1 ? "" : "s"}, ` +
    `${learningPreferences.length} learning preference${learningPreferences.length === 1 ? "" : "s"}, and ` +
    `${concerns.length} concern${concerns.length === 1 ? "" : "s"}.`;
  const highlights = buildInsightHighlights(source.signals.map((s) => s.interpretation_note));

  const { data: existing } = await supabase
    .from("learner_insights")
    .select("id")
    .eq("learner_id", learnerId)
    .eq("environment_id", environmentId)
    .is("approved_by", null)
    .eq("status", "approved")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // If the rating call failed this time, keep the previously stored ratings
  // rather than wiping them.
  let ratingsToStore = skillRatings;
  if (!ratingsToStore && existing) {
    const { data: previous } = await supabase
      .from("learner_insights")
      .select("approved_output")
      .eq("id", existing.id)
      .single();
    ratingsToStore = readSkillRatings(previous?.approved_output);
  }

  const summary =
    ratingsToStore?.overview || (highlights ? `${countsSentence} ${highlights}` : countsSentence);

  const approvedOutput = {
    title,
    summary,
    observed_strengths: observedStrengths,
    development_needs: developmentNeeds,
    learning_preferences: learningPreferences,
    concerns,
    ...(ratingsToStore ? { skill_ratings: ratingsToStore } : {}),
  };

  const row = {
    learner_id: learnerId,
    environment_id: environmentId,
    processing_run_id: null,
    title,
    summary,
    observed_strengths: observedStrengths,
    development_needs: developmentNeeds,
    learning_preferences: learningPreferences,
    concerns,
    interpretation_boundary: null,
    status: "approved" as const,
    approved_by: null,
    approved_at: new Date().toISOString(),
    approved_output: approvedOutput as never,
  };

  let insightId: string;
  if (existing) {
    await supabase.from("learner_insights").update(row).eq("id", existing.id);
    insightId = existing.id;
    await supabase.from("insight_evidence").delete().eq("learner_insight_id", existing.id);
  } else {
    const { data: inserted } = await supabase.from("learner_insights").insert(row).select("id").single();
    if (!inserted) return;
    insightId = inserted.id;
  }

  const evidenceRows = source.signals
    .map((s) => ({
      learner_insight_id: insightId,
      learner_signal_id: s.id,
      evidence_text: `${s.label}: ${s.evidence_text}`,
    }))
    .filter((r) => r.evidence_text);

  if (evidenceRows.length > 0) {
    await supabase.from("insight_evidence").insert(evidenceRows);
  }
}
