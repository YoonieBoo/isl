"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";
import { processRunRecords } from "@/lib/processing/run-records";
import { autoUpdateEnvironmentInsight } from "@/lib/insight-evidence";

export async function executeProcessingRun(runId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { data: run, error: runError } = await supabase
    .from("processing_runs")
    .select("*")
    .eq("id", runId)
    .single();
  if (runError || !run) throw new Error("Processing run not found.");
  if (run.status !== "queued") throw new Error("Run must be confirmed (queued) before it can execute.");

  const { error: startError } = await supabase
    .from("processing_runs")
    .update({ status: "running", started_at: new Date().toISOString() })
    .eq("id", runId)
    .eq("status", "queued");
  if (startError) throw new Error(startError.message);

  await logActivity(supabase, user.id, "started", "processing_run", runId, "Started processing run execution");
  revalidatePath(`/processing-runs/${runId}`);

  // The per-record loop can take longer than a typical request/response
  // cycle (one adapter call per record), so it runs via after() — the
  // client gets an immediate "running" status, and the run detail page
  // polls for progress/completion.
  after(async () => {
    const { total, processed, successCount, warningCount, failedCount, skippedCount } = await processRunRecords(supabase, run);

    // Phase 8: group this run's signals into candidate patterns per
    // learner. Deliberately shallow (spec §5.2 says advanced pattern
    // detection can remain manual/external for the MVP) — one candidate
    // pattern per learner per dominant signal type, and explicitly
    // 'needs_more_evidence' rather than forced when evidence is thin.
    const { data: runSignals } = await supabase
      .from("learner_signals")
      .select("learner_id, signal_type, id, processing_result_id, processing_results!inner(processing_run_id)")
      .eq("processing_results.processing_run_id", runId);

    const byLearner = new Map<string, Map<string, string[]>>();
    for (const s of runSignals ?? []) {
      if (!s.learner_id) continue;
      const byType = byLearner.get(s.learner_id) ?? new Map<string, string[]>();
      byType.set(s.signal_type, [...(byType.get(s.signal_type) ?? []), s.id]);
      byLearner.set(s.learner_id, byType);
    }

    const patternsToInsert = [];
    for (const [learnerId, byType] of byLearner) {
      const [topType, topIds] =
        [...byType.entries()].sort((a, b) => b[1].length - a[1].length)[0] ?? [];
      if (!topType) continue;

      const hasEnoughEvidence = topIds.length >= 2;
      patternsToInsert.push({
        processing_run_id: runId,
        learner_id: learnerId,
        pattern_type: topType,
        title: `Recurring ${topType.replace(/_/g, " ")} signal`,
        description: `${topIds.length} signal(s) of type "${topType}" observed in this run.`,
        supporting_signal_ids: topIds,
        assignment_status: (hasEnoughEvidence ? "candidate" : "needs_more_evidence") as
          | "candidate"
          | "needs_more_evidence",
        reason_for_assignment: hasEnoughEvidence
          ? `${topIds.length} independent signals of the same type in this run.`
          : null,
        reason_for_uncertainty: hasEnoughEvidence
          ? null
          : "Only one supporting signal — insufficient to treat as a stable pattern yet.",
      });
    }

    if (patternsToInsert.length > 0) {
      await supabase.from("learner_patterns").insert(patternsToInsert);
    }

    const finalStatus =
      total === 0
        ? "failed"
        : failedCount === total
          ? "failed"
          : failedCount > 0 || warningCount > 0 || skippedCount > 0
            ? "completed_with_warning"
            : "completed";

    await supabase
      .from("processing_runs")
      .update({
        status: finalStatus,
        completed_at: new Date().toISOString(),
        processing_configuration: {
          ...(run.processing_configuration as object),
          progress: { processed, total, successCount, warningCount, failedCount, skippedCount },
        },
      })
      .eq("id", runId);

    await logActivity(
      supabase,
      user.id,
      "completed",
      "processing_run",
      runId,
      `Processing run finished: ${finalStatus} (${successCount} success, ${warningCount} warning, ${failedCount} failed of ${total})`,
    );

    // Instructor-requested change: an on-demand single-learner Analyze run
    // now auto-drafts *and* auto-approves that learner's insight for this
    // environment immediately, without waiting for human review — see
    // autoUpdateEnvironmentInsight for the tradeoff this makes.
    // Whole-class batch runs do the same for every learner they produced
    // signals for — otherwise those learners have evidence but an empty
    // profile until someone clicks Analyze on each of them individually.
    if (finalStatus === "completed" || finalStatus === "completed_with_warning") {
      const learnerIds = run.learner_id ? [run.learner_id] : [...byLearner.keys()];
      // Each update includes one AI skill-rating call, so a whole class is
      // done a few learners at a time rather than strictly one by one.
      const queue = [...learnerIds];
      const worker = async () => {
        for (let learnerId = queue.shift(); learnerId; learnerId = queue.shift()) {
          await autoUpdateEnvironmentInsight(supabase, learnerId, run.environment_id);
          await logActivity(
            supabase,
            user.id,
            "approved",
            "learner_insight",
            learnerId,
            "Auto-generated insight from Analyze (not human-reviewed)",
          );
          revalidatePath(`/profiles/${learnerId}`);
          revalidatePath(`/learners/${learnerId}`);
        }
      };
      await Promise.all(Array.from({ length: Math.min(5, queue.length) }, worker));
    }

    revalidatePath(`/processing-runs/${runId}`);
    revalidatePath("/processing-runs");
  });
}
