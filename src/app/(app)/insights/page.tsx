import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { courseCode } from "@/lib/course-code";
import { LightBulbIcon } from "@/components/icons";

export default async function InsightsPage({
  searchParams,
}: PageProps<"/insights">) {
  const { learner, environment } = await searchParams;
  const learnerId = typeof learner === "string" ? learner : undefined;
  const environmentId = typeof environment === "string" ? environment : undefined;

  const supabase = await createClient();
  let query = supabase
    .from("learner_insights")
    .select("learner_id, environment_id, learners(display_name, external_reference), learning_environments(name)")
    .eq("status", "approved");

  if (learnerId) query = query.eq("learner_id", learnerId);
  if (environmentId) query = query.eq("environment_id", environmentId);

  const [{ data: insights, error }, { data: environmentRow }] = await Promise.all([
    query,
    environmentId
      ? supabase.from("learning_environments").select("name").eq("id", environmentId).single()
      : Promise.resolve({ data: null }),
  ]);

  // One row per student per course (a student can have older hand-approved
  // insights too); the name opens that student's insights for the course.
  const seen = new Set<string>();
  const students = (insights ?? [])
    .filter((i) => {
      const key = `${i.learner_id}|${i.environment_id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((i) => ({
      key: `${i.learner_id}|${i.environment_id}`,
      href: `/profiles/${i.learner_id}?environment=${i.environment_id}`,
      name: i.learners?.display_name ?? "Unknown student",
      id: i.learners?.external_reference ?? null,
      course: i.learning_environments?.name ? courseCode(i.learning_environments.name) : null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const showCourse = !environmentId && new Set(students.map((s) => s.course)).size > 1;

  const exportParams = new URLSearchParams();
  if (learnerId) exportParams.set("learner", learnerId);
  if (environmentId) exportParams.set("environment", environmentId);
  const exportQuery = exportParams.toString();

  return (
    <div>
      <PageHeader
        title="Insights"
        icon={LightBulbIcon}
        iconClassName="bg-amber-50 text-amber-600"
        description={environmentRow?.name ? `Students in ${courseCode(environmentRow.name)}. Click a name to see their insights.` : "Click a name to see their insights."}
        action={
          <a
            href={`/api/export/insights${exportQuery ? `?${exportQuery}` : ""}`}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground-muted transition-colors hover:bg-surface-pale hover:text-foreground"
          >
            Export approved insights
          </a>
        }
      />

      <div className="mt-6">
        {error && <p className="text-sm text-danger">{error.message}</p>}

        {!error && students.length === 0 && (
          <EmptyState title="No insights yet" description="Upload a form file on the course page and click Update all students." />
        )}

        {students.length > 0 && (
          <Card className="p-0">
            <p className="border-b border-border px-5 py-3 text-xs font-medium uppercase tracking-wide text-foreground-muted">
              {students.length} student{students.length === 1 ? "" : "s"}
            </p>
            <ul className="divide-y divide-border">
              {students.map((s) => (
                <li key={s.key}>
                  <Link href={s.href} className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-surface-pale">
                    <span>
                      <span className="font-medium text-isl-blue">{s.name}</span>
                      {s.id && <span className="ml-2 text-foreground-muted">{s.id}</span>}
                    </span>
                    {showCourse && s.course && (
                      <span className="rounded-full bg-surface-pale px-2 py-0.5 text-xs font-medium text-foreground-muted">{s.course}</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
