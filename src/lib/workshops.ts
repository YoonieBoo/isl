import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { courseCode } from "@/lib/course-code";
import { readSkillRatings, readStoredSkills, type SkillFramework, type SkillRatings } from "@/lib/skills/frameworks";
import { rateLearnerSkills } from "@/lib/skills/rate-skills";
import { writeCourseOverview } from "@/lib/skills/overview";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type Workshop = {
  id: string;
  environment_id: string;
  week_number: number;
  title: string;
  workshop_date: string | null;
  skill_framework: unknown;
};

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

// Rates one learner on one week's skills using only that week's forms, and
// stores it as their weekly insight. Returns false when there was nothing to
// rate (no skills for the week, or no answers from this learner that week).
export async function updateWorkshopInsight(
  supabase: Supabase,
  learnerId: string,
  learnerName: string,
  courseName: string,
  workshop: Workshop,
): Promise<boolean> {
  const framework = workshopFramework(workshop, courseName);
  if (!framework) return false;
  const ratings = await rateLearnerSkills(supabase, learnerId, learnerName, workshop.environment_id, framework, workshop.id);
  if (!ratings) return false;

  const overview =
    (await writeCourseOverview({
      learnerName,
      courseName: `${courseCode(courseName)} ${workshopLabel(workshop)}`,
      framework,
      ratings,
      preferences: [],
      concerns: [],
    })) ?? ratings.overview;

  const { error } = await supabase.from("workshop_insights").upsert(
    {
      learner_id: learnerId,
      workshop_id: workshop.id,
      skill_ratings: ratings as never,
      overview,
      answer_count: ratings.answerCount,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "learner_id,workshop_id" },
  );
  return !error;
}
