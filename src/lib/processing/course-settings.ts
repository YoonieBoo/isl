import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import { courseCode } from "@/lib/course-code";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type CourseRunSettings = {
  processing_context: Json;
  ai_source: "external_ai" | "smartdiscovery" | "manual" | "mock";
  model_or_tool: string | null;
};

// The AI settings a course's runs use, so nobody has to fill in the technical
// setup form: reuse the last run that actually finished for this course, or —
// for a brand-new course — sensible defaults built from the course details,
// always with the real AI (never the test adapter) and every answer column
// read automatically (empty evidenceFields).
export async function resolveCourseRunSettings(supabase: Supabase, environmentId: string): Promise<CourseRunSettings> {
  const { data: priorRun } = await supabase
    .from("processing_runs")
    .select("processing_context, ai_source, model_or_tool")
    .eq("environment_id", environmentId)
    .in("status", ["completed", "completed_with_warning"])
    .neq("ai_source", "mock")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (priorRun) return priorRun;

  const { data: env } = await supabase
    .from("learning_environments")
    .select("name, course_or_workshop, description, learning_objectives")
    .eq("id", environmentId)
    .single();
  const code = env ? courseCode(env.name) : "this course";

  return {
    ai_source: "external_ai",
    model_or_tool: null,
    processing_context: {
      learningObjective:
        env?.learning_objectives?.trim() ||
        `Identify each learner's observed strengths, needs, concerns, and preferences from their own form answers in ${code}.`,
      activityContext: env?.course_or_workshop ?? "",
      learnerPopulation: "University students",
      activityType: "Course forms (pre-workshop, submission, reflection)",
      interpretationFocus: env?.description ?? "",
      signalCategories: "strength, need, concern, preference, activity_behaviour",
      taxonomyGuidance:
        "Ground every signal in the learner's own first-person reflection or self-assessment. Do not extract signals from descriptions of other people or from file-upload/link fields with no text content.",
      processingNotes: "Settings filled in automatically for a new course.",
      evidenceFields: "",
    },
  };
}
