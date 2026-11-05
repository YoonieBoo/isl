import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AccentCard, Badge, Card, PageHeader } from "@/components/ui";
import { ArrowRightIcon, CalendarIcon, PencilIcon } from "@/components/icons";
import { AnalysisStatus } from "@/app/(app)/profiles/[learnerId]/analysis-status";
import { SkillLevelBadge } from "@/components/skill-level";
import { OverviewText } from "@/components/overview-text";
import { CourseFilter } from "@/app/(app)/profiles/[learnerId]/course-filter";
import { readCourseOverview } from "@/lib/skills/overview";
import { DownloadPdfButton } from "@/app/(app)/profiles/[learnerId]/download-pdf-button";
import { courseCode, shortFormName } from "@/lib/course-code";
import {
  getSkillFramework,
  readInsightEdits,
  readSkillRatings,
  type SkillFramework,
  type SkillLevel,
  type SkillRatings,
} from "@/lib/skills/frameworks";
import { readWorkshopRatings, workshopFramework, workshopLabel } from "@/lib/workshops";

type Bullet = {
  label: string;
  href: string | null;
  tooltip?: string;
  courses: string[];
  level?: SkillLevel;
  /** Skill bullets open their evidence in place instead of linking away. */
  detail?: { summary: string; editedBy?: string; evidence: { quote: string; form: string; href: string | null }[] };
};

function BulletTags({ item }: { item: Bullet }) {
  return (
    <>
      {item.level && <SkillLevelBadge level={item.level} />}
      {item.courses.map((c) => (
        <span key={c} className="rounded-full bg-surface-pale px-2 py-0.5 text-xs font-medium text-foreground-muted">
          {c}
        </span>
      ))}
    </>
  );
}

