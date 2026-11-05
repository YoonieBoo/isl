import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BackLink } from "@/components/back-link";
import { Card, PageHeader, PrimaryButton } from "@/components/ui";
import { CourseSkillsEditor } from "@/app/(app)/learning-environments/[id]/course-skills-editor";
import { QuickUpload } from "@/app/(app)/learning-environments/[id]/quick-upload";
import { StudentList, UploadBanner, splitPending } from "@/app/(app)/learning-environments/[id]/student-list";
import { UpdateAllStudents } from "@/app/(app)/learning-environments/[id]/update-all-students";
import {
  applyWeekSuggestions,
  listWorkshopStudents,
  saveWorkshopDetails,
  saveWorkshopSkills,
  setFileStage,
  setFileWorkshop,
} from "@/app/actions/workshops";
import { RefreshSummaryButton } from "@/app/(app)/learning-environments/[id]/workshops/[workshopId]/refresh-summary-button";
import { OverviewText } from "@/components/overview-text";
import { readClassSummary } from "@/lib/class-summary";
import { readLearningContext } from "@/lib/week-materials";
import { ReadMaterials } from "@/app/(app)/learning-environments/[id]/workshops/[workshopId]/read-materials";
import { WeekDetailsForm } from "@/app/(app)/learning-environments/[id]/workshops/[workshopId]/week-details-form";
import { courseCode } from "@/lib/course-code";
import { FORM_STAGE_LABEL, workshopFramework, workshopLabel, type FormStageValue } from "@/lib/workshops";

const STAGES: FormStageValue[] = ["pre", "post", "other"];
const STAGE_HINT: Record<FormStageValue, string> = {
  pre: "before class",
  post: "after class",
  other: "not used for Pre → Post",
};

// "Update students" runs one server request per student from this page.
export const maxDuration = 300;

