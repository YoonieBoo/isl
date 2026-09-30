import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, PageHeader } from "@/components/ui";
import { ReviewModal } from "@/app/(app)/reviews/[resultId]/review-modal";
import { QuickApproveButton } from "@/app/(app)/reviews/[resultId]/quick-approve-button";
import { pickPrimaryField } from "@/lib/evidence-field";
import { ChevronDownIcon } from "@/components/icons";

export default async function ReviewDetailPage({
  params,
  searchParams,
}: PageProps<"/reviews/[resultId]">) {
  const { resultId } = await params;
  const { queue } = await searchParams;
  const supabase = await createClient();

  const { data: result, error } = await supabase
    .from("processing_results")
    .select(
      "id, status, structured_output, warning, error, learners(id, display_name), dataset_records(source_data, created_at, datasets(name, learning_environments(name))), learner_signals(id, signal_type, label, evidence_text, source_field, interpretation_note), processing_runs(processing_context)",
    )
    .eq("id", resultId)
    .single();

  if (error || !result) notFound();

  // Only worth showing per-signal when this run actually reads from more
  // than one evidence field — otherwise it's the same value on every
  // signal with nothing to distinguish, just noise.
  const evidenceFieldCount = String(
    (result.processing_runs?.processing_context as { evidenceFields?: string } | null)?.evidenceFields ?? "",
  )
    .split(",")
    .map((f) => f.trim())
    .filter(Boolean).length;
  const showSourceField = evidenceFieldCount > 1;

  const { data: previousReviews } = await supabase
    .from("reviews")
    .select("id, decision, review_notes, reviewed_at")
    .eq("processing_result_id", resultId)
    .order("reviewed_at", { ascending: false });

  const sourceData = (result.dataset_records?.source_data as Record<string, string>) ?? {};

  const primaryField = pickPrimaryField(sourceData);
  const questionField = sourceData["question_prompt"] ? "question_prompt" : undefined;
  const detailEntries = Object.entries(sourceData).filter(
    ([field]) => field !== primaryField && field !== questionField,
  );

  const courseName = result.dataset_records?.datasets?.learning_environments?.name;
  const formName = result.dataset_records?.datasets?.name;
  const submittedAt = result.dataset_records?.created_at;

  // "Review all" queue mode: ?queue=learner:<id> chains straight to the next
  // unreviewed item for that learner after each submit, instead of dumping
  // the reviewer back to the general /reviews list every time.
  const queueParam = typeof queue === "string" ? queue : undefined;
  let nextReviewUrl: string | null = null;
  let queueRemaining: number | null = null;
  if (queueParam?.startsWith("learner:")) {
    const queueLearnerId = queueParam.slice("learner:".length);
    const { data: queueResults } = await supabase
      .from("processing_results")
      .select("id, created_at, reviews(decision)")
      .eq("learner_id", queueLearnerId)
      .in("status", ["success", "warning"])
      .order("created_at", { ascending: true });
    const unreviewed = (queueResults ?? []).filter(
      (r) => r.id !== resultId && (r.reviews?.length ?? 0) === 0,
    );
    const currentIsReviewed = (previousReviews?.length ?? 0) > 0;
    queueRemaining = unreviewed.length + (currentIsReviewed ? 0 : 1);
    if (unreviewed.length > 0) {
      nextReviewUrl = `/reviews/${unreviewed[0].id}?queue=${encodeURIComponent(queueParam)}`;
    }
  }

  return (
    <div>
      <PageHeader
        title={`Review — ${result.learners?.display_name ?? "Unknown learner"}`}
        description={
          <>
            {(courseName || formName) && (
              <span className="block font-medium text-foreground">
                {[courseName, formName].filter(Boolean).join(" · ")}
                {submittedAt && ` · ${new Date(submittedAt).toLocaleDateString()}`}
              </span>
            )}
            {result.learners?.id && (
              <Link href={`/learners/${result.learners.id}`} className="text-isl-blue hover:underline">
                View learner profile
              </Link>
            )}
            {queueRemaining !== null && (
              <span className="mt-1 block text-xs font-medium text-isl-blue">
                Review queue: {queueRemaining} unreviewed left for {result.learners?.display_name ?? "this learner"}
              </span>
            )}
          </>
        }
        action={
          <ReviewModal
            processingResultId={result.id}
            learnerId={result.learners?.id ?? null}
            defaultCorrectedOutput={JSON.stringify(result.structured_output, null, 2)}
            previousReviews={previousReviews ?? []}
            nextReviewUrl={nextReviewUrl}
          />
        }
      />

      <div className="mt-6 space-y-4">
        <Card>
          <h2 className="text-sm font-semibold text-foreground">1. SmartDiscovery output</h2>
          {result.learner_signals.length === 0 && (
            <p className="mt-2 text-sm text-foreground-muted">No signals extracted.</p>
          )}
          <div className="mt-3 space-y-3">
            {result.learner_signals.map((signal) => (
              <div
                key={signal.id}
                id={signal.id}
                className="scroll-mt-6 rounded-lg bg-surface-pale p-4 [&:target]:ring-2 [&:target]:ring-isl-blue [&:target]:ring-offset-2"
              >
                <div className="flex items-center gap-2">
                  <Badge tone="blue">{signal.signal_type.replace(/_/g, " ")}</Badge>
                  <span className="break-words text-sm font-medium text-foreground">{signal.label}</span>
                </div>
                <p className="mt-2 break-words text-sm text-foreground-muted">
                  &ldquo;{signal.evidence_text}&rdquo;
                </p>
                {showSourceField && signal.source_field && (
                  <p className="mt-1.5 break-words text-xs text-foreground-muted">
                    <span className="font-medium uppercase tracking-wide">Source field:</span> {signal.source_field}
                  </p>
                )}
                {signal.interpretation_note && (
                  <p className="mt-1.5 break-words text-xs italic text-foreground-muted">{signal.interpretation_note}</p>
                )}
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-0">
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between p-5 text-sm font-semibold text-foreground">
              2. Source evidence
              <ChevronDownIcon className="h-4 w-4 shrink-0 text-foreground-muted transition-transform group-open:rotate-180" />
            </summary>

            <div className="px-5 pb-5">
              {questionField && (
                <div className="mt-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-foreground-muted">Question</p>
                  <p className="mt-1 break-words text-sm text-foreground">{sourceData[questionField]}</p>
                </div>
              )}

              {primaryField && (
                <div className={`rounded-lg border border-border bg-surface-pale p-4 ${questionField ? "mt-3" : "mt-1"}`}>
                  <p className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
                    Learner&apos;s response
                  </p>
                  <p className="mt-1.5 break-words text-base leading-relaxed text-foreground">
                    &ldquo;{sourceData[primaryField]}&rdquo;
                  </p>
                </div>
              )}

              <div className="mt-5 border-t border-border pt-4">
                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-foreground-muted">Context</p>
                <dl className="space-y-4 text-sm">
                  {detailEntries.map(([field, value]) => {
                    const isLink = /^https?:\/\//.test(value ?? "");
                    return (
                      <div key={field}>
                        <dt className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
                          {field.replace(/_/g, " ")}
                        </dt>
                        {isLink ? (
                          <dd className="mt-1">
                            <a
                              href={value}
                              target="_blank"
                              rel="noreferrer"
                              className="break-all text-isl-blue hover:underline"
                            >
                              {value}
                            </a>
                          </dd>
                        ) : (
                          <dd className="mt-1 whitespace-pre-wrap break-words text-foreground">{value || "—"}</dd>
                        )}
                      </div>
                    );
                  })}
                </dl>
              </div>
            </div>
          </details>
        </Card>
      </div>

      {previousReviews?.some((r) => r.decision === "agree" || r.decision === "revise") && (
        <div className="mt-4 flex items-center gap-4">
          <QuickApproveButton processingResultId={result.id} />
          <Link
            href={`/insights/new?resultId=${result.id}`}
            className="text-sm font-medium text-isl-blue hover:underline"
          >
            Edit before approving →
          </Link>
        </div>
      )}

    </div>
  );
}
