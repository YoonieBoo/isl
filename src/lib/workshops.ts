import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { courseCode } from "@/lib/course-code";
import { readSkillRatings, readStoredSkills, type SkillFramework, type SkillRatings } from "@/lib/skills/frameworks";
import { rateLearnerSkills } from "@/lib/skills/rate-skills";
import { writeCourseOverview, writeWeeklyOverview } from "@/lib/skills/overview";
import { weekContextText } from "@/lib/week-materials";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type Workshop = {
  id: string;
  environment_id: string;
  week_number: number;
  title: string;
  workshop_date: string | null;
  skill_framework: unknown;
  learning_objectives: string | null;
  learning_context?: unknown;
};

export type FormStageValue = "pre" | "post" | "other";
export const FORM_STAGE_LABEL: Record<FormStageValue, string> = { pre: "Pre", post: "Post", other: "Other" };

// Guesses a weekly form's stage from its file name: "Pre-workshop 1" → Pre,
// "Learning Reflection 1" / "Post-workshop" → Post, anything else (e.g. a
// team "Workshop 1" submission) → Other. Can be changed in Week settings.
export function guessFormStage(fileName: string): FormStageValue {
  if (/pre[- _]?(workshop|class)/i.test(fileName)) return "pre";
  if (/reflection|post[- _]?(workshop|class)/i.test(fileName)) return "post";
  return "other";
}

export function workshopLabel(w: Pick<Workshop, "week_number" | "title">): string {
  return `Week ${w.week_number} — ${w.title}`;
}

// A week's own skill list (typed on the workshop page). Unlike courses there
// is no built-in fallback: a week without skills simply has no weekly rating.
export function workshopFramework(workshop: Pick<Workshop, "skill_framework">, courseName: string): SkillFramework | null {
  const skills = readStoredSkills(workshop.skill_framework);
  return skills ? { courseCode: courseCode(courseName), skills } : null;
}

export function readWorkshopRatings(value: unknown): SkillRatings | null {
  return readSkillRatings({ skill_ratings: value });
}

// Rates one learner on one week's skills from that week's forms and stores it
// as their weekly insight: the Pre form and the Post form are rated
// separately, and the overview says what changed, what is still missing and
// what to do next. A week whose files aren't marked Pre/Post is rated from all
// its forms together. "nothing" means there was nothing to rate (no skills for
// the week, or no Pre/Post answers from this learner that week).
export type WeeklyUpdate = "updated" | "nothing" | "failed";

export async function updateWorkshopInsight(
  supabase: Supabase,
  learnerId: string,
  learnerName: string,
  courseName: string,
  workshop: Workshop,
): Promise<WeeklyUpdate> {
  const framework = workshopFramework(workshop, courseName);
  if (!framework) return "nothing";
  const context = weekContextText(workshop.learning_objectives, workshop.learning_context);
  const base = { workshopId: workshop.id, objectives: context };
  const weekName = `${courseCode(courseName)} ${workshopLabel(workshop)}`;

  const [pre, post] = await Promise.all([
    rateLearnerSkills(supabase, learnerId, learnerName, workshop.environment_id, framework, { ...base, stage: "pre" }),
    rateLearnerSkills(supabase, learnerId, learnerName, workshop.environment_id, framework, { ...base, stage: "post" }),
  ]);

  let ratings: SkillRatings | null;
  let overview: string | null;
  if (pre || post) {
    ratings = post ?? pre;
    overview = await writeWeeklyOverview({ weekName, objectives: context, framework, pre, post });
  } else {
    // Only weeks with no Pre/Post files fall back to rating every form
    // together; otherwise a learner who only sent an "Other" form (e.g. a
    // team submission) simply has no weekly rating.
    const { count } = await supabase
      .from("datasets")
      .select("id", { count: "exact", head: true })
      .eq("workshop_id", workshop.id)
      .in("form_stage", ["pre", "post"]);
    if (count) {
      // Drop an older weekly result so it doesn't count in the class summary.
      await supabase.from("workshop_insights").delete().eq("learner_id", learnerId).eq("workshop_id", workshop.id);
      return "nothing";
    }
    ratings = await rateLearnerSkills(supabase, learnerId, learnerName, workshop.environment_id, framework, base);
    if (!ratings) return "nothing";
    overview = await writeCourseOverview({
      learnerName,
      courseName: weekName,
      framework,
      ratings,
      preferences: [],
      concerns: [],
    });
  }
  if (!ratings) return "failed";

  const { error } = await supabase.from("workshop_insights").upsert(
    {
      learner_id: learnerId,
      workshop_id: workshop.id,
      skill_ratings: ratings as never,
      pre_ratings: (pre ?? null) as never,
      post_ratings: (post ?? null) as never,
      overview: overview ?? ratings.overview,
      answer_count: (pre?.answerCount ?? 0) + (post?.answerCount ?? 0) || ratings.answerCount,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "learner_id,workshop_id" },
  );
  return error ? "failed" : "updated";
}
