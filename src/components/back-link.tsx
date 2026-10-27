"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon } from "@/components/icons";

// Counted by AppShell on every in-app page change in this tab.
export const NAV_COUNT_KEY = "isl-nav-count";

// "Back" returns to the page the user actually came from (like the browser
// back button). If this tab has no earlier page in the app — opened from a
// link or a new tab — it goes to fallbackHref instead of leaving the site.
export function BackLink({ fallbackHref, label = "Back" }: { fallbackHref: string; label?: string }) {
  const router = useRouter();
  return (
    <Link
      href={fallbackHref}
      onClick={(e) => {
        let count = 0;
        try {
          count = Number(sessionStorage.getItem(NAV_COUNT_KEY) ?? 0);
        } catch {
          count = 0;
        }
        if (count > 1 && window.history.length > 1) {
          e.preventDefault();
          router.back();
        }
      }}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-isl-blue hover:underline"
    >
      <ArrowLeftIcon className="h-4 w-4" />
      {label}
    </Link>
  );
}
