import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AccentCard, Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { ArrowLeftIcon, ArrowRightIcon, CalendarIcon } from "@/components/icons";
import { SkillLevelBadge } from "@/components/skill-level";
import { CourseFilter } from "@/app/(app)/profiles/[learnerId]/course-filter";
import { courseCode, shortFormName } from "@/lib/course-code";
import { bestEvidence, getSkillFramework, readSkillRatings, type SkillLevel, type SkillRatings } from "@/lib/skills/frameworks";

type Bullet = {
  label: string;
  quote: string | null;
  href: string | null;
  tooltip?: string;
  courses: string[];
  level?: SkillLevel;
};

function BulletList({ items }: { items: Bullet[] }) {
  if (items.length === 0) return <p className="text-sm text-foreground-muted">Needs further evidence.</p>;
  return (
    <ul className="list-disc space-y-4 pl-5 text-sm leading-relaxed text-foreground marker:text-foreground-muted">
      {items.map((item, i) => (
        <li key={i} title={item.tooltip}>
          <div className="flex flex-wrap items-center gap-2">
            {item.href ? (
              <Link
                href={item.href}
                className="font-semibold text-foreground underline decoration-dotted underline-offset-2 hover:text-isl-blue"
              >
                {item.label}
              </Link>
            ) : (
              <span className="font-semibold text-foreground">{item.label}</span>
            )}
            {item.level && <SkillLevelBadge level={item.level} />}
            {item.courses.map((c) => (
              <span key={c} className="rounded-full bg-surface-pale px-2 py-0.5 text-xs font-medium text-foreground-muted">
                {c}
              </span>
            ))}
          </div>
          {item.quote && <span className="text-foreground-muted">&ldquo;{item.quote}&rdquo;</span>}
        </li>
      ))}
    </ul>
  );
}

// Strengths and development focus come from the course's fixed skill ratings
// (see lib/skills) — every learner in a course is judged on the same skills.
function skillBullets(
  courses: { id: string; name: string }[],
  ratingsByEnvironment: Map<string, SkillRatings>,
  levels: SkillLevel[],
  showCourse: boolean,
): Bullet[] {
  const bullets: Bullet[] = [];
  for (const level of levels) {
    for (const course of courses) {
      const framework = getSkillFramework(course.name);
      const ratings = ratingsByEnvironment.get(course.id);
      if (!framework || !ratings) continue;
      for (const skill of framework.skills) {
        const rating = ratings.skills.find((s) => s.key === skill.key);
        if (rating?.level !== level) continue;
        const evidence = bestEvidence(rating);
        bullets.push({
          label: skill.name,
          quote: evidence?.quote ?? null,
          href: evidence?.processingResultId ? `/reviews/${evidence.processingResultId}` : null,
          tooltip: [rating.summary, evidence ? `Based on: ${shortFormName(evidence.form)}` : null].filter(Boolean).join("\n"),
          courses: showCourse ? [courseCode(course.name)] : [],
          level: levels.length > 1 ? level : undefined,
        });
      }
    }
  }
  return bullets;
}

