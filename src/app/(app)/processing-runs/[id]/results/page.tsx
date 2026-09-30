import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { aiSourceLabel } from "@/lib/processing/ai-source-labels";

const RESULT_TONE = {
  success: "success",
  warning: "warning",
  failed: "danger",
  skipped: "neutral",
} as const;

const SIGNAL_TONE = {
  strength: "success",
  need: "warning",
  concern: "danger",
  preference: "blue",
  activity_behaviour: "neutral",
} as const;

const REVIEW_TONE = {
  agree: "success",
  revise: "blue",
  reject: "danger",
  unsure: "warning",
  needs_more_evidence: "warning",
  request_rerun: "neutral",
} as const;

const PATTERN_TONE = {
  candidate: "blue",
  confirmed: "success",
  unassigned: "neutral",
  needs_more_evidence: "warning",
} as const;

const INSIGHT_TONE = {
  candidate: "blue",
  under_review: "warning",
  revised: "warning",
  approved: "success",
  rejected: "danger",
} as const;

export default async function ProcessingRunResultsPage({
  params,
}: PageProps<"/processing-runs/[id]/results">) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: run, error } = await supabase
    .from("processing_runs")
    .select(
      "id, ai_source, model_or_tool, processing_context, learner_id, learning_environments(name), datasets(name), learners(display_name)",
    )
    .eq("id", id)
    .single();
  if (error || !run) notFound();

  // Only worth showing per-signal when a run actually reads from more than
  // one evidence field — otherwise it's the same value repeated on every
  // card with nothing to distinguish, just noise.
  const evidenceFieldCount = String(
    (run.processing_context as { evidenceFields?: string } | null)?.evidenceFields ?? "",
  )
    .split(",")
    .map((f) => f.trim())
    .filter(Boolean).length;
  const showSourceField = evidenceFieldCount > 1;

  const [{ data: results }, { data: patterns }, { data: insights }] = await Promise.all([
    supabase
      .from("processing_results")
      .select(
        "id, status, warning, error, learners(id, display_name), learner_signals(id, signal_type, label, evidence_text, source_field, interpretation_note), reviews(decision, reviewed_at)",
      )
      .eq("processing_run_id", id)
      .order("created_at"),
    supabase.from("learner_patterns").select("learner_id, assignment_status").eq("processing_run_id", id),
    supabase.from("learner_insights").select("learner_id, status").eq("processing_run_id", id),
  ]);

  const patternByLearner = new Map((patterns ?? []).map((p) => [p.learner_id, p.assignment_status]));
  const insightByLearner = new Map((insights ?? []).map((i) => [i.learner_id, i.status]));

  return (
    <div>
      <PageHeader
        title="Learner Output"
        description={
          <>
            <span className="block">{run.learning_environments?.name ?? ""}</span>
            <span className="block">
              {run.learner_id ? `Learner: ${run.learners?.display_name ?? "—"}` : (run.datasets?.name ?? "")}
            </span>
            <span className="block">
              via {aiSourceLabel(run.ai_source)}
              {run.model_or_tool ? ` (${run.model_or_tool})` : ""}
            </span>
          </>
        }
      />

      <div className="mt-6 space-y-4">
        {(!results || results.length === 0) && (
          <EmptyState title="No results yet" description="This run hasn't produced any output." />
        )}

        {results?.map((result) => {
          const latestReview = [...result.reviews].sort(
            (a, b) => new Date(b.reviewed_at).getTime() - new Date(a.reviewed_at).getTime(),
          )[0];
          const patternStatus = result.learners?.id ? patternByLearner.get(result.learners.id) : undefined;
          const insightStatus = result.learners?.id ? insightByLearner.get(result.learners.id) : undefined;

          return (
            <Card key={result.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-foreground">
                    {result.learners?.display_name ?? "Unknown learner"}
                  </p>
                  {result.learners?.id && (
                    <Link
                      href={`/learners/${result.learners.id}`}
                      className="text-xs text-isl-blue hover:underline"
                    >
                      View learner profile
                    </Link>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={RESULT_TONE[result.status]}>output: {result.status}</Badge>
                  <Badge tone={patternStatus ? PATTERN_TONE[patternStatus] : "neutral"}>
                    pattern: {patternStatus ? patternStatus.replace(/_/g, " ") : "none"}
                  </Badge>
                  <Badge tone={insightStatus ? INSIGHT_TONE[insightStatus] : "neutral"}>
                    insight: {insightStatus ? insightStatus.replace(/_/g, " ") : "none"}
                  </Badge>
                  <Badge tone={latestReview ? REVIEW_TONE[latestReview.decision] : "neutral"}>
                    review: {latestReview ? latestReview.decision.replace(/_/g, " ") : "not reviewed"}
                  </Badge>
                </div>
              </div>

              {result.warning && (
                <p className="mt-2 text-sm text-warning">⚠ {result.warning}</p>
              )}
              {result.error && <p className="mt-2 text-sm text-danger">✕ {result.error}</p>}

              {result.learner_signals.length > 0 && (
                <div className="mt-4 space-y-3 border-t border-border pt-4">
                  {result.learner_signals.map((signal) => (
                    <div key={signal.id} className="rounded-lg bg-surface-pale p-3">
                      <div className="flex items-center gap-2">
                        <Badge tone={SIGNAL_TONE[signal.signal_type]}>
                          {signal.signal_type.replace(/_/g, " ")}
                        </Badge>
                        <span className="text-sm font-medium text-foreground">{signal.label}</span>
                      </div>
                      <p className="mt-1.5 text-sm text-foreground-muted">
                        &ldquo;{signal.evidence_text}&rdquo;
                      </p>
                      {showSourceField && signal.source_field && (
                        <p className="mt-1 text-xs text-foreground-muted">
                          <span className="font-medium uppercase tracking-wide">Source field:</span> {signal.source_field}
                        </p>
                      )}
                      {signal.interpretation_note && (
                        <p className="mt-1 text-xs text-foreground-muted italic">
                          {signal.interpretation_note}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-3">
                {latestReview ? (
                  <Link href={`/reviews/${result.id}`} className="text-sm font-medium text-isl-blue hover:underline">
                    View review →
                  </Link>
                ) : (
                  result.status !== "failed" && (
                    <Link href={`/reviews/${result.id}`} className="text-sm font-medium text-isl-blue hover:underline">
                      Review this output →
                    </Link>
                  )
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
