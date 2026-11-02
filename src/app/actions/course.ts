"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";
import { parseSkillsForm } from "@/lib/skills/parse-skills-form";
import { resolveCourseRunSettings } from "@/lib/processing/course-settings";
import { processRunRecords } from "@/lib/processing/run-records";
import { autoUpdateEnvironmentInsight } from "@/lib/insight-evidence";
import { updateWorkshopInsight } from "@/lib/workshops";

export type SkillsFormState = { error?: string; saved?: boolean } | undefined;

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

  const parsed = parseSkillsForm(formData);
  if ("error" in parsed) return { error: parsed.error };
  const { skills } = parsed;

  const { error } = await supabase.from("learning_environments").update({ skill_framework: skills }).eq("id", environmentId);
  if (error) return { error: `Couldn't save: ${error.message}` };

  await logActivity(supabase, user.id, "updated", "learning_environment", environmentId, `Saved ${skills.length} course skills`);
  revalidatePath(`/learning-environments/${environmentId}`);
  revalidatePath("/", "layout");
  return { saved: true };
}

// Students in the course to update. By default only those with answers the
// AI hasn't read yet (new uploads), so students already up to date are left
// alone; `everyone` re-rates the whole course (e.g. after its skills change).
export async function listStudentsToUpdate(
  environmentId: string,
  { everyone = false }: { everyone?: boolean } = {},
): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Please sign in again.");

  const ids = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase
      .from("dataset_records")
      .select("learner_id, datasets!inner(environment_id), processing_results(status)")
      .eq("datasets.environment_id", environmentId)
      .in("validation_status", ["valid", "valid_with_warnings"])
      .not("learner_id", "is", null)
      .range(from, from + 999);
    for (const r of data ?? []) {
      if (!r.learner_id) continue;
      // Same rule processRunRecords uses for "already read" answers.
      const read = (r.processing_results ?? []).some((pr) => ["success", "warning", "skipped"].includes(pr.status));
      if (everyone || !read) ids.add(r.learner_id);
    }
    if (!data || data.length < 1000) break;
  }
  if (ids.size === 0) return [];
  const { data: learners } = await supabase.from("learners").select("id, display_name").in("id", [...ids]);
  return (learners ?? []).map((l) => ({ id: l.id, name: l.display_name })).sort((a, b) => a.name.localeCompare(b.name));
}

// Updates one student in a course: reads any of their answers not yet read,
// then rebuilds their skill ratings and overview. Called once per student by
// the "Update all students" button, so each request stays short and a class
// of any size can't hit the server's time limit. Weeks the new answers belong
// to get their weekly insight rebuilt too (every week with `everyone`).
export async function updateCourseStudent(
  environmentId: string,
  learnerId: string,
  { everyone = false }: { everyone?: boolean } = {},
): Promise<{ ok: boolean }> {
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

  // Decide which weeks to refresh before processing marks the answers as read.
  const { data: weekRecords } = await supabase
    .from("dataset_records")
    .select("datasets!inner(environment_id, workshop_id), processing_results(status)")
    .eq("learner_id", learnerId)
    .eq("datasets.environment_id", environmentId)
    .not("datasets.workshop_id", "is", null)
    .in("validation_status", ["valid", "valid_with_warnings"]);
  const weekIds = new Set<string>();
  for (const r of weekRecords ?? []) {
    const read = (r.processing_results ?? []).some((pr) => ["success", "warning", "skipped"].includes(pr.status));
    if (r.datasets?.workshop_id && (everyone || !read)) weekIds.add(r.datasets.workshop_id);
  }

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
    if (weekIds.size > 0) {
      const [{ data: weeks }, { data: learner }, { data: course }] = await Promise.all([
        supabase.from("workshops").select("*").in("id", [...weekIds]),
        supabase.from("learners").select("display_name").eq("id", learnerId).single(),
        supabase.from("learning_environments").select("name").eq("id", environmentId).single(),
      ]);
      if (learner && course) {
        for (const week of weeks ?? []) {
          await updateWorkshopInsight(supabase, learnerId, learner.display_name, course.name, week);
        }
      }
    }
    revalidatePath(`/profiles/${learnerId}`);
    return { ok: status !== "failed" };
  } catch {
    await supabase.from("processing_runs").update({ status: "failed", completed_at: new Date().toISOString() }).eq("id", run.id);
    return { ok: false };
  }
}
