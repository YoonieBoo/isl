"use client";

import { useTransition } from "react";
import { SecondaryButton } from "@/components/ui";
import { setLearningEnvironmentStatus } from "@/app/actions/learning-environments";

export function ArchiveButton({
  id,
  name,
  status,
}: {
  id: string;
  name: string;
  status: "active" | "archived";
}) {
  const [pending, startTransition] = useTransition();
  const nextStatus = status === "active" ? "archived" : "active";

  return (
    <SecondaryButton
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await setLearningEnvironmentStatus(id, name, nextStatus);
        })
      }
    >
      {pending
        ? "Saving…"
        : status === "active"
          ? "Archive"
          : "Restore"}
    </SecondaryButton>
  );
}
