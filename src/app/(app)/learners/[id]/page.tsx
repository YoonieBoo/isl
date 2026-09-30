import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, EntityHero, IconCard, SecondaryButton, getInitials } from "@/components/ui";
import { AnalyzeButton } from "@/app/(app)/learners/[id]/analyze-button";
import { DraftInsightButton } from "@/app/(app)/learners/[id]/draft-insight-button";
import { ReviewModal } from "@/app/(app)/reviews/[resultId]/review-modal";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BuildingIcon,
  FolderIcon,
  LightBulbIcon,
  ListIcon,
  PencilIcon,
  UploadIcon,
  UserCircleIcon,
} from "@/components/icons";
import { EvidenceHistoryList } from "@/components/evidence-history-list";
import { AutoRefresh } from "@/components/auto-refresh";

const EVIDENCE_HISTORY_PREVIEW_COUNT = 8;
const CANDIDATE_INSIGHT_PREVIEW_COUNT = 3;

export default async function LearnerDetailPage({
  params,
  searchParams,
}: PageProps<"/learners/[id]">) {
  const { id } = await params;
  const { uploaded, failed } = await searchParams;
  const uploadedCount = typeof uploaded === "string" ? Number(uploaded) : undefined;
  const failedCount = typeof failed === "string" ? Number(failed) : undefined;
  const supabase = await createClient();

  const [{ data: learner, error }, { data: environments }, { data: history }, { data: candidateResults }] =
    await Promise.all([
      supabase.from("learners").select("*").eq("id", id).single(),
      supabase
        .from("learner_environments")
        .select("participation_status, joined_at, learning_environments(id, name, status)")
        .eq("learner_id", id),
      supabase
        .from("dataset_records")
        .select(
          "id, source_data, created_at, datasets(name, learning_environments(name)), processing_results(id)",
        )
        .eq("learner_id", id)
        .order("created_at", { ascending: false }),
      // Candidate AI output that hasn't gone through human review yet — shown
      // inline here (not just on a separate /reviews page) so instructors see
      // it right where they'd look for a learner's insights, per spec §8/§35
      // ("Human Review Is Required" — this stays labeled "candidate" and
      // never substitutes for an approved insight, only makes it visible sooner).
      supabase
        .from("processing_results")
        .select(
          "id, structured_output, learner_signals(id, signal_type, label, evidence_text, interpretation_note), dataset_records(created_at, datasets(name, learning_environments(name))), reviews(id)",
        )
        .eq("learner_id", id)
        .in("status", ["success", "warning"])
        .order("created_at", { ascending: true }),
    ]);

  if (error || !learner) notFound();

  const unreviewedCandidates = (candidateResults ?? []).filter((r) => (r.reviews?.length ?? 0) === 0);
  const candidatePreview = unreviewedCandidates.slice(0, CANDIDATE_INSIGHT_PREVIEW_COUNT);
  const remainingCandidateCount = unreviewedCandidates.length - candidatePreview.length;
  const reviewAllUrl =
    unreviewedCandidates.length > 0
      ? `/reviews/${unreviewedCandidates[0].id}?queue=${encodeURIComponent(`learner:${id}`)}`
      : null;

  return (
    <div>
      <AutoRefresh active={uploadedCount !== undefined} />
      <Link
        href="/learners"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-isl-blue hover:underline"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Back to learners
      </Link>

      <div className="mt-4">
        <EntityHero
          avatarText={getInitials(learner.display_name)}
          title={learner.display_name}
          subtitle={[learner.external_reference, learner.email].filter(Boolean).join(" · ") || undefined}
          href={`/profiles/${learner.id}`}
          badge={<Badge tone={learner.status === "active" ? "success" : "neutral"}>{learner.status}</Badge>}
          actions={
            <>
              <Link href={`/learners/${learner.id}/edit`}>
                <SecondaryButton className="bg-surface">
                  <PencilIcon className="h-4 w-4" />
                  Edit
                </SecondaryButton>
              </Link>
              <Link href={`/profiles/${learner.id}`}>
                <SecondaryButton className="bg-surface">
                  <UserCircleIcon className="h-4 w-4" />
                  View insights
                </SecondaryButton>
              </Link>
            </>
          }
        />
      </div>

      {uploadedCount !== undefined && uploadedCount > 0 && (
        <div
          className={`mt-4 rounded-lg border p-3 text-sm ${
            failedCount ? "border-amber-200 bg-amber-50 text-warning" : "border-green-200 bg-green-50 text-success"
          }`}
        >
          Added {uploadedCount} dataset{uploadedCount === 1 ? "" : "s"} for {learner.display_name}
          {failedCount ? ` — ${failedCount} file${failedCount === 1 ? "" : "s"} failed to upload.` : "."} Ready to
          Analyze below.
        </div>
      )}

      <div className="mt-6">
        <IconCard icon={BuildingIcon} iconClassName="bg-emerald-50 text-emerald-600" title="Learning environments">
          {environments && environments.length > 0 ? (
            <ul className="space-y-3 text-sm">
              {environments.map((le) => {
                const envId = le.learning_environments?.id;
                return (
                  <li
                    key={envId}
                    className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3 last:border-0 last:pb-0"
                  >
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/learning-environments/${envId}`}
                        className="font-medium text-isl-blue hover:underline"
                      >
                        {le.learning_environments?.name}
                      </Link>
                      <Badge tone={le.learning_environments?.status === "active" ? "success" : "neutral"}>
                        {le.learning_environments?.status}
                      </Badge>
                    </div>
                    {envId && (
                      <div className="flex items-center gap-2">
                        <Link href={`/datasets/new?environment=${envId}&returnTo=/learners/${learner.id}`}>
                          <SecondaryButton className="bg-surface">
                            <UploadIcon className="h-4 w-4" />
                            Add data
                          </SecondaryButton>
                        </Link>
                        <AnalyzeButton learnerId={learner.id} environmentId={envId} />
                        <DraftInsightButton learnerId={learner.id} environmentId={envId} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-foreground-muted">Not enrolled in any learning environment yet.</p>
          )}
        </IconCard>
      </div>

      {unreviewedCandidates.length > 0 && (
        <div className="mt-4">
          <IconCard
            icon={LightBulbIcon}
            iconClassName="bg-amber-50 text-amber-600"
            title={`Candidate insights (${unreviewedCandidates.length} unreviewed)`}
            action={
              reviewAllUrl && (
                <Link
                  href={reviewAllUrl}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-isl-blue px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-isl-blue-dark"
                >
                  Review all ({unreviewedCandidates.length})
                </Link>
              )
            }
          >
            <p className="mb-3 text-xs text-foreground-muted">
              AI-generated, not yet checked by a human — nothing here counts as an approved insight until reviewed.
            </p>
            <div className="space-y-4">
              {candidatePreview.map((c) => (
                <div key={c.id} className="rounded-lg border border-dashed border-amber-300 bg-amber-50/40 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <Badge tone="warning">Candidate — not yet reviewed</Badge>
                      <p className="mt-1.5 text-xs text-foreground-muted">
                        {[
                          c.dataset_records?.datasets?.learning_environments?.name,
                          c.dataset_records?.datasets?.name,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                        {c.dataset_records?.created_at &&
                          ` · ${new Date(c.dataset_records.created_at).toLocaleDateString()}`}
                      </p>
                    </div>
                    <ReviewModal
                      processingResultId={c.id}
                      learnerId={learner.id}
                      defaultCorrectedOutput={JSON.stringify(c.structured_output, null, 2)}
                      previousReviews={[]}
                    />
                  </div>

                  <div className="mt-3 space-y-2">
                    {c.learner_signals.length === 0 && (
                      <p className="text-sm text-foreground-muted">No signals extracted.</p>
                    )}
                    {c.learner_signals.map((s) => (
                      <div key={s.id} className="rounded-md bg-surface p-3 text-sm">
                        <div className="flex items-center gap-2">
                          <Badge tone="blue">{s.signal_type.replace(/_/g, " ")}</Badge>
                          <span className="font-medium text-foreground">{s.label}</span>
                        </div>
                        <p className="mt-1 text-foreground-muted">&ldquo;{s.evidence_text}&rdquo;</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {remainingCandidateCount > 0 && reviewAllUrl && (
              <Link href={reviewAllUrl} className="mt-3 inline-block text-sm font-medium text-isl-blue hover:underline">
                +{remainingCandidateCount} more unreviewed — review all →
              </Link>
            )}
          </IconCard>
        </div>
      )}

      <div className="mt-4">
        <IconCard
          icon={FolderIcon}
          iconClassName="bg-amber-50 text-amber-600"
          title="Portfolio"
          action={
            <Link
              href={`/portfolios?learner=${learner.id}`}
              className="inline-flex items-center gap-1 text-sm font-medium text-isl-blue hover:underline"
            >
              View <ArrowRightIcon className="h-4 w-4" />
            </Link>
          }
        />
      </div>

      <div className="mt-4">
        <IconCard
          icon={ListIcon}
          iconClassName="bg-sky-50 text-sky-600"
          title="Evidence history"
          action={
            history &&
            history.length > 0 && (
              <Link
                href={`/learners/${learner.id}/history`}
                className="inline-flex items-center gap-1 text-sm font-medium text-isl-blue hover:underline"
              >
                View all <ArrowRightIcon className="h-4 w-4" />
              </Link>
            )
          }
        >
          {history && history.length > 0 ? (
            <EvidenceHistoryList records={history.slice(0, EVIDENCE_HISTORY_PREVIEW_COUNT)} dense />
          ) : (
            <p className="text-sm text-foreground-muted">No evidence recorded for this learner yet.</p>
          )}
        </IconCard>
      </div>
    </div>
  );
}
