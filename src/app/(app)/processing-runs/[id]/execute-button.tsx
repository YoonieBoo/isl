"use client";

import { useState, useTransition } from "react";
import { PrimaryButton, ErrorText } from "@/components/ui";
import { executeProcessingRun } from "@/app/actions/execute-processing-run";

export function ExecuteButton({ runId }: { runId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();

  return (
    <div>
      <PrimaryButton
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            try {
              await executeProcessingRun(runId);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Failed to start execution.");
            }
          })
        }
      >
        {pending ? "Starting…" : "Run SmartDiscovery processing"}
      </PrimaryButton>
      <div className="mt-2">
        <ErrorText>{error}</ErrorText>
      </div>
    </div>
  );
}
