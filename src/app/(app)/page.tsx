import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PrimaryButton } from "@/components/ui";
import { ArrowRightIcon, BuildingIcon, SearchIcon } from "@/components/icons";
import { courseCode } from "@/lib/course-code";

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
          <Link
            key={env.id}
            href={`/learners?environment=${env.id}`}
            className="flex items-center gap-3 rounded-xl border border-border bg-surface p-5 transition-colors hover:border-isl-blue hover:bg-isl-blue-pale/40"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-isl-blue-pale text-isl-blue">
              <BuildingIcon className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <p className="font-semibold text-foreground">{courseCode(env.name)}</p>
              <p className="text-sm text-foreground-muted">{countByEnvironment.get(env.id) ?? 0} students</p>
            </div>
            <ArrowRightIcon className="h-4 w-4 text-foreground-muted" />
          </Link>
        ))}
      </div>
    </div>
  );
}
