import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AccentCard, Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { ArrowLeftIcon, ArrowRightIcon, CalendarIcon } from "@/components/icons";
import { CourseFilter } from "@/app/(app)/profiles/[learnerId]/course-filter";

type SourceInfo = { sourceField: string | null; processingResultId: string | null; signalId: string | null };

function BulletList({
  items,
  sourceMap,
  courseMap,
}: {
  items: string[];
  sourceMap: Map<string, SourceInfo>;
  courseMap: Map<string, string[]>;
}) {
  if (items.length === 0) return <p className="text-sm text-foreground-muted">Needs further evidence.</p>;
  return (
    <ul className="list-disc space-y-4 pl-5 text-sm leading-relaxed text-foreground marker:text-foreground-muted">
      {items.map((item, i) => {
        const separatorIndex = item.indexOf(": ");
        if (separatorIndex === -1) return <li key={i}>{item}</li>;
        const label = item.slice(0, separatorIndex);
        const quote = item.slice(separatorIndex + 2);
        const source = sourceMap.get(item.trim());
        const courses = courseMap.get(item.trim()) ?? [];
        const tooltip = source?.sourceField ? `Based on: ${source.sourceField}` : undefined;
        const href = source?.processingResultId
          ? source.signalId
            ? `/reviews/${source.processingResultId}#${source.signalId}`
            : `/reviews/${source.processingResultId}`
          : null;
        return (
          <li key={i} title={tooltip}>
            <div className="flex flex-wrap items-center gap-2">
              {href ? (
                <Link
                  href={href}
                  className="font-semibold text-foreground underline decoration-dotted underline-offset-2 hover:text-isl-blue"
                >
                  {label}
                </Link>
              ) : (
                <span className="font-semibold text-foreground">{label}</span>
              )}
              {courses.map((c) => (
                <span
                  key={c}
                  className="rounded-full bg-surface-pale px-2 py-0.5 text-xs font-medium text-foreground-muted"
                >
                  {c}
                </span>
              ))}
            </div>
            <span className="text-foreground-muted">&ldquo;{quote}&rdquo;</span>
          </li>
        );
      })}
    </ul>
  );
}

