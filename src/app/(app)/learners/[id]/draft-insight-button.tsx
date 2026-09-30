"use client";

import { useState, useTransition } from "react";
import { SecondaryButton, ErrorText } from "@/components/ui";
import { ClipboardCheckIcon } from "@/components/icons";
import { quickApproveConsolidatedInsight } from "@/app/actions/insights";

export function DraftInsightButton({ learnerId, environmentId }: { learnerId: string; environmentId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();

  return (
    <div>
      <SecondaryButton
        className="bg-surface"
        disabled={pending}
        onClick={() => {
          setError(undefined);
          startTransition(async () => {
            try {
              await quickApproveConsolidatedInsight(learnerId, environmentId);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Failed to draft insight.");
            }
          });
        }}
      >
        <ClipboardCheckIcon className="h-4 w-4" />
        {pending ? "Drafting…" : "Draft insight"}
      </SecondaryButton>
      {error && <ErrorText>{error}</ErrorText>}
    </div>
  );
}
