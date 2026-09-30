"use client";

import { useTransition } from "react";
import { SecondaryButton } from "@/components/ui";
import { ArchiveIcon } from "@/components/icons";
import { setLearnerStatus } from "@/app/actions/learners";

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
          await setLearnerStatus(id, name, nextStatus);
        })
      }
    >
      <ArchiveIcon className="h-4 w-4" />
      {pending ? "Saving…" : status === "active" ? "Archive" : "Restore"}
    </SecondaryButton>
  );
}
