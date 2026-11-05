import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, EntityHero, SecondaryButton } from "@/components/ui";
import { ArrowRightIcon, BuildingIcon, PencilIcon } from "@/components/icons";
import { BackLink } from "@/components/back-link";
import { ArchiveButton } from "@/app/(app)/learning-environments/[id]/archive-button";
import { CourseSkillsEditor } from "@/app/(app)/learning-environments/[id]/course-skills-editor";
import { AddWorkshopForm } from "@/app/(app)/learning-environments/[id]/add-workshop-form";
import { CourseAdminDetails } from "@/app/(app)/learning-environments/[id]/course-admin-details";
import { saveCourseSkills } from "@/app/actions/course";
import { workshopLabel } from "@/lib/workshops";
import { courseCode } from "@/lib/course-code";
import { getSkillFramework } from "@/lib/skills/frameworks";

// A course: the whole course plus one row per workshop week. Each opens a
// page with that part's students, upload and update. The course's own skills
// sit behind "Course settings"; system numbers are for admins only.
export default async function LearningEnvironmentDetailPage({ params }: PageProps<"/learning-environments/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: env, error }, { count: learnerCount }, { data: workshops }, { data: profile }] = await Promise.all([
    supabase.from("learning_environments").select("*").eq("id", id).single(),
    supabase.from("learner_environments").select("id", { count: "exact", head: true }).eq("environment_id", id),
    supabase
      .from("workshops")
      .select("id, week_number, title, workshop_date, skill_framework, datasets(id)")
      .eq("environment_id", id)
      .order("week_number"),
    supabase.from("profiles").select("role").eq("id", user?.id ?? "").maybeSingle(),
  ]);
  if (error || !env) notFound();

  const framework = getSkillFramework(env);
  const rowClass = "flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm hover:bg-surface-pale";

  return (
    <div>
      <BackLink fallbackHref="/" />
      <div className="mt-4">
        <EntityHero
          avatarIcon={BuildingIcon}
          title={env.name}
          badge={env.status === "active" ? undefined : <Badge tone="neutral">{env.status}</Badge>}
        />
      </div>

      <Card className="mt-6">
        <ul className="divide-y divide-border rounded-lg border border-border">
          <li>
            <Link href={`/learning-environments/${env.id}/students`} className={rowClass}>
              <span className="font-semibold text-foreground">Whole course</span>
              <span className="inline-flex items-center gap-1 text-xs text-foreground-muted">
                {learnerCount ?? 0} students <ArrowRightIcon className="h-3.5 w-3.5" />
              </span>
            </Link>
          </li>
          {(workshops ?? []).map((w) => (
            <li key={w.id}>
              <Link href={`/learning-environments/${env.id}/workshops/${w.id}`} className={rowClass}>
                <span className="font-medium text-foreground">{workshopLabel(w)}</span>
                <span className="inline-flex items-center gap-1 text-xs text-foreground-muted">
                  {[
                    w.workshop_date
                      ? new Date(`${w.workshop_date}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
                      : null,
                    `${w.datasets.length} form${w.datasets.length === 1 ? "" : "s"}`,
                    w.skill_framework ? null : "no skills yet",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  <ArrowRightIcon className="h-3.5 w-3.5" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-4">
          <AddWorkshopForm
            environmentId={env.id}
            nextWeek={Math.max(0, ...(workshops ?? []).map((w) => w.week_number)) + 1}
          />
        </div>
      </Card>

      <details className="group mt-4" open={!framework}>
        <summary className="cursor-pointer list-none text-sm font-medium text-isl-blue hover:underline [&::-webkit-details-marker]:hidden">
          <span className="group-open:hidden">Course settings</span>
          <span className="hidden group-open:inline">Hide course settings</span>
        </summary>
        <Card className="mt-4">
          <h2 className="text-base font-semibold text-foreground">Course skills</h2>
          <p className="mb-4 mt-1 text-sm text-foreground-muted">
            Every student in {courseCode(env.name)} is rated on these skills across the whole course, so they can be compared
            across the class. Each week also has its own skills, set on that week&apos;s page.
          </p>
          <CourseSkillsEditor
            save={saveCourseSkills.bind(null, env.id)}
            initialSkills={(framework?.skills ?? []).map((s) => ({ key: s.key, name: s.name, description: s.description }))}
            savedMessage="Saved. Open “Whole course” and click “Re-rate everyone” to rate everyone on these skills."
          />
          <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-4">
            <Link href={`/learning-environments/${env.id}/edit`}>
              <SecondaryButton>
                <PencilIcon className="h-4 w-4" />
                Edit course details
              </SecondaryButton>
            </Link>
            <ArchiveButton id={env.id} name={env.name} status={env.status} />
          </div>
        </Card>
      </details>

      {profile?.role === "admin" && (
        <details className="group mt-4">
          <summary className="cursor-pointer list-none text-sm font-medium text-foreground-muted hover:underline [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">Admin details</span>
            <span className="hidden group-open:inline">Hide admin details</span>
          </summary>
          <div className="mt-4">
            <CourseAdminDetails env={env} />
          </div>
        </details>
      )}
    </div>
  );
}
