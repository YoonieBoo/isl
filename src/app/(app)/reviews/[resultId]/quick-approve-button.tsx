"use client";

import { useState, useTransition } from "react";
import { PrimaryButton, ErrorText } from "@/components/ui";
import { quickApproveInsight } from "@/app/actions/insights";

export function QuickApproveButton({ processingResultId }: { processingResultId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();

  return (
    <div>
      <PrimaryButton
        type="button"
        disabled={pending}
        onClick={() => {
          setError(undefined);
          startTransition(async () => {
            try {
              await quickApproveInsight(processingResultId);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Failed to create insight.");
            }
          });
        }}
      >
        {pending ? "Drafting…" : "Approve as insight"}
      </PrimaryButton>
      <ErrorText>{error}</ErrorText>
    </div>
  );
}
