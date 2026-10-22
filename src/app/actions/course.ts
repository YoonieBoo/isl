"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";
import { skillKey } from "@/lib/skills/frameworks";
import { resolveCourseRunSettings } from "@/lib/processing/course-settings";
import { processRunRecords } from "@/lib/processing/run-records";
import { autoUpdateEnvironmentInsight } from "@/lib/insight-evidence";

export type SkillsFormState = { error?: string; saved?: boolean } | undefined;

const MAX_SKILLS = 10;

// Saves the course's fixed skill list (typed in on the course page). Keys of
// skills that already existed are kept so existing ratings still match.
export async function saveCourseSkills(
  environmentId: string,
  _prev: SkillsFormState,
  formData: FormData,
): Promise<SkillsFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in again." };

  const names = formData.getAll("skill_name").map((v) => String(v).trim());
  const descriptions = formData.getAll("skill_description").map((v) => String(v).trim());
  const keys = formData.getAll("skill_key").map((v) => String(v).trim());

  const skills: { key: string; name: string; description: string }[] = [];
  const usedKeys = new Set<string>();
  names.forEach((name, i) => {
    if (!name) return;
    let key = keys[i] || skillKey(name);
    while (usedKeys.has(key)) key = `${key}_2`;
    usedKeys.add(key);
    skills.push({ key, name, description: descriptions[i] ?? "" });
  });

  if (skills.length === 0) return { error: "Add at least one skill." };
  if (skills.length > MAX_SKILLS) return { error: `Keep it to ${MAX_SKILLS} skills or fewer.` };
  const lower = skills.map((s) => s.name.toLowerCase());
  if (new Set(lower).size !== lower.length) return { error: "Two skills have the same name." };

  const { error } = await supabase.from("learning_environments").update({ skill_framework: skills }).eq("id", environmentId);
  if (error) return { error: `Couldn't save: ${error.message}` };

  await logActivity(supabase, user.id, "updated", "learning_environment", environmentId, `Saved ${skills.length} course skills`);
  revalidatePath(`/learning-environments/${environmentId}`);
  revalidatePath("/", "layout");
  return { saved: true };
}

// Students in the course who have matched form answers to analyse.
export async function listStudentsToUpdate(environmentId: string): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Please sign in again.");

  const ids = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase
      .from("dataset_records")
      .select("learner_id, datasets!inner(environment_id)")
      .eq("datasets.environment_id", environmentId)
      .in("validation_status", ["valid", "valid_with_warnings"])
      .not("learner_id", "is", null)
      .range(from, from + 999);
    for (const r of data ?? []) if (r.learner_id) ids.add(r.learner_id);
    if (!data || data.length < 1000) break;
  }
  if (ids.size === 0) return [];
  const { data: learners } = await supabase.from("learners").select("id, display_name").in("id", [...ids]);
  return (learners ?? []).map((l) => ({ id: l.id, name: l.display_name })).sort((a, b) => a.name.localeCompare(b.name));
}

// Updates one student in a course: reads any of their answers not yet read,
// then rebuilds their skill ratings and overview. Called once per student by
// the "Update all students" button, so each request stays short and a class
// of any size can't hit the server's time limit.
export async function updateCourseStudent(environmentId: string, learnerId: string): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const settings = await resolveCourseRunSettings(supabase, environmentId);
  const { data: run, error } = await supabase
    .from("processing_runs")
    .insert({
      environment_id: environmentId,
      learner_id: learnerId,
      dataset_id: null,
      status: "running",
      started_at: new Date().toISOString(),
      processing_context: settings.processing_context,
      processing_configuration: { source: "update_all_students" },
      ai_source: settings.ai_source,
      model_or_tool: settings.model_or_tool,
      created_by: user.id,
    })
    .select("*")
    .single();
  if (error || !run) return { ok: false };

  try {
    const counts = await processRunRecords(supabase, run, { onlyUnprocessed: true });
    const status =
      counts.total > 0 && counts.failedCount === counts.total
        ? "failed"
        : counts.failedCount > 0 || counts.warningCount > 0
          ? "completed_with_warning"
          : "completed";
    await supabase
      .from("processing_runs")
      .update({
        status,
        completed_at: new Date().toISOString(),
        processing_configuration: { source: "update_all_students", progress: counts },
      })
      .eq("id", run.id);
    await autoUpdateEnvironmentInsight(supabase, learnerId, environmentId);
    revalidatePath(`/profiles/${learnerId}`);
    return { ok: status !== "failed" };
  } catch {
    await supabase.from("processing_runs").update({ status: "failed", completed_at: new Date().toISOString() }).eq("id", run.id);
    return { ok: false };
  }
}
