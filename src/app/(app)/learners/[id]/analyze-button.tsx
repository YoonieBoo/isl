"use client";

import { useTransition } from "react";
import { SecondaryButton } from "@/components/ui";
import { PlayCircleIcon } from "@/components/icons";
import { createLearnerAnalysisRun } from "@/app/actions/processing-runs";

export function AnalyzeButton({ learnerId, environmentId }: { learnerId: string; environmentId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <SecondaryButton
      className="bg-surface"
      disabled={pending}
      onClick={() => startTransition(() => createLearnerAnalysisRun(learnerId, environmentId))}
    >
      <PlayCircleIcon className="h-4 w-4" />
      {pending ? "Starting…" : "Analyze"}
    </SecondaryButton>
  );
}
