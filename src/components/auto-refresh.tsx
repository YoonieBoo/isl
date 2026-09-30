"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Polls the current route while a background job (e.g. a processing run) is
// still active, so the page picks up status/progress changes made by
// after() on the server without the user manually refreshing.
export function AutoRefresh({ active, intervalMs = 3000 }: { active: boolean; intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs, router]);

  return null;
}
