"use client";

import { useState } from "react";
import { IslLoader } from "@/components/isl-loader";

// Fetches the PDF in the background so the button can show progress — a
// plain link gives no feedback during the few seconds the report takes.
export function DownloadPdfButton({ href }: { href: string }) {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function download() {
    setPending(true);
    setFailed(false);
    try {
      const response = await fetch(href);
      if (!response.ok) throw new Error(String(response.status));
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const fileName = disposition.match(/filename="([^"]+)"/)?.[1] ?? "insights.pdf";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={download}
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground-muted transition-colors hover:bg-surface-pale hover:text-foreground disabled:cursor-wait"
    >
      {pending && <IslLoader size={18} label="Preparing PDF" />}
      {pending ? "Preparing PDF…" : failed ? "Try again" : "Download PDF"}
    </button>
  );
}
