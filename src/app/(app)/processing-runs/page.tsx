import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, EmptyState, PageHeader, PrimaryButton } from "@/components/ui";
import { PlayCircleIcon } from "@/components/icons";

const STATUS_TONE = {
  draft: "neutral",
  queued: "blue",
  running: "blue",
  completed: "success",
  completed_with_warning: "warning",
  failed: "danger",
  cancelled: "neutral",
} as const;

export default async function ProcessingRunsPage({
  searchParams,
}: PageProps<"/processing-runs">) {
  const { environment } = await searchParams;
  const environmentId = typeof environment === "string" ? environment : undefined;

  const supabase = await createClient();
  let query = supabase
    .from("processing_runs")
    .select("id, status, ai_source, created_at, learner_id, learning_environments(name), datasets(name), learners(display_name)")
    .order("created_at", { ascending: false });

  if (environmentId) query = query.eq("environment_id", environmentId);

  const { data: runs, error } = await query;

  const newHref = environmentId
    ? `/processing-runs/new?environment=${environmentId}`
    : "/processing-runs/new";

  return (
    <div>
      <PageHeader
        title="Processing Runs"
        icon={PlayCircleIcon}
        iconClassName="bg-violet-50 text-violet-600"
        description="SmartDiscovery / AI processing runs, their configuration, and status."
        action={
          <Link href={newHref}>
            <PrimaryButton>New processing run</PrimaryButton>
          </Link>
        }
      />

      <div className="mt-6">
        {error && <p className="text-sm text-danger">{error.message}</p>}

        {!error && runs && runs.length === 0 && (
          <EmptyState
            title="No processing runs yet"
            description="Create a run against a validated dataset to start extracting learner signals."
            action={
              <Link href={newHref}>
                <PrimaryButton>New processing run</PrimaryButton>
              </Link>
            }
          />
        )}

        {runs && runs.length > 0 && (
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
                  <th className="px-5 py-3">Environment</th>
                  <th className="px-5 py-3">Dataset / Learner</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id} className="border-b border-border last:border-0">
                    <td className="px-5 py-3">
                      <Link href={`/processing-runs/${run.id}`} className="font-medium text-isl-blue hover:underline">
                        {run.learning_environments?.name ?? "—"}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-foreground-muted">
                      {run.learner_id ? `Learner: ${run.learners?.display_name ?? "—"}` : (run.datasets?.name ?? "—")}
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={STATUS_TONE[run.status]}>{run.status.replace(/_/g, " ")}</Badge>
                    </td>
                    <td className="px-5 py-3 text-foreground-muted">
                      {new Date(run.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </div>
  );
}
