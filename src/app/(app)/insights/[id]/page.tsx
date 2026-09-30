import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, PageHeader } from "@/components/ui";
import { StatusActions } from "@/app/(app)/insights/[id]/status-actions";
import { ArrowLeftIcon } from "@/components/icons";

const STATUS_TONE = {
  candidate: "blue",
  under_review: "warning",
  revised: "warning",
  approved: "success",
  rejected: "danger",
} as const;

const SECTION_STYLE = {
  strengths: { dot: "bg-success", border: "border-l-success/60" },
  needs: { dot: "bg-warning", border: "border-l-warning/60" },
  preferences: { dot: "bg-isl-blue", border: "border-l-isl-blue/60" },
  concerns: { dot: "bg-danger", border: "border-l-danger/60" },
} as const;

function SignalList({ items }: { items: string[] }) {
  if (items.length === 0) return <p className="text-sm text-foreground-muted">None observed.</p>;
  return (
    <ul className="space-y-3">
      {items.map((item, i) => {
        const colonIndex = item.indexOf(":");
        const hasLabel = colonIndex > 0 && colonIndex < 60;
        const label = hasLabel ? item.slice(0, colonIndex).trim() : null;
        const body = hasLabel ? item.slice(colonIndex + 1).trim() : item;
        return (
          <li key={i}>
            {label && <p className="text-sm font-semibold text-foreground">{label}</p>}
            <p className="mt-0.5 text-sm leading-relaxed text-foreground-muted">{body}</p>
          </li>
        );
      })}
    </ul>
  );
}

function SignalSection({
  tone,
  title,
  items,
}: {
  tone: keyof typeof SECTION_STYLE;
  title: string;
  items: string[];
}) {
  const style = SECTION_STYLE[tone];
  return (
    <div className={`rounded-lg border border-border border-l-4 ${style.border} bg-surface-pale/40 p-4`}>
      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">
        <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
        {title}
        <span className="font-normal normal-case text-foreground-muted/70">({items.length})</span>
      </h3>
      <div className="mt-3">
        <SignalList items={items} />
      </div>
    </div>
  );
}

export default async function InsightDetailPage({
  params,
}: PageProps<"/insights/[id]">) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: insight, error } = await supabase
    .from("learner_insights")
    .select("*, learners(id, display_name), learning_environments(name)")
    .eq("id", id)
    .single();

  if (error || !insight) notFound();

  const { data: evidence } = await supabase
    .from("insight_evidence")
    .select("id, evidence_text")
    .eq("learner_insight_id", id);

  return (
    <div>
      {insight.learners?.id && (
        <Link
          href={`/learners/${insight.learners.id}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-isl-blue hover:underline"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to {insight.learners.display_name}
        </Link>
      )}

      <div className="mt-4">
        <PageHeader
          title={insight.title}
          description={insight.learning_environments?.name}
          action={<Badge tone={STATUS_TONE[insight.status]}>{insight.status.replace(/_/g, " ")}</Badge>}
        />
      </div>

      <Card className="mx-auto mt-6 max-w-3xl">
        <h2 className="text-sm font-semibold text-foreground">Summary</h2>
        <p className="mt-2 text-sm leading-relaxed text-foreground">{insight.summary}</p>

        <div className="mt-5 grid grid-cols-1 items-start gap-4 md:grid-cols-2">
          <SignalSection tone="strengths" title="Observed strengths" items={insight.observed_strengths} />
          <SignalSection tone="needs" title="Development needs" items={insight.development_needs} />
          <SignalSection tone="preferences" title="Learning preferences" items={insight.learning_preferences} />
          <SignalSection tone="concerns" title="Concerns" items={insight.concerns} />
        </div>

        {insight.interpretation_boundary && (
          <p className="mt-4 rounded-lg bg-surface-pale p-3 text-xs italic text-foreground-muted">
            {insight.interpretation_boundary}
          </p>
        )}
      </Card>

      {evidence && evidence.length > 0 && (
        <Card className="mx-auto mt-4 max-w-3xl">
          <h2 className="text-sm font-semibold text-foreground">Supporting evidence</h2>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-foreground-muted">
            {evidence.map((e) => (
              <li key={e.id} className="border-l-2 border-border pl-3">
                &ldquo;{e.evidence_text}&rdquo;
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mx-auto mt-6 max-w-3xl">
        <StatusActions insightId={insight.id} status={insight.status} />
      </div>
    </div>
  );
}
