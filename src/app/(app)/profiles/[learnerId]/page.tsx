import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, PageHeader } from "@/components/ui";
import { ArrowLeftIcon, ArrowRightIcon } from "@/components/icons";
import { SkillLevelBadge, SkillLevelLegend } from "@/components/skill-level";
import { CourseFilter } from "@/app/(app)/profiles/[learnerId]/course-filter";
import { courseCode, shortFormName } from "@/lib/course-code";
import { getSkillFramework, readSkillRatings, type SkillRatings } from "@/lib/skills/frameworks";

function CourseSkills({
  environmentId,
  environmentName,
  ratings,
}: {
  environmentId: string;
  environmentName: string;
  ratings: SkillRatings | null;
}) {
  const framework = getSkillFramework(environmentName);
  const header = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-lg font-semibold text-foreground">{courseCode(environmentName)}</h2>
      {framework && (
        <Link
          href={`/learning-environments/${environmentId}/cohort`}
          className="inline-flex items-center gap-1 text-sm font-medium text-isl-blue hover:underline"
        >
          Compare with class <ArrowRightIcon className="h-4 w-4" />
        </Link>
      )}
    </div>
  );

  if (!framework) {
    return (
      <Card>
        {header}
        <p className="mt-3 text-sm text-foreground-muted">No skill list has been set up for this course yet.</p>
      </Card>
    );
  }

  if (!ratings) {
    return (
      <Card>
        {header}
        <p className="mt-3 text-sm text-foreground-muted">
          Not rated yet. Open the learner record and click <span className="font-medium">Analyze</span> for this course.
        </p>
      </Card>
    );
  }

  const ratingByKey = new Map(ratings.skills.map((s) => [s.key, s]));

  return (
    <Card>
      {header}
      {ratings.overview && <p className="mt-3 text-sm leading-relaxed text-foreground">{ratings.overview}</p>}

      <ul className="mt-5 divide-y divide-border border-t border-border">
        {framework.skills.map((skill) => {
          const rating = ratingByKey.get(skill.key);
          const level = rating?.level ?? "not_enough_evidence";
          return (
            <li key={skill.key} className="py-4">
              <div className="flex items-start justify-between gap-4">
                <h3 className="text-sm font-semibold text-foreground" title={skill.description}>
                  {skill.name}
                </h3>
                <SkillLevelBadge level={level} />
              </div>
              {rating?.summary && (
                <p className="mt-1.5 text-sm leading-relaxed text-foreground-muted">{rating.summary}</p>
              )}
              {rating && rating.evidence.length > 0 && (
                <details className="group mt-2">
                  <summary className="cursor-pointer list-none text-xs font-medium text-isl-blue hover:underline">
                    <span className="group-open:hidden">Show evidence ({rating.evidence.length})</span>
                    <span className="hidden group-open:inline">Hide evidence</span>
                  </summary>
                  <ul className="mt-2 space-y-3 border-l-2 border-border pl-3">
                    {rating.evidence.map((e, i) => (
                      <li key={i} className="text-sm" title={e.question}>
                        <p className="text-foreground">&ldquo;{e.quote}&rdquo;</p>
                        <p className="mt-0.5 text-xs text-foreground-muted">
                          {e.processingResultId ? (
                            <Link href={`/reviews/${e.processingResultId}`} className="hover:text-isl-blue hover:underline">
                              {shortFormName(e.form)}
                            </Link>
                          ) : (
                            shortFormName(e.form)
                          )}
                        </p>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </li>
          );
        })}
      </ul>

      <p className="mt-2 text-xs text-foreground-muted">
        Rated from {ratings.answerCount} answers · updated {new Date(ratings.ratedAt).toLocaleDateString()}
      </p>
    </Card>
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

  const [{ data: learner, error }, { data: environments }, { data: insights }, { data: artifacts }] = await Promise.all([
    supabase.from("learners").select("*").eq("id", learnerId).single(),
    supabase
      .from("learner_environments")
      .select("learning_environments(id, name)")
      .eq("learner_id", learnerId),
    supabase
      .from("learner_insights")
      .select("environment_id, approved_output, updated_at")
      .eq("learner_id", learnerId)
      .eq("status", "approved")
      .order("updated_at", { ascending: false }),
    supabase
      .from("portfolio_artifacts")
      .select("id, title, artifact_type, created_at, external_url, file_reference")
      .eq("learner_id", learnerId)
      .order("created_at", { ascending: false }),
  ]);

  if (error || !learner) notFound();

  // Latest skill ratings per course (insights are ordered newest first).
  const ratingsByEnvironment = new Map<string, SkillRatings>();
  for (const insight of insights ?? []) {
    const ratings = readSkillRatings(insight.approved_output);
    if (ratings && !ratingsByEnvironment.has(insight.environment_id)) {
      ratingsByEnvironment.set(insight.environment_id, ratings);
    }
  }

  const courses = (environments ?? [])
    .map((e) => e.learning_environments)
    .filter((e): e is { id: string; name: string } => Boolean(e))
    .sort((a, b) => a.name.localeCompare(b.name));
  const shownCourses = selectedEnvironmentId ? courses.filter((c) => c.id === selectedEnvironmentId) : courses;

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
          description={learner.external_reference ?? undefined}
          action={
            <div className="flex items-center gap-2">
              <CourseFilter environments={courses} selected={selectedEnvironmentId} />
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

      <div className="mt-5">
        <SkillLevelLegend />
      </div>

      <div className="mt-4 space-y-4">
        {shownCourses.length === 0 ? (
          <Card>
            <p className="text-sm text-foreground-muted">Not enrolled in any course yet.</p>
          </Card>
        ) : (
          shownCourses.map((c) => (
            <CourseSkills
              key={c.id}
              environmentId={c.id}
              environmentName={c.name}
              ratings={ratingsByEnvironment.get(c.id) ?? null}
            />
          ))
        )}
      </div>

      {artifactsWithLinks.length > 0 && (
        <Card className="mt-4">
          <h2 className="text-base font-semibold text-foreground">Portfolio</h2>
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
        </Card>
      )}
    </div>
  );
}
