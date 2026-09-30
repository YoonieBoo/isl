"use client";

import { useRouter, usePathname } from "next/navigation";
import { ChevronDownIcon } from "@/components/icons";

export function CourseFilter({
  environments,
  selected,
}: {
  environments: { id: string; name: string }[];
  selected: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    // appearance-none strips the OS-native dropdown chrome (which doesn't
    // respect border-radius consistently across browsers and was rendering
    // as if the arrow overflowed the rounded border) in favor of one
    // consistent custom chevron.
    <div className="relative">
      <select
        value={selected ?? "all"}
        onChange={(e) => {
          const value = e.target.value;
          router.push(value === "all" ? pathname : `${pathname}?environment=${value}`);
        }}
        className="appearance-none rounded-lg border border-border bg-surface py-2 pl-3 pr-8 text-sm font-medium text-foreground"
      >
        <option value="all">All courses</option>
        {environments.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
    </div>
  );
}
