import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, EntityHero, IconCard, PrimaryButton, SecondaryButton, StatCard } from "@/components/ui";
import { ArchiveButton } from "@/app/(app)/learning-environments/[id]/archive-button";
import {
  BookOpenIcon,
  BuildingIcon,
  ClipboardCheckIcon,
  DatabaseIcon,
  LightBulbIcon,
  PencilIcon,
  PlayCircleIcon,
  UserIcon,
} from "@/components/icons";

export default async function LearningEnvironmentDetailPage({
  params,
}: PageProps<"/learning-environments/[id]">) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: env, error }, { count: learnerCount }, { data: datasets }, { data: runs }, { data: insights }] =
    await Promise.all([
      supabase.from("learning_environments").select("*").eq("id", id).single(),
      supabase
        .from("learner_environments")
        .select("id", { count: "exact", head: true })
        .eq("environment_id", id),
      supabase.from("datasets").select("id, record_count").eq("environment_id", id),
      supabase.from("processing_runs").select("id").eq("environment_id", id),
      supabase.from("learner_insights").select("id, status").eq("environment_id", id),
    ]);

  if (error || !env) notFound();

  // Validation coverage funnel (spec: boss feedback asked reporting to
  // distinguish uploaded vs. processed vs. interpreted vs. human-reviewed,
  // rather than one "it's processed" number that hides how much is actually
  // verified). Uses exact head-counts for the per-status breakdown rather
  // than fetching every row — PostgREST caps a single response at 1000 rows,
  // and DDI2332 alone has 1000+ processing_results, so an earlier version of
  // this silently undercounted (and, worse, made "reviewed" read as 0
  // because the truncated row set happened to exclude the reviewed ones).
  const runIds = (runs ?? []).map((r) => r.id);

  async function countResults(status?: "success" | "warning" | "failed") {
    if (runIds.length === 0) return 0;
    let query = supabase.from("processing_results").select("id", { count: "exact", head: true }).in("processing_run_id", runIds);
    if (status) query = query.eq("status", status);
    const { count } = await query;
    return count ?? 0;
  }

  // Paginate id-only fetches (id-only keeps each page cheap) since the
  // 1000-row cap applies to the response, not to how many ids we can later
  // pass into a single .in() filter.
  async function fetchAllNonFailedResultIds(): Promise<string[]> {
    if (runIds.length === 0) return [];
    const ids: string[] = [];
    let from = 0;
    const pageSize = 1000;
    for (;;) {
      const { data } = await supabase
        .from("processing_results")
        .select("id")
        .in("processing_run_id", runIds)
        .neq("status", "failed")
        .range(from, from + pageSize - 1);
      if (!data || data.length === 0) break;
      ids.push(...data.map((d) => d.id));
      if (data.length < pageSize) break;
      from += pageSize;
    }
    return ids;
  }

  const [processed, interpreted, noSignal, failed, nonFailedResultIds] = await Promise.all([
    countResults(),
    countResults("success"),
    countResults("warning"),
    countResults("failed"),
    fetchAllNonFailedResultIds(),
  ]);

  // A single .in() filter with 1000+ UUIDs blows past the request URL
  // length limit (confirmed: DDI2332's 1227 ids returned a 400 Bad Request)
  // — chunk it instead.
  async function countReviewedAmong(ids: string[]): Promise<Set<string>> {
    const reviewed = new Set<string>();
    const chunkSize = 200;
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      const { data } = await supabase.from("reviews").select("processing_result_id").in("processing_result_id", chunk);
      for (const row of data ?? []) reviewed.add(row.processing_result_id);
    }
    return reviewed;
  }

  const reviewedSet = await countReviewedAmong(nonFailedResultIds);

  const uploadedRecords = (datasets ?? []).reduce((sum, d) => sum + (d.record_count ?? 0), 0);
  const coverage = {
    uploaded: uploadedRecords,
    processed,
    interpreted,
    noSignal,
    failed,
    reviewed: reviewedSet.size,
    approvedInsights: (insights ?? []).filter((i) => i.status === "approved").length,
  };

  const relatedIds = [env.id, ...(datasets ?? []).map((d) => d.id), ...(runs ?? []).map((r) => r.id)];
  const { data: recentActivity } = await supabase
    .from("activity_log")
    .select("id, summary, created_at, profiles(display_name)")
    .in("target_id", relatedIds)
    .order("created_at", { ascending: false })
    .limit(8);

  return (
    <div>
      <EntityHero
        avatarIcon={BuildingIcon}
        title={env.name}
        badge={<Badge tone={env.status === "active" ? "success" : "neutral"}>{env.status}</Badge>}
        actions={
          <>
            <Link href={`/learning-environments/${env.id}/edit`}>
              <SecondaryButton className="bg-surface">
                <PencilIcon className="h-4 w-4" />
                Edit
              </SecondaryButton>
            </Link>
            <ArchiveButton id={env.id} name={env.name} status={env.status} />
          </>
        }
      />

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={UserIcon} label="Learners" value={learnerCount ?? 0} href={`/learners?environment=${env.id}`} />
        <StatCard
          icon={LightBulbIcon}
          iconClassName="bg-amber-50 text-amber-600"
          label="Insights"
          value={insights?.length ?? 0}
          href={`/insights?environment=${env.id}`}
        />
        <StatCard
          icon={DatabaseIcon}
          iconClassName="bg-emerald-50 text-emerald-600"
          label="Datasets"
          value={datasets?.length ?? 0}
          href={`/datasets?environment=${env.id}`}
        />
        <StatCard
          icon={PlayCircleIcon}
          iconClassName="bg-violet-50 text-violet-600"
          label="Processing runs"
          value={runs?.length ?? 0}
          href={`/processing-runs?environment=${env.id}`}
        />
      </div>

      <Card className="mt-4">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
            <ClipboardCheckIcon className="h-4 w-4" />
          </span>
          <h2 className="text-sm font-semibold text-foreground">Validation coverage</h2>
        </div>
        <p className="mt-1 text-xs text-foreground-muted">
          How much of this class&apos;s evidence is actually verified, not just processed.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
          <div>
            <p className="text-xl font-semibold text-foreground">{coverage.uploaded}</p>
            <p className="text-xs text-foreground-muted">Uploaded</p>
          </div>
          <div>
            <p className="text-xl font-semibold text-foreground">{coverage.processed}</p>
            <p className="text-xs text-foreground-muted">Processed</p>
          </div>
          <div>
            <p className="text-xl font-semibold text-foreground">{coverage.interpreted}</p>
            <p className="text-xs text-foreground-muted">Interpreted</p>
          </div>
          <div>
            <p className="text-xl font-semibold text-foreground">{coverage.noSignal}</p>
            <p className="text-xs text-foreground-muted">No signal found</p>
          </div>
          <div>
            <p className={`text-xl font-semibold ${coverage.failed > 0 ? "text-danger" : "text-foreground"}`}>
              {coverage.failed}
            </p>
            <p className="text-xs text-foreground-muted">Failed</p>
          </div>
          <div>
            <p className="text-xl font-semibold text-foreground">
              {coverage.reviewed}
              <span className="text-sm font-normal text-foreground-muted"> / {coverage.processed - coverage.failed}</span>
            </p>
            <p className="text-xs text-foreground-muted">Human-reviewed</p>
          </div>
        </div>
        {coverage.processed - coverage.failed > 0 && (
          <p className="mt-4 text-xs text-foreground-muted">
            {coverage.approvedInsights} approved insight{coverage.approvedInsights === 1 ? "" : "s"} so far —{" "}
            {Math.round((coverage.reviewed / (coverage.processed - coverage.failed)) * 100)}% of processed evidence
            (signal or no signal) has been checked by a person.
          </p>
        )}
      </Card>

      <div className="mt-4">
        <IconCard icon={BookOpenIcon} title="Context">
          <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-foreground-muted">Environment type</dt>
              <dd className="mt-1 text-foreground">{env.environment_type}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-foreground-muted">Description</dt>
              <dd className="mt-1 text-foreground">
                {env.description || <span className="text-foreground-muted">—</span>}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-foreground-muted">Learning objectives</dt>
              <dd className="mt-1 text-foreground">
                {env.learning_objectives || <span className="text-foreground-muted">—</span>}
              </dd>
            </div>
          </dl>
        </IconCard>
      </div>

      <Card className="mt-4">
        <h2 className="text-sm font-semibold text-foreground">Recent activity</h2>
        {recentActivity && recentActivity.length > 0 ? (
          <ul className="mt-3 space-y-2 text-sm">
            {recentActivity.map((a) => (
              <li key={a.id} className="flex items-center justify-between text-foreground-muted">
                <span>
                  <span className="font-medium text-foreground">{a.profiles?.display_name ?? "Unknown"}</span>{" "}
                  {a.summary}
                </span>
                <span className="shrink-0 text-xs">{new Date(a.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-foreground-muted">No activity recorded yet.</p>
        )}
      </Card>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link href={`/learners/new?environment=${env.id}`}>
          <PrimaryButton>Add learner</PrimaryButton>
        </Link>
        <Link href={`/datasets/new?environment=${env.id}`}>
          <SecondaryButton>Upload dataset</SecondaryButton>
        </Link>
        <a href={`/api/export/insights?environment=${env.id}`}>
          <SecondaryButton>Export approved insights</SecondaryButton>
        </a>
        <Link href={`/learning-environments/${env.id}/cohort`}>
          <SecondaryButton>Cohort view</SecondaryButton>
        </Link>
      </div>
    </div>
  );
}
