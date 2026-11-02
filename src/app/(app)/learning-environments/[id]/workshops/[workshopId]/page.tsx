import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BackLink } from "@/components/back-link";
import { Card, IconCard, PageHeader, SecondaryButton } from "@/components/ui";
import { LightBulbIcon, UserIcon } from "@/components/icons";
import { CourseSkillsEditor } from "@/app/(app)/learning-environments/[id]/course-skills-editor";
import { UpdateAllStudents } from "@/app/(app)/learning-environments/[id]/update-all-students";
import { listWorkshopStudents, saveWorkshopSkills, setFileWorkshop } from "@/app/actions/workshops";
import { courseCode } from "@/lib/course-code";
import { workshopFramework, workshopLabel } from "@/lib/workshops";

// "Update this week" runs one server request per student from this page.
export const maxDuration = 300;

// One week of a course: the students who sent in this week's forms (each opens
// their weekly insights), then the week's skills and forms, folded away.
export default async function WorkshopPage({ params }: PageProps<"/learning-environments/[id]/workshops/[workshopId]">) {
  const { id, workshopId } = await params;
  const supabase = await createClient();

  const [{ data: workshop }, { data: env }, { data: courseFiles }, { data: weekInsights }] = await Promise.all([
    supabase.from("workshops").select("*").eq("id", workshopId).eq("environment_id", id).single(),
    supabase.from("learning_environments").select("id, name").eq("id", id).single(),
    supabase
      .from("datasets")
      .select("id, name, record_count, workshop_id, created_at")
      .eq("environment_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("workshop_insights").select("learner_id").eq("workshop_id", workshopId),
  ]);
  if (!workshop || !env) notFound();

  const students = await listWorkshopStudents(workshopId);
  const updated = new Set((weekInsights ?? []).map((w) => w.learner_id));
  const framework = workshopFramework(workshop, env.name);
  const weekFiles = (courseFiles ?? []).filter((f) => f.workshop_id === workshop.id);
  const otherFiles = (courseFiles ?? []).filter((f) => !f.workshop_id);

  return (
    <div>
      <BackLink fallbackHref={`/learning-environments/${env.id}`} />

      <div className="mt-4">
        <PageHeader
          title={workshopLabel(workshop)}
          description={[
            courseCode(env.name),
            workshop.workshop_date
              ? new Date(`${workshop.workshop_date}T00:00:00`).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
              : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        />
      </div>

      <div className="mt-6">
        <IconCard icon={UserIcon} title={`Students (${students.length})`}>
          {students.length > 0 ? (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {students.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/profiles/${s.id}?environment=${env.id}&workshop=${workshop.id}`}
                    className="flex items-center justify-between gap-2 px-4 py-3 text-sm hover:bg-surface-pale"
                  >
                    <span className="font-medium text-isl-blue">{s.name}</span>
                    {!updated.has(s.id) && <span className="text-xs text-foreground-muted">not updated yet</span>}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-foreground-muted">
              No students yet. Upload this week&apos;s form files under “Week settings” below.
            </p>
          )}
          <div className="mt-4">
            <UpdateAllStudents
              environmentId={env.id}
              workshopId={workshop.id}
              disabledReason={!framework ? "Add and save this week's skills below first." : null}
            />
          </div>
        </IconCard>
      </div>

      <details className="group mt-4" open={!framework || weekFiles.length === 0}>
        <summary className="cursor-pointer list-none text-sm font-medium text-isl-blue hover:underline [&::-webkit-details-marker]:hidden">
          <span className="group-open:hidden">Show week settings (skills and forms)</span>
          <span className="hidden group-open:inline">Hide week settings</span>
        </summary>

        <div className="mt-4 space-y-4">
          <IconCard icon={LightBulbIcon} iconClassName="bg-amber-50 text-amber-600" title="This week's skills">
            <p className="mb-4 text-sm text-foreground-muted">
              Students are rated on these skills using only this week&apos;s forms. Match them to the workshop and lecture
              slides.
            </p>
            <CourseSkillsEditor
              save={saveWorkshopSkills.bind(null, workshop.id)}
              initialSkills={(framework?.skills ?? []).map((s) => ({ key: s.key, name: s.name, description: s.description }))}
              savedMessage="Saved. Click “Update this week” to rate everyone on these skills."
            />
          </IconCard>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-foreground">This week&apos;s forms</h2>
              <Link
                href={`/datasets/new?environment=${env.id}&workshop=${workshop.id}&returnTo=/learning-environments/${env.id}`}
              >
                <SecondaryButton>Upload a form file</SecondaryButton>
              </Link>
            </div>
            {weekFiles.length > 0 ? (
              <ul className="mt-3 space-y-2 text-sm">
                {weekFiles.map((f) => (
                  <li key={f.id} className="flex flex-wrap items-center justify-between gap-2">
                    <Link href={`/datasets/${f.id}`} className="text-foreground hover:text-isl-blue hover:underline">
                      {f.name} <span className="text-foreground-muted">({f.record_count} rows)</span>
                    </Link>
                    <form action={setFileWorkshop.bind(null, f.id, null, env.id)}>
                      <button type="submit" className="text-xs text-foreground-muted hover:text-danger">
                        Remove from this week
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-foreground-muted">No forms in this week yet.</p>
            )}

            {otherFiles.length > 0 && (
              <div className="mt-5 border-t border-border pt-4">
                <p className="text-sm font-medium text-foreground">Already uploaded to {courseCode(env.name)}, not in any week</p>
                <ul className="mt-2 space-y-2 text-sm">
                  {otherFiles.map((f) => (
                    <li key={f.id} className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-foreground-muted">{f.name}</span>
                      <form action={setFileWorkshop.bind(null, f.id, workshop.id, env.id)}>
                        <button type="submit" className="text-xs font-medium text-isl-blue hover:underline">
                          Add to this week
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        </div>
      </details>
    </div>
  );
}
