import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AccentCard, Badge, Card, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { ArrowLeftIcon, BuildingIcon, ClipboardCheckIcon, StarIcon, TargetIcon, UserCircleIcon, UserIcon } from "@/components/icons";

type CountedItem = { text: string; learners: string[] };

function tally(
  learnerId: string,
  learnerName: string,
  items: string[],
  seenPerLearner: Map<string, Set<string>>,
  counts: Map<string, Set<string>>,
) {
  const seen = seenPerLearner.get(learnerId) ?? new Set<string>();
  seenPerLearner.set(learnerId, seen);
  for (const raw of items) {
    const text = raw.trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    const learners = counts.get(text) ?? new Set<string>();
    learners.add(learnerName);
    counts.set(text, learners);
  }
}

function toCommonList(counts: Map<string, Set<string>>, minLearners = 2): CountedItem[] {
  return [...counts.entries()]
    .filter(([, learners]) => learners.size >= minLearners)
    .map(([text, learners]) => ({ text, learners: [...learners] }))
    .sort((a, b) => b.learners.length - a.learners.length);
}

const PATTERN_TONE = {
  candidate: "blue",
  confirmed: "success",
  unassigned: "neutral",
  needs_more_evidence: "warning",
} as const;

export default async function CohortPage({
  params,
}: PageProps<"/learning-environments/[id]/cohort">) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: env, error } = await supabase
    .from("learning_environments")
    .select("id, name")
    .eq("id", id)
    .single();
  if (error || !env) notFound();

  const [{ data: memberships }, { data: insights }, { data: runs }] = await Promise.all([
    supabase
      .from("learner_environments")
      .select("learner_id, learners(id, display_name)")
      .eq("environment_id", id),
    supabase
      .from("learner_insights")
      .select("learner_id, observed_strengths, development_needs, learning_preferences, concerns, learners(display_name)")
      .eq("environment_id", id)
      .eq("status", "approved"),
    supabase.from("processing_runs").select("id").eq("environment_id", id),
  ]);

  const runIds = (runs ?? []).map((r) => r.id);
  const { data: patterns } = runIds.length
    ? await supabase
        .from("learner_patterns")
        .select("id, pattern_type, assignment_status, learner_id, learners(display_name)")
        .in("processing_run_id", runIds)
    : { data: [] as { id: string; pattern_type: string; assignment_status: string; learner_id: string | null; learners: { display_name: string } | null }[] };

  const learners = (memberships ?? [])
    .filter((m) => m.learners)
    .map((m) => ({ id: m.learners!.id, name: m.learners!.display_name }));

  const learnersWithApprovedInsight = new Set((insights ?? []).map((i) => i.learner_id));
  const learnersNeedingEvidence = learners.filter((l) => !learnersWithApprovedInsight.has(l.id));

  const strengthCounts = new Map<string, Set<string>>();
  const needCounts = new Map<string, Set<string>>();
  const preferenceCounts = new Map<string, Set<string>>();
  const concernCounts = new Map<string, Set<string>>();
  const seenStrength = new Map<string, Set<string>>();
  const seenNeed = new Map<string, Set<string>>();
  const seenPreference = new Map<string, Set<string>>();
  const seenConcern = new Map<string, Set<string>>();

  for (const insight of insights ?? []) {
    const name = insight.learners?.display_name ?? "Unknown learner";
    tally(insight.learner_id, name, insight.observed_strengths ?? [], seenStrength, strengthCounts);
    tally(insight.learner_id, name, insight.development_needs ?? [], seenNeed, needCounts);
    tally(insight.learner_id, name, insight.learning_preferences ?? [], seenPreference, preferenceCounts);
    tally(insight.learner_id, name, insight.concerns ?? [], seenConcern, concernCounts);
  }

  const commonStrengths = toCommonList(strengthCounts);
  const commonNeeds = toCommonList(needCounts);
  const commonPreferences = toCommonList(preferenceCounts);
  const commonConcerns = toCommonList(concernCounts);

  const patternTypeCounts = new Map<string, number>();
  const assignmentStatusCounts = new Map<string, number>();
  for (const p of patterns ?? []) {
    patternTypeCounts.set(p.pattern_type, (patternTypeCounts.get(p.pattern_type) ?? 0) + 1);
    assignmentStatusCounts.set(p.assignment_status, (assignmentStatusCounts.get(p.assignment_status) ?? 0) + 1);
  }

  function CommonList({
    icon,
    accent,
    title,
    items,
    emptyNote,
  }: {
    icon: React.ComponentType<{ className?: string }>;
    accent: "blue" | "orange" | "purple" | "green";
    title: string;
    items: CountedItem[];
    emptyNote: string;
  }) {
    return (
      <AccentCard icon={icon} accent={accent} title={title}>
        {items.length === 0 ? (
          <p className="text-sm text-foreground-muted">{emptyNote}</p>
        ) : (
          <ul className="space-y-2.5 text-sm">
            {items.map((item) => (
              <li key={item.text}>
                <p className="text-foreground">{item.text}</p>
                <p className="mt-0.5 text-xs text-foreground-muted">
                  {item.learners.length} learners — {item.learners.join(", ")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </AccentCard>
    );
  }

  return (
    <div>
      <Link
        href={`/learning-environments/${env.id}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-isl-blue hover:underline"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Back to environment
      </Link>

      <div className="mt-4">
        <PageHeader
          title={`Cohort view — ${env.name}`}
          icon={BuildingIcon}
          description="Assembled by aggregating existing per-learner profiles and patterns — there is no dedicated cohort-processing feature yet. An item only appears as 'common' if it recurs for 2 or more learners; nothing here is forced."
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={UserIcon} label="Learners" value={learners.length} />
        <StatCard icon={UserCircleIcon} iconClassName="bg-violet-50 text-violet-600" label="With an approved insight" value={learnersWithApprovedInsight.size} />
        <StatCard icon={ClipboardCheckIcon} iconClassName="bg-amber-50 text-amber-600" label="Needs more evidence" value={learnersNeedingEvidence.length} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CommonList icon={StarIcon} accent="blue" title="Common strengths" items={commonStrengths} emptyNote="No strength appears for more than one learner yet — see individual profiles." />
        <CommonList icon={TargetIcon} accent="orange" title="Common development needs" items={commonNeeds} emptyNote="No development need appears for more than one learner yet." />
        <CommonList icon={UserIcon} accent="purple" title="Common preferences" items={commonPreferences} emptyNote="No preference appears for more than one learner yet." />
        <CommonList icon={ClipboardCheckIcon} accent="green" title="Common concerns" items={commonConcerns} emptyNote="No concern appears for more than one learner yet." />
      </div>

      <Card className="mt-4">
        <h2 className="text-sm font-semibold text-foreground">Signal mix across the cohort</h2>
        <p className="mt-1 text-xs text-foreground-muted">
          Dominant signal type per learner per processing run — a rough read on how much of the class produced a specific
          reading versus only generic activity evidence.
        </p>
        {patternTypeCounts.size === 0 ? (
          <p className="mt-3 text-sm text-foreground-muted">No patterns generated for this environment yet.</p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {[...patternTypeCounts.entries()].sort((a, b) => b[1] - a[1]).map(([type, count]) => (
              <li key={type}>
                <Badge tone="neutral">{type.replace(/_/g, " ")}: {count}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mt-4">
        <h2 className="text-sm font-semibold text-foreground">Pattern review status across the cohort</h2>
        {assignmentStatusCounts.size === 0 ? (
          <p className="mt-2 text-sm text-foreground-muted">No patterns generated for this environment yet.</p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {[...assignmentStatusCounts.entries()].map(([status, count]) => (
              <li key={status}>
                <Badge tone={PATTERN_TONE[status as keyof typeof PATTERN_TONE] ?? "neutral"}>
                  {status.replace(/_/g, " ")}: {count}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mt-4">
        <h2 className="text-sm font-semibold text-foreground">Learners needing more evidence</h2>
        {learnersNeedingEvidence.length === 0 ? (
          <EmptyState title="Every learner has at least one approved insight" description="No one in this cohort is currently unrepresented." />
        ) : (
          <ul className="mt-3 space-y-1.5 text-sm">
            {learnersNeedingEvidence.map((l) => (
              <li key={l.id}>
                <Link href={`/profiles/${l.id}`} className="text-isl-blue hover:underline">
                  {l.name}
                </Link>
                <span className="text-foreground-muted"> — no approved insight yet</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
