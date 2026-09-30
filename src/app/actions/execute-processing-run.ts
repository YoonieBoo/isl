"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";
import { getProcessingAdapter } from "@/lib/processing";
import type { ProcessingContextInput } from "@/lib/processing/types";
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
      .select("id, learner_id, source_data, datasets!inner(environment_id)")
      .in("validation_status", ["valid", "valid_with_warnings"])
      .not("learner_id", "is", null);

    recordsQuery = run.learner_id
      ? recordsQuery.eq("learner_id", run.learner_id).eq("datasets.environment_id", run.environment_id)
      : recordsQuery.eq("dataset_id", run.dataset_id!);

    const { data: records } = await recordsQuery;

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
        evidenceFields,
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
    // autoUpdateEnvironmentInsight for the tradeoff this makes. Only for
    // learner-scoped runs (not a whole-class batch run against one dataset).
    if (run.learner_id && (finalStatus === "completed" || finalStatus === "completed_with_warning")) {
      await autoUpdateEnvironmentInsight(supabase, run.learner_id, run.environment_id);
      await logActivity(
        supabase,
        user.id,
        "approved",
        "learner_insight",
        run.learner_id,
        "Auto-generated insight from Analyze (not human-reviewed)",
      );
      revalidatePath(`/profiles/${run.learner_id}`);
      revalidatePath(`/learners/${run.learner_id}`);
    }

    revalidatePath(`/processing-runs/${runId}`);
    revalidatePath("/processing-runs");
  });
}
