"use client";

import { useState, useTransition } from "react";
import { PrimaryButton, ErrorText } from "@/components/ui";
import { confirmProcessingRun } from "@/app/actions/processing-runs";

export function ConfirmButton({ runId }: { runId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();

  return (
    <div>
      <PrimaryButton
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            try {
              await confirmProcessingRun(runId);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Failed to confirm run.");
            }
          })
        }
      >
        {pending ? "Confirming…" : "Confirm configuration"}
      </PrimaryButton>
      <div className="mt-2">
        <ErrorText>{error}</ErrorText>
      </div>
    </div>
  );
}
