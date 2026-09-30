import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState, Card } from "@/components/ui";
import { EvidenceHistoryList } from "@/components/evidence-history-list";
import { ArrowLeftIcon, ListIcon } from "@/components/icons";

export default async function LearnerEvidenceHistoryPage({
  params,
}: PageProps<"/learners/[id]/history">) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: learner, error }, { data: history }] = await Promise.all([
    supabase.from("learners").select("display_name").eq("id", id).single(),
    supabase
      .from("dataset_records")
      .select(
        "id, source_data, created_at, datasets(name, learning_environments(name)), processing_results(id)",
      )
      .eq("learner_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (error || !learner) notFound();

  // "Review all" jumps into the same queue flow as /reviews/[resultId]?queue=learner:<id> —
  // it opens the first unreviewed item, and each submit auto-advances to the next one.
  const analyzedResultIds = (history ?? []).flatMap((h) => h.processing_results.map((p) => p.id));
  let reviewAllUrl: string | null = null;
  let unreviewedCount = 0;
  if (analyzedResultIds.length > 0) {
    const [{ data: allResults }, { data: reviews }] = await Promise.all([
      supabase
        .from("processing_results")
        .select("id, created_at")
        .in("id", analyzedResultIds)
        .order("created_at", { ascending: true }),
      supabase.from("reviews").select("processing_result_id").in("processing_result_id", analyzedResultIds),
    ]);
    const reviewedIds = new Set((reviews ?? []).map((r) => r.processing_result_id));
    const unreviewed = (allResults ?? []).filter((r) => !reviewedIds.has(r.id));
    unreviewedCount = unreviewed.length;
    if (unreviewed.length > 0) {
      reviewAllUrl = `/reviews/${unreviewed[0].id}?queue=${encodeURIComponent(`learner:${id}`)}`;
    }
  }

  return (
    <div>
      <Link
        href={`/learners/${id}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-isl-blue hover:underline"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Back to {learner.display_name}
      </Link>

      <div className="mt-4">
        <PageHeader
          title={`Evidence history — ${learner.display_name}`}
          icon={ListIcon}
          iconClassName="bg-sky-50 text-sky-600"
          description={`${history?.length ?? 0} evidence record${history?.length === 1 ? "" : "s"} across every class.`}
          action={
            reviewAllUrl && (
              <Link
                href={reviewAllUrl}
                className="inline-flex items-center gap-1.5 rounded-lg bg-isl-blue px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-isl-blue-dark"
              >
                Review all ({unreviewedCount})
              </Link>
            )
          }
        />
      </div>

      <div className="mt-8">
        {history && history.length > 0 ? (
          <Card className="p-6">
            <EvidenceHistoryList records={history} />
          </Card>
        ) : (
          <EmptyState title="No evidence yet" description="No evidence has been recorded for this learner yet." />
        )}
      </div>
    </div>
  );
}
