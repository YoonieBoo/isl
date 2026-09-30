import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, StatCard } from "@/components/ui";
import { BookOpenIcon, ClipboardCheckIcon, DatabaseIcon, PlayCircleIcon } from "@/components/icons";

export default async function DashboardPage() {
  const supabase = await createClient();

  const [
    { count: environmentCount },
    { count: datasetCount },
    { count: runCount },
    { data: unreviewedResults },
    { data: recentActivity },
  ] = await Promise.all([
    supabase.from("learning_environments").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("datasets").select("id", { count: "exact", head: true }),
    supabase.from("processing_runs").select("id", { count: "exact", head: true }),
    supabase
      .from("processing_results")
      .select("id, reviews(id)")
      .in("status", ["success", "warning"]),
    supabase
      .from("activity_log")
      .select("id, summary, created_at, profiles(display_name)")
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  const pendingReviewCount = (unreviewedResults ?? []).filter((r) => r.reviews.length === 0).length;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
      <p className="mt-1 text-sm text-foreground-muted">
        Learning environments, datasets, processing runs, and review status.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={BookOpenIcon} iconClassName="bg-isl-blue-pale text-isl-blue" label="Active environments" value={environmentCount ?? 0} href="/learning-environments" />
        <StatCard icon={DatabaseIcon} iconClassName="bg-emerald-50 text-emerald-600" label="Datasets" value={datasetCount ?? 0} href="/datasets" />
        <StatCard icon={PlayCircleIcon} iconClassName="bg-violet-50 text-violet-600" label="Processing runs" value={runCount ?? 0} href="/processing-runs" />
        <StatCard icon={ClipboardCheckIcon} iconClassName="bg-amber-50 text-amber-600" label="Awaiting review" value={pendingReviewCount ?? 0} href="/reviews" />
      </div>

      <div className="mt-6">
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Recent activity</h2>
            <Link href="/activity" className="text-sm font-medium text-isl-blue hover:underline">
              View all
            </Link>
          </div>
          {recentActivity && recentActivity.length > 0 ? (
            <ul className="mt-4 divide-y divide-border text-sm">
              {recentActivity.map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <p className="text-foreground">
                    <span className="font-semibold">{a.profiles?.display_name ?? "Unknown"}</span>{" "}
                    <span className="text-foreground-muted">{a.summary}</span>
                  </p>
                  <span className="shrink-0 whitespace-nowrap text-xs text-foreground-muted">
                    {new Date(a.created_at).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-foreground-muted">No activity yet.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
