"use client";

import { useState } from "react";
import { Badge, PrimaryButton } from "@/components/ui";
import { ChevronDownIcon, CloseIcon } from "@/components/icons";
import { ReviewForm } from "@/app/(app)/reviews/[resultId]/review-form";

const DECISION_TONE = {
  agree: "success",
  revise: "blue",
  reject: "danger",
  unsure: "warning",
  needs_more_evidence: "warning",
  request_rerun: "neutral",
} as const;

type PreviousReview = {
  id: string;
  decision: keyof typeof DECISION_TONE;
  review_notes: string | null;
  reviewed_at: string;
};

export function ReviewModal({
  processingResultId,
  learnerId,
  defaultCorrectedOutput,
  previousReviews,
  buttonLabel = "Review",
  nextReviewUrl,
}: {
  processingResultId: string;
  learnerId: string | null;
  defaultCorrectedOutput: string;
  previousReviews: PreviousReview[];
  buttonLabel?: string;
  nextReviewUrl?: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <PrimaryButton type="button" onClick={() => setOpen(true)}>
        {buttonLabel}
      </PrimaryButton>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 py-10"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-border bg-surface p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">Review</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-lg p-1 text-foreground-muted hover:bg-surface-pale hover:text-foreground"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4">
              <ReviewForm
                processingResultId={processingResultId}
                learnerId={learnerId}
                defaultCorrectedOutput={defaultCorrectedOutput}
                nextReviewUrl={nextReviewUrl}
              />
            </div>

            {previousReviews.length > 0 && (
              <details className="group mt-4 border-t border-border pt-3">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-foreground">
                  Review history
                  <ChevronDownIcon className="h-4 w-4 shrink-0 text-foreground-muted transition-transform group-open:rotate-180" />
                </summary>
                <ul className="mt-3 space-y-2 text-sm">
                  {previousReviews.map((rev) => (
                    <li key={rev.id} className="flex items-center justify-between border-b border-border pb-2 last:border-0">
                      <div>
                        <Badge tone={DECISION_TONE[rev.decision]}>{rev.decision.replace(/_/g, " ")}</Badge>
                        {rev.review_notes && (
                          <p className="mt-1 text-foreground-muted">{rev.review_notes}</p>
                        )}
                      </div>
                      <span className="shrink-0 pl-3 text-xs text-foreground-muted">
                        {new Date(rev.reviewed_at).toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        </div>
      )}
    </>
  );
}