// One week of a course: upload its forms and update, then the students who
// sent in this week's forms (each opens their weekly insights). The week's
// skills and files sit behind "Week settings".
export default async function WorkshopPage({
  params,
  searchParams,
}: PageProps<"/learning-environments/[id]/workshops/[workshopId]">) {
  const { id, workshopId } = await params;
  const { uploaded, failed } = await searchParams;
  const supabase = await createClient();

  const [{ data: workshop }, { data: env }, { data: courseFiles }, { data: weekInsights }] = await Promise.all([
    supabase.from("workshops").select("*").eq("id", workshopId).eq("environment_id", id).single(),
    supabase.from("learning_environments").select("id, name").eq("id", id).single(),
    supabase
      .from("datasets")
      .select("id, name, record_count, workshop_id, form_stage, validation_status, validation_summary")
      .eq("environment_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("workshop_insights").select("learner_id, updated_at").eq("workshop_id", workshopId),
  ]);
  if (!workshop || !env) notFound();

  const updated = new Set((weekInsights ?? []).map((w) => w.learner_id));
  const students = (await listWorkshopStudents(workshopId)).map((s) => ({
    ...s,
    href: `/profiles/${s.id}?environment=${env.id}&workshop=${workshop.id}`,
    note: updated.has(s.id) ? undefined : "not updated yet",
  }));
  const framework = workshopFramework(workshop, env.name);
  const weekFiles = (courseFiles ?? []).filter((f) => f.workshop_id === workshop.id);
  const otherFiles = (courseFiles ?? []).filter((f) => !f.workshop_id);
  const { matching, needsColumns } = splitPending(weekFiles.filter((f) => f.validation_status === "pending"));
  const here = `/learning-environments/${env.id}/workshops/${workshop.id}`;
  const summary = readClassSummary(workshop.class_summary);
  const learning = readLearningContext(workshop.learning_context);
  const latestInsight = (weekInsights ?? []).reduce((m, w) => (w.updated_at > m ? w.updated_at : m), "");
  const summaryStale = Boolean(summary && latestInsight > summary.updatedAt);

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
      <UploadBanner
        uploaded={Number(uploaded) || 0}
        failed={Number(failed) || 0}
        matching={matching}
        needsColumns={needsColumns}
      />

      <Card className="mt-6">
        <div className="flex flex-wrap items-start gap-3">
          <QuickUpload environmentId={env.id} workshopId={workshop.id} returnTo={here} />
          <UpdateAllStudents
            environmentId={env.id}
            workshopId={workshop.id}
            disabledReason={
              !framework
                ? "Set this week's skills first (Week settings below)."
                : matching
                  ? "Still matching students from your upload…"
                  : null
            }
          />
        </div>
        {weekFiles.length > 0 && (
          <ul className="mt-4 space-y-1 text-xs text-foreground-muted">
            {weekFiles.map((f) => {
              const stage = (f.form_stage ?? "other") as FormStageValue;
              return (
                <li key={f.id}>
                  <span
                    className={`mr-2 inline-block w-12 rounded-full px-2 py-0.5 text-center font-medium ${
                      stage === "other" ? "bg-surface-pale text-foreground-muted" : "bg-isl-blue-pale text-isl-blue-dark"
                    }`}
                  >
                    {FORM_STAGE_LABEL[stage]}
                  </span>
                  {f.name}
                </li>
              );
            })}
          </ul>
        )}
        {(weekInsights ?? []).length > 0 && (
          <div className="mt-6 rounded-lg border border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-foreground">Class summary</h2>
              {summary ? (
                <span className="flex items-center gap-3 text-xs text-foreground-muted">
                  {summaryStale ? "Students were updated since this was written." : `${summary.students} students`}
                  <RefreshSummaryButton workshopId={workshop.id} label={summaryStale ? "Update summary" : "Rewrite"} />
                </span>
              ) : (
                <RefreshSummaryButton workshopId={workshop.id} label="Write class summary" />
              )}
            </div>
            {summary && (
              <>
                <div className="mt-3">
                  <OverviewText text={summary.text} />
                </div>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[32rem] text-xs">
                    <thead>
                      <tr className="border-b border-border text-left text-foreground-muted">
                        <th className="py-2 pr-3 font-medium">Skill</th>
                        <th className="py-2 pr-3 font-medium">Improved Pre → Post</th>
                        <th className="py-2 pr-3 font-medium">After class</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.skills.map((s) => (
                        <tr key={s.key} className="border-b border-border last:border-0">
                          <td className="py-2 pr-3 font-medium text-foreground">{s.name}</td>
                          <td className="py-2 pr-3 text-foreground">
                            {s.compared > 0 ? `${s.improved} of ${s.compared}` : <span className="text-foreground-muted">—</span>}
                          </td>
                          <td className="py-2 pr-3 text-foreground-muted">
                            <span className="text-emerald-700">{s.latest.strong} strong</span> ·{" "}
                            <span className="text-amber-700">{s.latest.developing} developing</span> ·{" "}
                            <span className="text-red-700">{s.latest.needs_support} need support</span>
                            {s.latest.not_shown > 0 && ` · ${s.latest.not_shown} not shown`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
        <h2 className="mt-6 text-base font-semibold text-foreground">Students ({students.length})</h2>
        <div className="mt-3">
          <StudentList students={students} emptyText="No students yet. Upload this week's form files to add them." />
        </div>
      </Card>

      <details className="group mt-4" open={!framework}>
        <summary className="cursor-pointer list-none text-sm font-medium text-isl-blue hover:underline [&::-webkit-details-marker]:hidden">
          <span className="group-open:hidden">Week settings</span>
          <span className="hidden group-open:inline">Hide week settings</span>
        </summary>

        <div className="mt-4 space-y-4">
          <Card>
            <h2 className="text-base font-semibold text-foreground">Teaching materials</h2>
            <p className="mb-4 mt-1 text-sm text-foreground-muted">
              Upload this week&apos;s slides and workshop instructions. The AI reads them and suggests the week&apos;s
              objectives and skills; nothing changes until you click “Use these”. The key concepts are also used when rating
              students.
            </p>
            <ReadMaterials workshopId={workshop.id} again={Boolean(learning)} />
            {learning && (
              <div className="mt-5 space-y-4 border-t border-border pt-4 text-sm">
                <p className="text-xs text-foreground-muted">
                  Read from {learning.materials.map((m) => m.name).join(", ")} on{" "}
                  {new Date(learning.readAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </p>
                {[
                  { title: "Suggested objectives", items: learning.suggestedObjectives },
                  { title: "Key concepts", items: learning.keyConcepts },
                  { title: "What a good answer shows", items: learning.goodAnswers },
                ].map((block) => (
                  <div key={block.title}>
                    <p className="font-medium text-foreground">{block.title}</p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-foreground-muted">
                      {block.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ))}
                <div>
                  <p className="font-medium text-foreground">Suggested skills</p>
                  <ul className="mt-1 space-y-1.5">
                    {learning.suggestedSkills.map((skill) => (
                      <li key={skill.name}>
                        <span className="font-medium text-foreground">{skill.name}</span>
                        <span className="text-foreground-muted"> — {skill.description}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                {(learning.notAskedInForms ?? []).length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-warning">
                    <p className="font-medium">Not asked in this week&apos;s Pre or Post forms</p>
                    <ul className="mt-1 list-disc pl-5">
                      {learning.notAskedInForms!.map((o) => (
                        <li key={o}>{o}</li>
                      ))}
                    </ul>
                    <p className="mt-1 text-xs">
                      Students&apos; individual answers can&apos;t show these. Add a question about them to next week&apos;s forms.
                    </p>
                  </div>
                )}
                {learning.appliedAt && learning.appliedAt > learning.readAt ? (
                  <p className="text-sm text-success">
                    In use since {new Date(learning.appliedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}.
                    Edit them below if needed.
                  </p>
                ) : (
                  <form action={applyWeekSuggestions.bind(null, workshop.id)} className="flex flex-wrap items-center gap-3">
                    <PrimaryButton type="submit">Use these objectives and skills</PrimaryButton>
                    <span className="text-xs text-foreground-muted">
                      Replaces the week&apos;s current objectives and skills. Then click “Re-rate everyone”.
                    </span>
                  </form>
                )}
              </div>
            )}
          </Card>

          <Card>
            <h2 className="mb-4 text-base font-semibold text-foreground">Week details</h2>
            <WeekDetailsForm
              save={saveWorkshopDetails.bind(null, workshop.id)}
              title={workshop.title}
              date={workshop.workshop_date}
              objectives={workshop.learning_objectives}
            />
          </Card>

          <Card>
            <h2 className="text-base font-semibold text-foreground">This week&apos;s skills</h2>
            <p className="mb-4 mt-1 text-sm text-foreground-muted">
              Students are rated on these skills using only this week&apos;s forms. Match them to the workshop and lecture
              slides.
            </p>
            <CourseSkillsEditor
              save={saveWorkshopSkills.bind(null, workshop.id)}
              initialSkills={(framework?.skills ?? []).map((s) => ({ key: s.key, name: s.name, description: s.description }))}
              savedMessage="Saved. Click “Re-rate everyone” above to rate everyone on these skills."
            />
          </Card>

          <Card>
            <h2 className="text-base font-semibold text-foreground">This week&apos;s form files</h2>
            <p className="mt-1 text-sm text-foreground-muted">
              Pre is the form students answer before class; Post is the one after class (e.g. the Learning Reflection).
              Insights compare the two. Team answers belong in Other.
            </p>
            {weekFiles.length > 0 ? (
              <ul className="mt-3 space-y-3 text-sm">
                {weekFiles.map((f) => (
                  <li key={f.id} className="flex flex-wrap items-center justify-between gap-2">
                    <Link href={`/datasets/${f.id}`} className="text-foreground hover:text-isl-blue hover:underline">
                      {f.name} <span className="text-foreground-muted">({f.record_count} rows)</span>
                    </Link>
                    <div className="flex items-center gap-3">
                      <div className="inline-flex overflow-hidden rounded-lg border border-border">
                        {STAGES.map((stage) => (
                          <form key={stage} action={setFileStage.bind(null, f.id, stage, workshop.id, env.id)}>
                            <button
                              type="submit"
                              title={STAGE_HINT[stage]}
                              className={`px-3 py-1 text-xs font-medium ${
                                (f.form_stage ?? "other") === stage
                                  ? "bg-isl-blue text-white"
                                  : "text-foreground-muted hover:bg-surface-pale"
                              }`}
                            >
                              {FORM_STAGE_LABEL[stage]}
                            </button>
                          </form>
                        ))}
                      </div>
                      <form action={setFileWorkshop.bind(null, f.id, null, env.id)}>
                        <button type="submit" className="text-xs text-foreground-muted hover:text-danger">
                          Remove
                        </button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-foreground-muted">No form files in this week yet.</p>
            )}

            {otherFiles.length > 0 && (
              <div className="mt-5 border-t border-border pt-4">
                <p className="text-sm font-medium text-foreground">Uploaded to {courseCode(env.name)} but not in any week</p>
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
