"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IslLogo } from "@/components/isl-logo";
import { signOut } from "@/app/actions/auth";
import {
  HomeIcon,
  BuildingIcon,
  UserIcon,
  PlayCircleIcon,
  FolderIcon,
  ChevronUpDownIcon,
  LogOutIcon,
} from "@/components/icons";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: HomeIcon },
  { href: "/learning-environments", label: "Learning Environments", icon: BuildingIcon },
  { href: "/learners", label: "Learners", icon: UserIcon },
  { href: "/processing-runs", label: "Processing Runs", icon: PlayCircleIcon },
  { href: "/portfolios", label: "Portfolios", icon: FolderIcon },
];

function UserMenu({ userEmail }: { userEmail: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  const initial = userEmail.charAt(0).toUpperCase();

  return (
    <div ref={ref} className="relative border-t border-border p-3">
      {open && (
        <div className="absolute inset-x-3 bottom-full mb-2 overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-lg">
          <div className="truncate border-b border-border px-3 py-2 text-xs text-foreground-muted">
            {userEmail}
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-foreground-muted transition-colors hover:bg-surface-pale hover:text-foreground"
            >
              <LogOutIcon className="h-4 w-4" />
              Sign out
            </button>
          </form>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface-pale"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-isl-blue-pale text-sm font-semibold text-isl-blue-dark">
          {initial}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{userEmail}</span>
        <ChevronUpDownIcon className="h-4 w-4 shrink-0 text-foreground-muted" />
      </button>
    </div>
  );
}

export function AppShell({
  userEmail,
  children,
}: {
  userEmail: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen w-full">
      <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-surface">
        <div className="flex h-16 items-center border-b border-border px-5">
          <Link href="/">
            <IslLogo className="text-2xl" />
          </Link>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-isl-blue-pale text-isl-blue-dark"
                    : "text-foreground-muted hover:bg-surface-pale hover:text-foreground"
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <UserMenu userEmail={userEmail} />
      </aside>
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