export default async function LearnerProfilePage({
  params,
  searchParams,
}: PageProps<"/profiles/[learnerId]">) {
  const { learnerId } = await params;
  const { environment: environmentFilter } = await searchParams;
  const selectedEnvironmentId = typeof environmentFilter === "string" ? environmentFilter : null;
  const supabase = await createClient();

  const [{ data: learner, error }, { data: environments }, { data: allApprovedInsights }, { data: artifacts }] =
    await Promise.all([
      supabase.from("learners").select("*").eq("id", learnerId).single(),
      supabase
        .from("learner_environments")
        .select("participation_status, learning_environments(id, name)")
        .eq("learner_id", learnerId),
      supabase
        .from("learner_insights")
        .select(
          "id, title, summary, observed_strengths, development_needs, learning_preferences, concerns, approved_at, approved_by, environment_id, learning_environments(name)",
        )
        .eq("learner_id", learnerId)
        .eq("status", "approved")
        .order("approved_at", { ascending: false }),
      supabase
        .from("portfolio_artifacts")
        .select("id, title, artifact_type, created_at, external_url, file_reference")
        .eq("learner_id", learnerId)
        .order("created_at", { ascending: false }),
    ]);

  if (error || !learner) notFound();

  // A course filter (?environment=<id>) scopes every card below to just that
  // course instead of blending every course the learner is in — needed when
  // judging one course's output in isolation rather than the whole learner.
  const approvedInsights = selectedEnvironmentId
    ? (allApprovedInsights ?? []).filter((i) => i.environment_id === selectedEnvironmentId)
    : allApprovedInsights;

  const strengths = [...new Set((approvedInsights ?? []).flatMap((i) => i.observed_strengths))];
  const needs = [...new Set((approvedInsights ?? []).flatMap((i) => i.development_needs))];
  const preferences = [...new Set((approvedInsights ?? []).flatMap((i) => i.learning_preferences))];

  // Each learner_insights row is scoped to exactly one course — the combined
  // bullet lists above flatten across every course when no filter is picked,
  // which loses which course each bullet came from. This rebuilds that
  // per-bullet course tag. Skipped entirely once a specific course is
  // selected above, since every badge would just repeat the same course.
  const courseMap = new Map<string, string[]>();
  if (!selectedEnvironmentId) {
    for (const insight of approvedInsights ?? []) {
      const courseName = insight.learning_environments?.name;
      if (!courseName) continue;
      for (const field of [insight.observed_strengths, insight.development_needs, insight.learning_preferences]) {
        for (const item of field) {
          const key = item.trim();
          const existing = courseMap.get(key) ?? [];
          if (!existing.includes(courseName)) courseMap.set(key, [...existing, courseName]);
        }
      }
    }
  }

  const insightIds = (approvedInsights ?? []).map((i) => i.id);
  const sourceMap = new Map<string, SourceInfo>();
  if (insightIds.length > 0) {
    const { data: evidenceRows } = await supabase
      .from("insight_evidence")
      .select("evidence_text, learner_signal_id, learner_signals(source_field, processing_result_id)")
      .in("learner_insight_id", insightIds);
    for (const row of evidenceRows ?? []) {
      const key = row.evidence_text.trim();
      if (!sourceMap.has(key) && row.learner_signals) {
        sourceMap.set(key, {
          sourceField: row.learner_signals.source_field,
          processingResultId: row.learner_signals.processing_result_id,
          signalId: row.learner_signal_id,
        });
      }
    }
  }

  const artifactsWithLinks = await Promise.all(
    (artifacts ?? []).slice(0, 5).map(async (a) => {
      if (a.external_url) return { ...a, viewUrl: a.external_url as string | null };
      if (a.file_reference) {
        const { data: signed } = await supabase.storage
          .from("portfolio")
          .createSignedUrl(a.file_reference, 3600);
        return { ...a, viewUrl: signed?.signedUrl ?? null };
      }
      return { ...a, viewUrl: null as string | null };
    }),
  );

  return (
    <div>
      <Link
        href={`/learners/${learner.id}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-isl-blue hover:underline"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Manage learner record
      </Link>

      <div className="mt-4">
        <PageHeader
          title={learner.display_name}
          action={
            <div className="flex items-center gap-2">
              <CourseFilter
                environments={(environments ?? [])
                  .map((e) => e.learning_environments)
                  .filter((e): e is { id: string; name: string } => Boolean(e))}
                selected={selectedEnvironmentId}
              />
              <a
                href={`/api/learners/${learner.id}/report`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground-muted transition-colors hover:bg-surface-pale hover:text-foreground"
              >
                Download PDF
              </a>
            </div>
          }
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <AccentCard accent="blue" title="Strengths">
          <BulletList items={strengths} sourceMap={sourceMap} courseMap={courseMap} />
        </AccentCard>
        <AccentCard accent="orange" title="Development focus">
          <BulletList items={needs} sourceMap={sourceMap} courseMap={courseMap} />
        </AccentCard>
        <AccentCard accent="purple" title="Learning preferences">
          <BulletList items={preferences} sourceMap={sourceMap} courseMap={courseMap} />
        </AccentCard>
        <AccentCard accent="green" title="Learning environments">
          {environments && environments.length > 0 ? (
            <ul className="space-y-1 text-sm">
              {environments.map((e) => (
                <li key={e.learning_environments?.id}>
                  <Link
                    href={`/learning-environments/${e.learning_environments?.id}`}
                    className="text-isl-blue hover:underline"
                  >
                    {e.learning_environments?.name}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-foreground-muted">Not enrolled anywhere yet.</p>
          )}
        </AccentCard>
      </div>

      <Card className="mt-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Approved insights</h2>
          {approvedInsights && approvedInsights.length > 0 && (
            <Link href={`/insights?learner=${learner.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-isl-blue hover:underline">
              View all <ArrowRightIcon className="h-4 w-4" />
            </Link>
          )}
        </div>
        {approvedInsights && approvedInsights.length > 0 ? (
          <ul className="mt-3 space-y-3">
            {approvedInsights.map((i) => (
              <li key={i.id} className="border-b border-border pb-3 last:border-0">
                <Link href={`/insights/${i.id}`} className="font-medium text-isl-blue hover:underline">
                  {i.title}
                </Link>
                <p className="mt-1 text-sm text-foreground-muted">{i.summary}</p>
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-foreground-muted">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  Approved {i.approved_at ? new Date(i.approved_at).toLocaleDateString() : "—"}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No approved insight yet"
            description="Approved insights accumulate here once a reviewer signs off on candidate insight."
          />
        )}
      </Card>

      <Card className="mt-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Portfolio</h2>
          <Link href={`/portfolios?learner=${learner.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-isl-blue hover:underline">
            View all <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </div>
        {artifactsWithLinks.length > 0 ? (
          <ul className="mt-3 space-y-1.5 text-sm">
            {artifactsWithLinks.map((a) => (
              <li key={a.id} className="flex items-center justify-between">
                {a.viewUrl ? (
                  <a href={a.viewUrl} target="_blank" rel="noreferrer" className="font-medium text-isl-blue hover:underline">
                    {a.title}
                  </a>
                ) : (
                  <span className="text-foreground">{a.title}</span>
                )}
                <Badge>{a.artifact_type.replace(/_/g, " ")}</Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-foreground-muted">No portfolio artifacts yet.</p>
        )}
      </Card>
    </div>
  );
}
