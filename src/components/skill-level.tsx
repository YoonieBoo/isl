import { LEVEL_LABEL, type SkillLevel } from "@/lib/skills/frameworks";

export const LEVEL_STYLES: Record<SkillLevel, { pill: string; dot: string; short: string }> = {
  strong: { pill: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500", short: "Strong" },
  developing: { pill: "bg-amber-50 text-amber-700 ring-amber-200", dot: "bg-amber-400", short: "Developing" },
  needs_support: { pill: "bg-red-50 text-red-700 ring-red-200", dot: "bg-red-500", short: "Support" },
  not_enough_evidence: { pill: "bg-surface-pale text-foreground-muted ring-border", dot: "bg-gray-300", short: "—" },
};

export function SkillLevelBadge({ level, compact = false }: { level: SkillLevel; compact?: boolean }) {
  const style = LEVEL_STYLES[level];
  return (
    <span
      title={LEVEL_LABEL[level]}
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${style.pill}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {compact ? style.short : LEVEL_LABEL[level]}
    </span>
  );
}

export function SkillLevelLegend() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {(Object.keys(LEVEL_STYLES) as SkillLevel[]).map((level) => (
        <SkillLevelBadge key={level} level={level} />
      ))}
    </div>
  );
}
