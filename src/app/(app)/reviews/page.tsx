import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { ClipboardCheckIcon } from "@/components/icons";

const DECISION_TONE = {
  agree: "success",
  revise: "blue",
  reject: "danger",
  unsure: "warning",
  needs_more_evidence: "warning",
  request_rerun: "neutral",
} as const;

export default async function ReviewsPage({
  searchParams,
}: PageProps<"/reviews">) {
  const { run } = await searchParams;
  const runId = typeof run === "string" ? run : undefined;

  const supabase = await createClient();
  let query = supabase
    .from("processing_results")
    .select(
      "id, status, created_at, learners(id, display_name), processing_runs(id, learning_environments(name), datasets(name)), reviews(decision, reviewed_at)",
    )
    .in("status", ["success", "warning"])
    .order("created_at", { ascending: false });

  if (runId) query = query.eq("processing_run_id", runId);

  const { data: results, error } = await query;

  return (
    <div>
      <PageHeader
        title="Reviews"
        icon={ClipboardCheckIcon}
        iconClassName="bg-amber-50 text-amber-600"
        description="Compare SmartDiscovery output against source evidence and record a review decision."
      />

      <div className="mt-6">
        {error && <p className="text-sm text-danger">{error.message}</p>}

        {!error && results && results.length === 0 && (
          <EmptyState
            title="Nothing to review yet"
            description="Run processing on a dataset first — successful and warning results will show up here."
          />
        )}

        {results && results.length > 0 && (
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
                  <th className="px-5 py-3">Learner</th>
                  <th className="px-5 py-3">Environment / Dataset</th>
                  <th className="px-5 py-3">Output status</th>
                  <th className="px-5 py-3">Review</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => {
                  const latestReview = r.reviews[0];
                  return (
                    <tr key={r.id} className="border-b border-border last:border-0">
                      <td className="px-5 py-3">
                        <Link href={`/reviews/${r.id}`} className="font-medium text-isl-blue hover:underline">
                          {r.learners?.display_name ?? "Unknown learner"}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-foreground-muted">
                        {r.processing_runs?.learning_environments?.name} —{" "}
                        {r.processing_runs?.datasets?.name}
                      </td>
                      <td className="px-5 py-3">
                        <Badge tone={r.status === "success" ? "success" : "warning"}>{r.status}</Badge>
                      </td>
                      <td className="px-5 py-3">
                        {latestReview ? (
                          <Badge tone={DECISION_TONE[latestReview.decision]}>
                            {latestReview.decision.replace(/_/g, " ")}
                          </Badge>
                        ) : (
                          <Badge tone="neutral">Not reviewed</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </div>
  );
}
