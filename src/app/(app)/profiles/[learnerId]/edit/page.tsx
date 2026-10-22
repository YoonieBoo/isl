import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader } from "@/components/ui";
import { ArrowLeftIcon } from "@/components/icons";
import { CourseFilter } from "@/app/(app)/profiles/[learnerId]/course-filter";
import { EditInsightsForm } from "@/app/(app)/profiles/[learnerId]/edit/edit-form";
import { getSkillFramework, readSkillRatings } from "@/lib/skills/frameworks";
import { readCourseOverview } from "@/lib/skills/overview";

export default async function EditInsightsPage({ params, searchParams }: PageProps<"/profiles/[learnerId]/edit">) {
  const { learnerId } = await params;
  const { environment } = await searchParams;
  const supabase = await createClient();

  const [{ data: learner }, { data: environments }] = await Promise.all([
    supabase.from("learners").select("id, display_name").eq("id", learnerId).single(),
    supabase.from("learner_environments").select("learning_environments(id, name, skill_framework)").eq("learner_id", learnerId),
  ]);
  if (!learner) notFound();

  const courses = (environments ?? [])
    .map((e) => e.learning_environments)
    .filter((e): e is NonNullable<typeof e> => Boolean(e))
    .sort((a, b) => a.name.localeCompare(b.name));
  // Edits are per course; default to the first course.
  const environmentId = typeof environment === "string" ? environment : null;
  if (!environmentId && courses[0]) redirect(`/profiles/${learnerId}/edit?environment=${courses[0].id}`);
  const course = courses.find((c) => c.id === environmentId);

  const { data: insight } = course
    ? await supabase
        .from("learner_insights")
        .select("approved_output")
        .eq("learner_id", learnerId)
        .eq("environment_id", course.id)
        .is("approved_by", null)
        .eq("status", "approved")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  const framework = course ? getSkillFramework(course) : null;
  const ratings = readSkillRatings(insight?.approved_output);
  const preferences = ((insight?.approved_output as { learning_preferences?: string[] } | null)?.learning_preferences ?? [])
    .map((p) => (p.includes(": ") ? p.slice(0, p.indexOf(": ")) : p));

  return (
    <div>
      <Link
        href={`/profiles/${learnerId}${course ? `?environment=${course.id}` : ""}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-isl-blue hover:underline"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Back to insights
      </Link>
      <div className="mt-4">
        <PageHeader
          title={`Edit insights — ${learner.display_name}`}
          description="Correct anything the AI got wrong. Your changes are kept the next time this student is analyzed."
          action={<CourseFilter environments={courses} selected={course?.id ?? null} />}
        />
      </div>

      {!course || !framework || !ratings ? (
        <Card className="mt-6">
          <p className="text-sm text-foreground-muted">
            This course has no insights to edit yet. Open the student and click Analyze for this course first.
          </p>
        </Card>
      ) : (
        <EditInsightsForm
          learnerId={learnerId}
          environmentId={course.id}
          overview={readCourseOverview(insight?.approved_output) ?? ""}
          preferences={preferences}
          skills={framework.skills.map((skill) => {
            const r = ratings.skills.find((s) => s.key === skill.key);
            return {
              key: skill.key,
              name: skill.name,
              description: skill.description,
              level: r?.level ?? "not_enough_evidence",
              summary: r?.summary ?? "",
              editedBy: r?.editedBy ?? null,
            };
          })}
        />
      )}
    </div>
  );
}
