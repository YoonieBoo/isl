"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";
import { SKILL_LEVELS, readSkillRatings, type SkillLevel } from "@/lib/skills/frameworks";
import { readCourseOverview, refreshLearnerSummary } from "@/lib/skills/overview";

export type EditFormState = { error: string } | undefined;

// Saves a person's corrections to the AI's insights for one course. Only what
// actually changed is marked as edited, and edited parts are kept the next
// time the learner is analyzed (see mergeHumanSkillEdits).
export async function saveInsightEdits(
  learnerId: string,
  environmentId: string,
  _prev: EditFormState,
  formData: FormData,
): Promise<EditFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in again." };

  const [{ data: profile }, { data: insight }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).single(),
    supabase
      .from("learner_insights")
      .select("id, approved_output")
      .eq("learner_id", learnerId)
      .eq("environment_id", environmentId)
      .is("approved_by", null)
      .eq("status", "approved")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (!insight) return { error: "This course has no insights yet. Click Analyze first." };

  const editor = profile?.display_name || user.email || "Staff";
  const now = new Date().toISOString();
  const output = { ...((insight.approved_output ?? {}) as Record<string, unknown>) };
  const changes: string[] = [];

  // Skills: level and reason.
  const ratings = readSkillRatings(output);
  if (ratings) {
    ratings.skills = ratings.skills.map((skill) => {
      const level = String(formData.get(`level_${skill.key}`) ?? skill.level) as SkillLevel;
      const summary = String(formData.get(`summary_${skill.key}`) ?? skill.summary).trim();
      if (!SKILL_LEVELS.includes(level)) return skill;
      if (level === skill.level && summary === skill.summary) return skill;
      changes.push(skill.key);
      return { ...skill, level, summary, editedBy: editor, editedAt: now };
    });
    output.skill_ratings = ratings;
  }

  // Overview.
  const overview = String(formData.get("overview") ?? "").trim();
  if (overview && overview !== readCourseOverview(output)) {
    output.overview = overview;
    output.summary = overview;
    output.overview_edited_by = editor;
    output.overview_edited_at = now;
    changes.push("overview");
  }

  // Learning preferences: one per line. Unchanged lines keep their original
  // quote; new or reworded lines are saved as typed.
  const originalPreferences = Array.isArray(output.learning_preferences) ? (output.learning_preferences as string[]) : [];
  const labelOf = (p: string) => (p.includes(": ") ? p.slice(0, p.indexOf(": ")) : p);
  const typed = String(formData.get("preferences") ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const preferences = typed.map((line) => originalPreferences.find((p) => labelOf(p) === line) ?? line);
  if (preferences.join("\n") !== originalPreferences.join("\n")) {
    output.learning_preferences = preferences;
    output.preferences_edited_by = editor;
    output.preferences_edited_at = now;
    changes.push("learning preferences");
  }

  if (changes.length === 0) redirect(`/profiles/${learnerId}?environment=${environmentId}`);

  const { error } = await supabase
    .from("learner_insights")
    .update({
      approved_output: output as never,
      summary: String(output.summary ?? ""),
      learning_preferences: Array.isArray(output.learning_preferences) ? (output.learning_preferences as string[]) : [],
    })
    .eq("id", insight.id);
  if (error) return { error: `Couldn't save: ${error.message}` };

  // Keep the all-courses overview in step with the edited course.
  await refreshLearnerSummary(supabase, learnerId);
  await logActivity(supabase, user.id, "updated", "learner_insight", insight.id, `Edited insights (${changes.length} change${changes.length === 1 ? "" : "s"})`);

  revalidatePath(`/profiles/${learnerId}`);
  revalidatePath(`/learning-environments/${environmentId}/cohort`);
  redirect(`/profiles/${learnerId}?environment=${environmentId}&saved=1`);
}
