import { createClient } from "@/lib/supabase/server";
import { AutoRefresh } from "@/components/auto-refresh";
import { IslLoader } from "@/components/isl-loader";
import Link from "next/link";
import { courseCode } from "@/lib/course-code";
import { getSkillFramework } from "@/lib/skills/frameworks";

// Shown after clicking Analyze. The run finishes first and the student's
// insights are rewritten just after, so "done" means the insight was updated
// after the run completed (or the run finished long enough ago that nothing
// more is coming).
const GIVE_UP_AFTER_MS = 2 * 60 * 1000;

function isFinished(completedAt: string, insightUpdatedAt: string | null): boolean {
  const completed = new Date(completedAt).getTime();
  if (insightUpdatedAt && new Date(insightUpdatedAt).getTime() >= completed) return true;
  return Date.now() - completed > GIVE_UP_AFTER_MS;
}

export async function AnalysisStatus({ learnerId, runId }: { learnerId: string; runId: string | null }) {
  if (!runId) return null;
  const supabase = await createClient();

  const { data: run } = await supabase
    .from("processing_runs")
    .select("status, completed_at, environment_id, learner_id, learning_environments(name, skill_framework)")
    .eq("id", runId)
    .maybeSingle();
  if (!run || run.learner_id !== learnerId) return null;

  const course = run.learning_environments?.name ? courseCode(run.learning_environments.name) : "course";

  if (run.status === "failed") {
    return (
      <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-danger">
        Updating {course} insights didn&apos;t work this time. Please try Analyze again.
      </div>
    );
  }

  let done = false;
  if ((run.status === "completed" || run.status === "completed_with_warning") && run.completed_at) {
    const { data: insight } = await supabase
      .from("learner_insights")
      .select("updated_at")
      .eq("learner_id", learnerId)
      .eq("environment_id", run.environment_id)
      .is("approved_by", null)
      .eq("status", "approved")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    done = isFinished(run.completed_at, insight?.updated_at ?? null);
  }

  if (done && !getSkillFramework(run.learning_environments)) {
    return (
      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-warning">
        {course}&apos;s answers were read, but this course has no skills set up yet, so there is nothing to rate.{" "}
        <Link href={`/learning-environments/${run.environment_id}`} className="font-medium underline">
          Add the course&apos;s skills
        </Link>
        , then click “Update all students”.
      </div>
    );
  }

  if (done) {
    return (
      <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-success">
        {course} insights are up to date.
      </div>
    );
  }

  return (
    <div className="mt-4 flex items-center gap-3 rounded-lg border border-isl-blue-pale bg-isl-blue-pale/50 p-3 text-sm text-foreground">
      <AutoRefresh active />
      <IslLoader size={22} label="Updating insights" />
      <span>
        Updating {course} insights… this usually takes under a minute. The page will refresh by itself.
      </span>
    </div>
  );
}
