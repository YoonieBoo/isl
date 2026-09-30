"use client";

import { useState, useTransition } from "react";
import { PrimaryButton, SecondaryButton, ErrorText } from "@/components/ui";
import { setInsightReviewStatus } from "@/app/actions/insights";

export function StatusActions({
  insightId,
  status,
}: {
  insightId: string;
  status: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();

  const act = (next: "under_review" | "approved" | "rejected") =>
    startTransition(async () => {
      setError(undefined);
      try {
        await setInsightReviewStatus(insightId, next);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to update status.");
      }
    });

  if (status === "approved" || status === "rejected") {
    return null;
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {status === "candidate" && (
          <SecondaryButton disabled={pending} onClick={() => act("under_review")}>
            Mark under review
          </SecondaryButton>
        )}
        <PrimaryButton disabled={pending} onClick={() => act("approved")}>
          Approve
        </PrimaryButton>
        <SecondaryButton disabled={pending} onClick={() => act("rejected")}>
          Reject
        </SecondaryButton>
      </div>
      <div className="mt-2">
        <ErrorText>{error}</ErrorText>
      </div>
    </div>
  );
}
