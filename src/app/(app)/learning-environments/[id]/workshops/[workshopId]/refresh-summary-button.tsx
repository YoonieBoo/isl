"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { refreshClassSummary } from "@/app/actions/workshops";

export function RefreshSummaryButton({ workshopId, label }: { workshopId: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setFailed(false);
          const { ok } = await refreshClassSummary(workshopId).catch(() => ({ ok: false }));
          setBusy(false);
          setFailed(!ok);
          router.refresh();
        }}
        className="text-xs font-medium text-isl-blue hover:underline disabled:opacity-50"
      >
        {busy ? "Writing…" : label}
      </button>
      {failed && <span className="text-xs text-danger">Couldn&apos;t write it. Try again.</span>}
    </span>
  );
}
