import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BackLink } from "@/components/back-link";
import { Card, PageHeader } from "@/components/ui";
import { ArrowRightIcon } from "@/components/icons";
import { QuickUpload } from "@/app/(app)/learning-environments/[id]/quick-upload";
import { StudentList, UploadBanner, splitPending } from "@/app/(app)/learning-environments/[id]/student-list";
import { UpdateAllStudents } from "@/app/(app)/learning-environments/[id]/update-all-students";
import { courseCode } from "@/lib/course-code";
import { getSkillFramework } from "@/lib/skills/frameworks";

// "Update students" runs one server request per student from this page.
export const maxDuration = 300;

// The whole course: every student, each opening their overall insights.
export default async function CourseStudentsPage({ params, searchParams }: PageProps<"/learning-environments/[id]/students">) {
  const { id } = await params;
  const { uploaded, failed } = await searchParams;
  const supabase = await createClient();

  const [{ data: env }, { data: enrolled }, { data: insights }, { data: pending }] = await Promise.all([
    supabase.from("learning_environments").select("id, name, skill_framework").eq("id", id).single(),
    supabase.from("learner_environments").select("learners(id, display_name)").eq("environment_id", id),
    supabase.from("learner_insights").select("learner_id").eq("environment_id", id).eq("status", "approved"),
    supabase.from("datasets").select("id, name, validation_summary").eq("environment_id", id).eq("validation_status", "pending"),
  ]);
  if (!env) notFound();

  const rated = new Set((insights ?? []).map((i) => i.learner_id));
  const students = (enrolled ?? [])
    .map((e) => e.learners)
    .filter((l): l is NonNullable<typeof l> => Boolean(l))
    .sort((a, b) => a.display_name.localeCompare(b.display_name))
    .map((l) => ({
      id: l.id,
      name: l.display_name,
      href: `/profiles/${l.id}?environment=${env.id}`,
      note: rated.has(l.id) ? undefined : "not updated yet",
    }));
  const { matching, needsColumns } = splitPending(pending ?? []);
  const framework = getSkillFramework(env);

  return (
    <div>
      <BackLink fallbackHref={`/learning-environments/${env.id}`} />
      <div className="mt-4">
        <PageHeader
          title={`${courseCode(env.name)} · Whole course`}
          description="Each student's insights from every form in the course."
          action={
            <Link
              href={`/learning-environments/${env.id}/cohort`}
              className="inline-flex items-center gap-1 text-sm font-medium text-isl-blue hover:underline"
            >
              Class skills <ArrowRightIcon className="h-4 w-4" />
            </Link>
          }
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
          <QuickUpload environmentId={env.id} returnTo={`/learning-environments/${env.id}/students`} />
          <UpdateAllStudents
            environmentId={env.id}
            disabledReason={
              !framework
                ? "Set the course's skills first (Course settings on the course page)."
                : matching
                  ? "Still matching students from your upload…"
                  : null
            }
          />
        </div>
        <p className="mt-3 text-xs text-foreground-muted">
          Forms from a workshop week are best uploaded from that week, so they count for the week too.
        </p>
        <h2 className="mt-6 text-base font-semibold text-foreground">Students ({students.length})</h2>
        <div className="mt-3">
          <StudentList students={students} emptyText="No students yet. Upload a form file to add them." />
        </div>
      </Card>
    </div>
  );
}
