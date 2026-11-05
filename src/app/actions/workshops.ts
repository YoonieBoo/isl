"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";
import { parseSkillsForm } from "@/lib/skills/parse-skills-form";
import type { SkillsFormState } from "@/app/actions/course";
import { updateWorkshopInsight } from "@/lib/workshops";

export type WorkshopFormState = { error?: string } | undefined;

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

// Adds a week to a course (e.g. "Week 2 — Design Thinking").
export async function createWorkshop(
  environmentId: string,
  _prev: WorkshopFormState,
  formData: FormData,
): Promise<WorkshopFormState> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Please sign in again." };

  const week = Number(formData.get("week_number"));
  const title = String(formData.get("title") ?? "").trim();
  const date = String(formData.get("workshop_date") ?? "").trim();
  if (!Number.isInteger(week) || week < 1 || week > 52) return { error: "Enter a week number (1–52)." };
  if (!title) return { error: "Enter the workshop topic." };

  const { data, error } = await supabase
    .from("workshops")
    .insert({ environment_id: environmentId, week_number: week, title, workshop_date: date || null })
    .select("id")
    .single();
  if (error || !data) {
    return { error: error?.code === "23505" ? `Week ${week} already exists in this course.` : `Couldn't add the week: ${error?.message}` };
  }

  await logActivity(supabase, user.id, "created", "workshop", data.id, `Added Week ${week} — ${title}`);
  revalidatePath(`/learning-environments/${environmentId}`);
  redirect(`/learning-environments/${environmentId}/workshops/${data.id}`);
}

export async function saveWorkshopSkills(
  workshopId: string,
  _prev: SkillsFormState,
  formData: FormData,
): Promise<SkillsFormState> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Please sign in again." };

  const parsed = parseSkillsForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  const { data, error } = await supabase
    .from("workshops")
    .update({ skill_framework: parsed.skills })
    .eq("id", workshopId)
    .select("environment_id")
    .single();
  if (error || !data) return { error: `Couldn't save: ${error?.message}` };

  await logActivity(supabase, user.id, "updated", "workshop", workshopId, `Saved ${parsed.skills.length} workshop skills`);
  revalidatePath(`/learning-environments/${data.environment_id}/workshops/${workshopId}`);
  return { saved: true };
}

// Puts an already-uploaded form file into a week (or takes it out with null).
export async function setFileWorkshop(datasetId: string, workshopId: string | null, environmentId: string) {
  const { supabase, user } = await requireUser();
  if (!user) throw new Error("Please sign in again.");

  const { error } = await supabase
    .from("datasets")
    .update({ workshop_id: workshopId })
    .eq("id", datasetId)
    .eq("environment_id", environmentId);
  if (error) throw new Error(error.message);

  revalidatePath(`/learning-environments/${environmentId}`, "layout");
}

// Students who submitted any form in this week. With `onlyNew`, just those
// whose answers the AI hasn't read yet (for the week's "Update students").
export async function listWorkshopStudents(
  workshopId: string,
  { onlyNew = false }: { onlyNew?: boolean } = {},
): Promise<{ id: string; name: string }[]> {
  const { supabase, user } = await requireUser();
  if (!user) throw new Error("Please sign in again.");
  const ids = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase
      .from("dataset_records")
      .select("learner_id, datasets!inner(workshop_id), processing_results(status)")
      .eq("datasets.workshop_id", workshopId)
      .in("validation_status", ["valid", "valid_with_warnings"])
      .not("learner_id", "is", null)
      .range(from, from + 999);
    for (const r of data ?? []) {
      const read = (r.processing_results ?? []).some((pr) => ["success", "warning", "skipped"].includes(pr.status));
      if (r.learner_id && !(onlyNew && read)) ids.add(r.learner_id);
    }
    if (!data || data.length < 1000) break;
  }
  if (ids.size === 0) return [];
  const { data: learners } = await supabase.from("learners").select("id, display_name").in("id", [...ids]);
  return (learners ?? []).map((l) => ({ id: l.id, name: l.display_name })).sort((a, b) => a.name.localeCompare(b.name));
}

// Rebuilds one student's insights for one week from that week's answers.
export async function updateWorkshopStudent(workshopId: string, learnerId: string): Promise<{ ok: boolean }> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false };
  const [{ data: workshop }, { data: learner }] = await Promise.all([
    supabase.from("workshops").select("*, learning_environments(name)").eq("id", workshopId).single(),
    supabase.from("learners").select("display_name").eq("id", learnerId).single(),
  ]);
  if (!workshop || !learner || !workshop.learning_environments) return { ok: false };
  const ok = await updateWorkshopInsight(supabase, learnerId, learner.display_name, workshop.learning_environments.name, workshop);
  revalidatePath(`/profiles/${learnerId}`);
  return { ok };
}
