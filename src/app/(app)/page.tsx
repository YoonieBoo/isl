import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, PrimaryButton } from "@/components/ui";
import { ArrowRightIcon, BuildingIcon, SearchIcon } from "@/components/icons";
import { courseCode } from "@/lib/course-code";
import { getSkillFramework } from "@/lib/skills/frameworks";

// Start page for instructors: find a student, or open a class. System
// counts (datasets, processing runs, review queue) live on their own pages.
export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: environments }, { data: links }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user?.id ?? "").maybeSingle(),
    supabase.from("learning_environments").select("id, name").eq("status", "active").order("name"),
    supabase.from("learner_environments").select("environment_id"),
  ]);

  const countByEnvironment = new Map<string, number>();
  for (const l of links ?? []) countByEnvironment.set(l.environment_id, (countByEnvironment.get(l.environment_id) ?? 0) + 1);
  const firstName = profile?.display_name?.split(" ")[0];

  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground">{firstName ? `Welcome, ${firstName}` : "Welcome"}</h1>
      <p className="mt-1 text-sm text-foreground-muted">Find a student, or see how a whole class is doing.</p>

      <form action="/learners" className="mt-6 flex gap-2">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
          <input
            type="search"
            name="q"
            aria-label="Search students"
            placeholder="Search students by name or student ID"
            className="w-full rounded-lg border border-border bg-surface py-2.5 pl-9 pr-3 text-sm text-foreground outline-none focus:border-isl-blue"
          />
        </div>
        <PrimaryButton type="submit">Search</PrimaryButton>
      </form>

      <h2 className="mt-8 text-base font-semibold text-foreground">Courses</h2>
      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {(environments ?? []).map((env) => (
          <Card key={env.id} className="flex flex-col">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-isl-blue-pale text-isl-blue">
                <BuildingIcon className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold text-foreground">{courseCode(env.name)}</p>
                <p className="text-sm text-foreground-muted">{countByEnvironment.get(env.id) ?? 0} students</p>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4 text-sm">
              {getSkillFramework(env.name) && (
                <Link
                  href={`/learning-environments/${env.id}/cohort`}
                  className="inline-flex items-center justify-between font-medium text-isl-blue hover:underline"
                >
                  View class skills <ArrowRightIcon className="h-4 w-4" />
                </Link>
              )}
              <Link
                href={`/learners?environment=${env.id}`}
                className="inline-flex items-center justify-between font-medium text-isl-blue hover:underline"
              >
                View students <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>
          </Card>
        ))}
      </div>

      <Card className="mt-8">
        <h2 className="text-base font-semibold text-foreground">How it works</h2>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-foreground-muted">
          <li>
            <span className="text-foreground">Find a student</span> with the search box, or open a course&apos;s student list.
          </li>
          <li>
            <span className="text-foreground">View insights</span> to see their overview, strengths and development focus.
            Click any skill to see the student&apos;s own words behind it.
          </li>
          <li>
            <span className="text-foreground">Analyze</span> a course to update the insights after new form answers are added.
          </li>
          <li>
            <span className="text-foreground">Edit insights</span> to correct anything the AI got wrong — your changes are kept.
          </li>
        </ol>
      </Card>
    </div>
  );
}
