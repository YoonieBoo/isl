import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { LightBulbIcon } from "@/components/icons";

const STATUS_TONE = {
  candidate: "blue",
  under_review: "warning",
  revised: "warning",
  approved: "success",
  rejected: "danger",
} as const;

export default async function InsightsPage({
  searchParams,
}: PageProps<"/insights">) {
  const { learner, environment } = await searchParams;
  const learnerId = typeof learner === "string" ? learner : undefined;
  const environmentId = typeof environment === "string" ? environment : undefined;

  const supabase = await createClient();
  let query = supabase
    .from("learner_insights")
    .select("id, title, status, created_at, learners(display_name), learning_environments(name)")
    .order("created_at", { ascending: false });

  if (learnerId) query = query.eq("learner_id", learnerId);
  if (environmentId) query = query.eq("environment_id", environmentId);

  const [{ data: insights, error }, { data: environmentRow }] = await Promise.all([
    query,
    environmentId
      ? supabase.from("learning_environments").select("name").eq("id", environmentId).single()
      : Promise.resolve({ data: null }),
  ]);

  const exportParams = new URLSearchParams();
  if (learnerId) exportParams.set("learner", learnerId);
  if (environmentId) exportParams.set("environment", environmentId);
  const exportQuery = exportParams.toString();

  return (
    <div>
      <PageHeader
        title="Insights"
        icon={LightBulbIcon}
        iconClassName="bg-amber-50 text-amber-600"
        description={environmentRow?.name ? `Insights in ${environmentRow.name}.` : undefined}
        action={
          <a
            href={`/api/export/insights${exportQuery ? `?${exportQuery}` : ""}`}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground-muted transition-colors hover:bg-surface-pale hover:text-foreground"
          >
            Export approved insights
          </a>
        }
      />

      <div className="mt-6">
        {error && <p className="text-sm text-danger">{error.message}</p>}

        {!error && insights && insights.length === 0 && (
          <EmptyState
            title="No insights yet"
            description="Create an insight from a reviewed processing result to get started."
          />
        )}

        {insights && insights.length > 0 && (
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
                  <th className="px-5 py-3">Title</th>
                  <th className="px-5 py-3">Learner</th>
                  <th className="px-5 py-3">Environment</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {insights.map((insight) => (
                  <tr key={insight.id} className="border-b border-border last:border-0">
                    <td className="px-5 py-3">
                      <Link href={`/insights/${insight.id}`} className="font-medium text-isl-blue hover:underline">
                        {insight.title}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-foreground-muted">
                      {insight.learners?.display_name ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-foreground-muted">
                      {insight.learning_environments?.name ?? "—"}
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={STATUS_TONE[insight.status]}>{insight.status.replace(/_/g, " ")}</Badge>
                    </td>
                    <td className="px-5 py-3 text-foreground-muted">
                      {new Date(insight.created_at).toLocaleString()}
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