type SourceInfo = { sourceField: string | null; processingResultId: string | null; signalId: string | null };

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
        .select("learning_environments(id, name)")
        .eq("learner_id", learnerId),
      supabase
        .from("learner_insights")
        .select(
          "id, title, summary, learning_preferences, approved_at, approved_output, updated_at, environment_id, learning_environments(name)",
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

  const allCourses = (environments ?? [])
    .map((e) => e.learning_environments)
    .filter((e): e is { id: string; name: string } => Boolean(e))
    .sort((a, b) => a.name.localeCompare(b.name));

  // A course filter (?environment=<id>) scopes every card below to just that
  // course instead of blending every course the learner is in — needed when
  // judging one course's output in isolation rather than the whole learner.
  const courses = selectedEnvironmentId ? allCourses.filter((c) => c.id === selectedEnvironmentId) : allCourses;
  const approvedInsights = selectedEnvironmentId
    ? (allApprovedInsights ?? []).filter((i) => i.environment_id === selectedEnvironmentId)
    : (allApprovedInsights ?? []);

  // Latest skill ratings per course.
  const ratingsByEnvironment = new Map<string, SkillRatings>();
  for (const insight of [...approvedInsights].sort((a, b) => b.updated_at.localeCompare(a.updated_at))) {
    const ratings = readSkillRatings(insight.approved_output);
    if (ratings && !ratingsByEnvironment.has(insight.environment_id)) ratingsByEnvironment.set(insight.environment_id, ratings);
  }

  const showCourse = !selectedEnvironmentId && courses.length > 1;
  const strengths = skillBullets(courses, ratingsByEnvironment, ["strong"], showCourse);
  const needs = skillBullets(courses, ratingsByEnvironment, ["needs_support", "developing"], showCourse);

  // Learning preferences aren't part of the skill lists, so they still come
  // from the AI's per-answer signals, stored on the insight as "label: quote".
  const preferenceItems = [...new Set(approvedInsights.flatMap((i) => i.learning_preferences))];
  const preferenceCourses = new Map<string, string[]>();
  for (const insight of approvedInsights) {
    const name = insight.learning_environments?.name;
    if (!name || !showCourse) continue;
    for (const item of insight.learning_preferences) {
      const existing = preferenceCourses.get(item.trim()) ?? [];
      if (!existing.includes(courseCode(name))) preferenceCourses.set(item.trim(), [...existing, courseCode(name)]);
    }
  }
  const sourceMap = new Map<string, SourceInfo>();
  if (approvedInsights.length > 0) {
    const { data: evidenceRows } = await supabase
      .from("insight_evidence")
      .select("evidence_text, learner_signal_id, learner_signals(source_field, processing_result_id)")
      .in(
        "learner_insight_id",
        approvedInsights.map((i) => i.id),
      );
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
  const preferences: Bullet[] = preferenceItems.map((item) => {
    const separatorIndex = item.indexOf(": ");
    const source = sourceMap.get(item.trim());
    return {
      label: separatorIndex === -1 ? item : item.slice(0, separatorIndex),
      quote: separatorIndex === -1 ? null : item.slice(separatorIndex + 2),
      href: source?.processingResultId
        ? `/reviews/${source.processingResultId}${source.signalId ? `#${source.signalId}` : ""}`
        : null,
      tooltip: source?.sourceField ? `Based on: ${source.sourceField}` : undefined,
      courses: preferenceCourses.get(item.trim()) ?? [],
    };
  });

  const artifactsWithLinks = await Promise.all(
    (artifacts ?? []).slice(0, 5).map(async (a) => {
      if (a.external_url) return { ...a, viewUrl: a.external_url as string | null };
      if (a.file_reference) {
        const { data: signed } = await supabase.storage.from("portfolio").createSignedUrl(a.file_reference, 3600);
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
              <CourseFilter environments={allCourses} selected={selectedEnvironmentId} />
              <a
                href={`/api/learners/${learner.id}/report${selectedEnvironmentId ? `?environment=${selectedEnvironmentId}` : ""}`}
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
          <BulletList items={strengths} />
        </AccentCard>
        <AccentCard accent="orange" title="Development focus">
          <BulletList items={needs} />
        </AccentCard>
        <AccentCard accent="purple" title="Learning preferences">
          <BulletList items={preferences} />
        </AccentCard>
        <AccentCard accent="green" title="Learning environments">
          {courses.length > 0 ? (
            <ul className="space-y-1.5 text-sm">
              {courses.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2">
                  <Link href={`/learning-environments/${c.id}`} className="text-isl-blue hover:underline">
                    {c.name}
                  </Link>
                  {getSkillFramework(c.name) && (
                    <Link
                      href={`/learning-environments/${c.id}/cohort`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-foreground-muted hover:text-isl-blue hover:underline"
                    >
                      Compare with class <ArrowRightIcon className="h-3.5 w-3.5" />
                    </Link>
                  )}
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
          {approvedInsights.length > 0 && (
            <Link href={`/insights?learner=${learner.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-isl-blue hover:underline">
              View all <ArrowRightIcon className="h-4 w-4" />
            </Link>
          )}
        </div>
        {approvedInsights.length > 0 ? (
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
            description="Insights appear here after the learner is analyzed for a course."
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
