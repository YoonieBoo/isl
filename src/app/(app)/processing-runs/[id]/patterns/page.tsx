import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";

const ASSIGNMENT_TONE = {
  candidate: "blue",
  confirmed: "success",
  unassigned: "neutral",
  needs_more_evidence: "warning",
} as const;

export default async function ProcessingRunPatternsPage({
  params,
}: PageProps<"/processing-runs/[id]/patterns">) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: run, error } = await supabase
    .from("processing_runs")
    .select("id, learning_environments(name), datasets(name)")
    .eq("id", id)
    .single();
  if (error || !run) notFound();

  const { data: patterns } = await supabase
    .from("learner_patterns")
    .select(
      "id, pattern_type, title, description, supporting_signal_ids, assignment_status, reason_for_assignment, reason_for_uncertainty, learners(id, display_name)",
    )
    .eq("processing_run_id", id)
    .order("assignment_status");

  const allSignalIds = [...new Set((patterns ?? []).flatMap((p) => p.supporting_signal_ids))];
  const { data: signals } = allSignalIds.length
    ? await supabase.from("learner_signals").select("id, label, evidence_text").in("id", allSignalIds)
    : { data: [] as { id: string; label: string; evidence_text: string }[] };
  const signalById = new Map((signals ?? []).map((s) => [s.id, s]));

  return (
    <div>
      <PageHeader
        title="Candidate Patterns"
        description={`${run.learning_environments?.name ?? ""} — ${run.datasets?.name ?? ""}`}
      />

      <div className="mt-6 space-y-3">
        {(!patterns || patterns.length === 0) && (
          <EmptyState
            title="No candidate patterns"
            description="Not enough signals were extracted in this run to group into patterns."
          />
        )}

        {patterns?.map((p) => (
          <Card key={p.id}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium text-foreground">{p.title}</p>
                {p.learners?.id && (
                  <Link href={`/learners/${p.learners.id}`} className="text-xs text-isl-blue hover:underline">
                    {p.learners.display_name}
                  </Link>
                )}
              </div>
              <Badge tone={ASSIGNMENT_TONE[p.assignment_status]}>
                {p.assignment_status.replace(/_/g, " ")}
              </Badge>
            </div>
            <p className="mt-2 text-sm text-foreground-muted">{p.description}</p>
            {p.reason_for_assignment && (
              <p className="mt-1 text-xs text-foreground-muted">
                Reason: {p.reason_for_assignment}
              </p>
            )}
            {p.reason_for_uncertainty && (
              <p className="mt-1 text-xs text-warning">Uncertainty: {p.reason_for_uncertainty}</p>
            )}
            {p.supporting_signal_ids.length > 0 && (
              <div className="mt-3 space-y-1.5 border-t border-border pt-3">
                {p.supporting_signal_ids.map((signalId) => {
                  const signal = signalById.get(signalId);
                  if (!signal) return null;
                  return (
                    <p key={signalId} className="text-xs text-foreground-muted">
                      &ldquo;{signal.evidence_text}&rdquo;
                    </p>
                  );
                })}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