function BulletList({ items }: { items: Bullet[] }) {
  if (items.length === 0) return <p className="text-sm text-foreground-muted">Needs further evidence.</p>;
  return (
    <ul className="list-disc space-y-4 pl-5 text-sm leading-relaxed text-foreground marker:text-foreground-muted">
      {items.map((item, i) =>
        item.detail ? (
          <li key={i}>
            <details className="group">
              <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-foreground underline decoration-dotted underline-offset-2 group-hover:text-isl-blue">
                    {item.label}
                  </span>
                  <BulletTags item={item} />
                </div>
              </summary>
              <div className="mt-2 rounded-lg bg-surface-pale p-3">
                <p className="text-sm leading-relaxed text-foreground">{item.detail.summary}</p>
                {item.detail.editedBy && (
                  <p className="mt-1 text-xs text-foreground-muted">Edited by {item.detail.editedBy}</p>
                )}
                <ul className="mt-3 space-y-3 border-l-2 border-border pl-3">
                  {item.detail.evidence.map((e, j) => (
                    <li key={j}>
                      <p className="text-foreground">&ldquo;{e.quote}&rdquo;</p>
                      <p className="mt-0.5 text-xs text-foreground-muted">
                        {e.href ? (
                          <Link href={e.href} className="hover:text-isl-blue hover:underline">
                            {e.form}
                          </Link>
                        ) : (
                          e.form
                        )}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            </details>
          </li>
        ) : (
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
              <BulletTags item={item} />
            </div>
          </li>
        ),
      )}
    </ul>
  );
}

// One side of the weekly Pre → Post table.
function WeekLevel({ level }: { level: SkillLevel | null }) {
  return (
    <span className="inline-flex w-32 justify-center">
      {!level || level === "not_enough_evidence" ? (
        <span className="text-xs text-foreground-muted">—</span>
      ) : (
        <SkillLevelBadge level={level} />
      )}
    </span>
  );
}

type RatedSet = { framework: SkillFramework | null; ratings: SkillRatings | undefined; tag: string | null };

// Strengths and development focus come from fixed skill ratings (see
// lib/skills) — every learner in a course (or week) is judged on the same skills.
function skillBullets(sets: RatedSet[], levels: SkillLevel[]): Bullet[] {
  const bullets: Bullet[] = [];
  for (const level of levels) {
    for (const { framework, ratings, tag } of sets) {
      if (!framework || !ratings) continue;
      for (const skill of framework.skills) {
        const rating = ratings.skills.find((s) => s.key === skill.key);
        if (rating?.level !== level) continue;
        bullets.push({
          label: skill.name,
          href: null,
          courses: tag ? [tag] : [],
          level: levels.length > 1 ? level : undefined,
          detail: {
            summary: rating.summary,
            editedBy: rating.editedBy,
            evidence: rating.evidence.map((e) => ({
              quote: e.quote,
              form: shortFormName(e.form),
              href: e.processingResultId ? `/reviews/${e.processingResultId}` : null,
            })),
          },
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
  const { environment: environmentFilter, workshop: workshopFilter, updating, saved } = await searchParams;
  const selectedEnvironmentId = typeof environmentFilter === "string" ? environmentFilter : null;
  const supabase = await createClient();

  // Weeks of the picked course this learner has weekly insights for, and the
  // week picked with ?workshop=<id>, which switches the page to that week.
  const { data: weekRows } = selectedEnvironmentId
    ? await supabase
        .from("workshop_insights")
        .select(
          "overview, skill_ratings, pre_ratings, post_ratings, updated_at, workshops!inner(id, environment_id, week_number, title, skill_framework, learning_objectives)",
        )
        .eq("learner_id", learnerId)
        .eq("workshops.environment_id", selectedEnvironmentId)
    : { data: [] };
  const weeks = (weekRows ?? []).sort((a, b) => a.workshops.week_number - b.workshops.week_number);
  const selectedWeek = weeks.find((w) => w.workshops.id === workshopFilter) ?? null;
  // A week picked that has no insight for this learner yet still shows as that week.
  const emptyWeek =
    typeof workshopFilter === "string" && !selectedWeek && selectedEnvironmentId
      ? (
          await supabase
            .from("workshops")
            .select("week_number, title")
            .eq("id", workshopFilter)
            .eq("environment_id", selectedEnvironmentId)
            .maybeSingle()
        ).data
      : null;
  const weekMode = Boolean(selectedWeek || emptyWeek);

  const [
    { data: learner, error },
    { data: environments },
    { data: allApprovedInsights },
    { data: artifacts },
    { data: learnerProfile },
  ] =
    await Promise.all([
      supabase.from("learners").select("*").eq("id", learnerId).single(),
      supabase
        .from("learner_environments")
        .select("learning_environments(id, name, skill_framework)")
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
      supabase.from("learner_profiles").select("summary, updated_at").eq("learner_id", learnerId).maybeSingle(),
    ]);

  if (error || !learner) notFound();

  const allCourses = (environments ?? [])
    .map((e) => e.learning_environments)
    .filter((e): e is NonNullable<typeof e> => Boolean(e))
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

  // Overview: one course picked -> that course's overview; otherwise the
  // all-courses overview stored on the learner's profile.
  const latestCourseInsight = selectedEnvironmentId
    ? [...approvedInsights].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).find((i) => readCourseOverview(i.approved_output))
    : undefined;
  const overview = weekMode
    ? selectedWeek?.overview
      ? { text: selectedWeek.overview, updatedAt: selectedWeek.updated_at, editedBy: undefined }
      : null
    : latestCourseInsight
    ? {
        text: readCourseOverview(latestCourseInsight.approved_output)!,
        updatedAt: latestCourseInsight.updated_at,
        editedBy: readInsightEdits(latestCourseInsight.approved_output).overview_edited_by,
      }
    : !selectedEnvironmentId && learnerProfile?.summary
      ? { text: learnerProfile.summary, updatedAt: learnerProfile.updated_at, editedBy: undefined }
      : null;

  const showCourse = !selectedEnvironmentId && courses.length > 1;
  const ratedSets: RatedSet[] = weekMode
    ? selectedWeek && courses[0]
      ? [
          {
            framework: workshopFramework(selectedWeek.workshops, courses[0].name),
            ratings: readWorkshopRatings(selectedWeek.skill_ratings) ?? undefined,
            tag: null,
          },
        ]
      : []
    : courses.map((c) => ({
        framework: getSkillFramework(c),
        ratings: ratingsByEnvironment.get(c.id),
        tag: showCourse ? courseCode(c.name) : null,
      }));
  // Weekly view: each skill's level from the Pre form and from the Post form.
  const weekFramework = selectedWeek && courses[0] ? workshopFramework(selectedWeek.workshops, courses[0].name) : null;
  const weekPre = selectedWeek ? readWorkshopRatings(selectedWeek.pre_ratings) : null;
  const weekPost = selectedWeek ? readWorkshopRatings(selectedWeek.post_ratings) : null;
  const weekChanges =
    weekFramework && (weekPre || weekPost)
      ? weekFramework.skills.map((skill) => ({
          name: skill.name,
          pre: weekPre?.skills.find((s) => s.key === skill.key)?.level ?? null,
          post: weekPost?.skills.find((s) => s.key === skill.key)?.level ?? null,
        }))
      : [];
  const strengths = skillBullets(ratedSets, ["strong"]);
  const needs = skillBullets(ratedSets, ["needs_support", "developing"]);

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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <BackLink
          fallbackHref={
            !selectedEnvironmentId
              ? "/"
              : weekMode && typeof workshopFilter === "string"
                ? `/learning-environments/${selectedEnvironmentId}/workshops/${workshopFilter}`
                : `/learning-environments/${selectedEnvironmentId}/students`
          }
        />
        <Link href={`/learners/${learner.id}`} className="text-sm font-medium text-foreground-muted hover:text-isl-blue hover:underline">
          Manage learner record
        </Link>
      </div>

      <div className="mt-4">
        <PageHeader
          title={learner.display_name}
          action={
            <div className="flex items-center gap-2">
              {/* Opened from a course or week, the course is already known: the
                  week tabs below switch views instead. */}
              {!selectedEnvironmentId && <CourseFilter environments={allCourses} selected={null} />}
              {!weekMode && (
                <>
                  <Link
                    href={`/profiles/${learner.id}/edit${selectedEnvironmentId ? `?environment=${selectedEnvironmentId}` : ""}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground-muted transition-colors hover:bg-surface-pale hover:text-foreground"
                  >
                    <PencilIcon className="h-4 w-4" />
                    Edit insights
                  </Link>
                  <DownloadPdfButton
                    href={`/api/learners/${learner.id}/report${selectedEnvironmentId ? `?environment=${selectedEnvironmentId}` : ""}`}
                  />
                </>
              )}
            </div>
          }
        />
      </div>

      <AnalysisStatus learnerId={learner.id} runId={typeof updating === "string" ? updating : null} />
      {saved === "1" && (
        <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-success">
          Your changes are saved. They will be kept the next time this student is analyzed.
        </div>
      )}

      {selectedEnvironmentId && courses[0] && (
        <nav aria-label="Week" className="mt-6 flex flex-wrap gap-2">
          {[
            { id: null as string | null, label: `${courseCode(courses[0].name)} · Whole course` },
            ...weeks.map((w) => ({ id: w.workshops.id as string | null, label: `Week ${w.workshops.week_number}` })),
          ].map((tab) => {
            const active = tab.id ? tab.id === workshopFilter : !weekMode;
            return (
              <Link
                key={tab.id ?? "course"}
                href={`/profiles/${learner.id}?environment=${selectedEnvironmentId}${tab.id ? `&workshop=${tab.id}` : ""}`}
                replace
                className={`rounded-full px-3 py-1 text-sm font-medium ${
                  active ? "bg-isl-blue text-white" : "bg-surface-pale text-foreground-muted hover:text-foreground"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      )}

      <Card className="mt-6">
        <h2 className="text-base font-semibold text-foreground">
          Overview
          {(selectedWeek || emptyWeek) && (
            <span className="font-normal text-foreground-muted"> · {workshopLabel(selectedWeek?.workshops ?? emptyWeek!)}</span>
          )}
        </h2>
        <div className="mt-4 border-t border-border pt-4">
          {overview ? (
            <>
              <OverviewText text={overview.text} />
              <p className="mt-3 flex items-center gap-1.5 text-xs text-foreground-muted">
                <CalendarIcon className="h-3.5 w-3.5" />
                Updated {new Date(overview.updatedAt).toLocaleDateString()}
                {overview.editedBy && ` · edited by ${overview.editedBy}`}
              </p>
            </>
          ) : (
            <p className="text-sm text-foreground-muted">
              {weekMode
                ? "No insights for this week yet. Open the week on the course page and click “Update this week”."
                : courses.length > 0 && courses.every((c) => !getSkillFramework(c))
                ? "This course has no skills set up yet, so there is nothing to rate. Add them on the course page, then click “Update all students”."
                : "No overview yet. Open the learner record and click Analyze for a course."}
            </p>
          )}
        </div>
      </Card>

      {weekMode && weekChanges.length > 0 && (
        <Card className="mt-6">
          <h2 className="text-base font-semibold text-foreground">Pre → Post</h2>
          <p className="mt-1 text-xs text-foreground-muted">
            Before class (Pre form) and after class (Post form). — means that form&apos;s answers didn&apos;t show the skill,
            usually because it didn&apos;t ask about it.
          </p>
          <ul className="mt-4 divide-y divide-border border-t border-border">
            {weekChanges.map((c) => (
              <li key={c.name} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <span className="font-medium text-foreground">{c.name}</span>
                <span className="flex items-center gap-2">
                  <WeekLevel level={c.pre} />
                  <ArrowRightIcon className="h-3.5 w-3.5 text-foreground-muted" />
                  <WeekLevel level={c.post} />
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <AccentCard accent="blue" title="Strengths">
          <BulletList items={strengths} />
        </AccentCard>
        <AccentCard accent="orange" title="Development focus">
          <BulletList items={needs} />
        </AccentCard>
        {!weekMode && (
          <>
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
                      {getSkillFramework(c) && (
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
          </>
        )}
      </div>

      {!weekMode && (
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
      )}
    </div>
  );
}
