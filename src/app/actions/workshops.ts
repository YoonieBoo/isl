"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";
import { parseSkillsForm } from "@/lib/skills/parse-skills-form";
import type { SkillsFormState } from "@/app/actions/course";
import { guessFormStage, updateWorkshopInsight, type FormStageValue } from "@/lib/workshops";
import { refreshWeekClassSummary } from "@/lib/class-summary";
import { extractLearningContext, readLearningContext, type LearningContext } from "@/lib/week-materials";
import { skillKey } from "@/lib/skills/frameworks";
import { courseCode } from "@/lib/course-code";
import { NON_ANSWER_FIELD } from "@/lib/answer-fields";

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

  const { data: file } = await supabase.from("datasets").select("name").eq("id", datasetId).single();
  const { error } = await supabase
    .from("datasets")
    .update({ workshop_id: workshopId, form_stage: workshopId && file ? guessFormStage(file.name) : null })
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
// `skipped`: the student has no Pre/Post answers this week (e.g. only a team form).
export async function updateWorkshopStudent(
  workshopId: string,
  learnerId: string,
): Promise<{ ok: boolean; skipped?: boolean }> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false };
  const [{ data: workshop }, { data: learner }] = await Promise.all([
    supabase.from("workshops").select("*, learning_environments(name)").eq("id", workshopId).single(),
    supabase.from("learners").select("display_name").eq("id", learnerId).single(),
  ]);
  if (!workshop || !learner || !workshop.learning_environments) return { ok: false };
  const result = await updateWorkshopInsight(
    supabase,
    learnerId,
    learner.display_name,
    workshop.learning_environments.name,
    workshop,
  );
  revalidatePath(`/profiles/${learnerId}`);
  return { ok: result !== "failed", skipped: result === "nothing" };
}

// Marks a week's form file as its Pre form, Post form or Other.
export async function setFileStage(datasetId: string, stage: FormStageValue, workshopId: string, environmentId: string) {
  const { supabase, user } = await requireUser();
  if (!user) throw new Error("Please sign in again.");
  const { error } = await supabase
    .from("datasets")
    .update({ form_stage: stage })
    .eq("id", datasetId)
    .eq("workshop_id", workshopId);
  if (error) throw new Error(error.message);
  revalidatePath(`/learning-environments/${environmentId}/workshops/${workshopId}`);
}

// The week's topic, date and learning objectives (Week settings).
export async function saveWorkshopDetails(
  workshopId: string,
  _prev: SkillsFormState,
  formData: FormData,
): Promise<SkillsFormState> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Please sign in again." };
  const title = String(formData.get("title") ?? "").trim();
  const date = String(formData.get("workshop_date") ?? "").trim();
  const objectives = String(formData.get("learning_objectives") ?? "").trim();
  if (!title) return { error: "Enter the workshop topic." };

  const { data, error } = await supabase
    .from("workshops")
    .update({ title, workshop_date: date || null, learning_objectives: objectives || null })
    .eq("id", workshopId)
    .select("environment_id")
    .single();
  if (error || !data) return { error: `Couldn't save: ${error?.message}` };

  await logActivity(supabase, user.id, "updated", "workshop", workshopId, `Updated week details`);
  revalidatePath(`/learning-environments/${data.environment_id}`, "layout");
  return { saved: true };
}

// Rebuilds the week's class summary from its students' weekly insights.
export async function refreshClassSummary(workshopId: string): Promise<{ ok: boolean }> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false };
  const { data: workshop } = await supabase
    .from("workshops")
    .select("*, learning_environments(name)")
    .eq("id", workshopId)
    .single();
  if (!workshop?.learning_environments) return { ok: false };
  const summary = await refreshWeekClassSummary(supabase, workshop, workshop.learning_environments.name);
  revalidatePath(`/learning-environments/${workshop.environment_id}/workshops/${workshopId}`);
  return { ok: Boolean(summary) };
}

// Reads the slides / workshop instructions the browser just uploaded for a
// week and stores what the AI found, for the teacher to review.
export async function readWeekMaterials(
  workshopId: string,
  files: { name: string; path: string }[],
): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Please sign in again." };
  const { data: workshop } = await supabase
    .from("workshops")
    .select("*, learning_environments(name)")
    .eq("id", workshopId)
    .single();
  if (!workshop?.learning_environments) return { error: "Week not found." };

  const prefix = `workshops/${workshopId}/`;
  const downloaded: { name: string; base64: string }[] = [];
  for (const f of files) {
    if (!f.path.startsWith(prefix)) return { error: "Unexpected file location." };
    const { data, error } = await supabase.storage.from("datasets").download(f.path);
    if (error || !data) return { error: `Couldn't open ${f.name}.` };
    downloaded.push({ name: f.name, base64: Buffer.from(await data.arrayBuffer()).toString("base64") });
  }
  if (downloaded.length === 0) return { error: "Choose at least one PDF." };

  // The week's form questions, so suggested skills match what students are asked.
  const { data: weekFiles } = await supabase
    .from("datasets")
    .select("form_stage, validation_summary")
    .eq("workshop_id", workshopId);
  // Only Pre/Post: "Other" forms (e.g. team answers) aren't rated per student.
  const formQuestions = (weekFiles ?? []).flatMap((f) => {
    if (f.form_stage !== "pre" && f.form_stage !== "post") return [];
    const columns = (f.validation_summary as { columns?: unknown } | null)?.columns;
    const label = f.form_stage === "pre" ? "Pre" : "Post";
    return (Array.isArray(columns) ? columns : [])
      .filter((c): c is string => typeof c === "string" && !NON_ANSWER_FIELD.test(c) && !/team/i.test(c))
      .map((c) => `${label}: ${c.trim()}`);
  });

  const found = await extractLearningContext({
    weekName: `${courseCode(workshop.learning_environments.name)} Week ${workshop.week_number} — ${workshop.title}`,
    files: downloaded,
    formQuestions,
  });
  if (!found) return { error: "The AI couldn't read these files. Try again, or check they are PDFs." };

  const context: LearningContext = { ...found, materials: files, readAt: new Date().toISOString() };
  await supabase.from("workshops").update({ learning_context: context as never }).eq("id", workshopId);
  await logActivity(supabase, user.id, "updated", "workshop", workshopId, `Read ${files.length} teaching file(s)`);
  revalidatePath(`/learning-environments/${workshop.environment_id}/workshops/${workshopId}`);
  return {};
}

// The teacher accepts the AI's suggested objectives and skills for the week.
export async function applyWeekSuggestions(workshopId: string) {
  const { supabase, user } = await requireUser();
  if (!user) throw new Error("Please sign in again.");
  const { data: workshop } = await supabase.from("workshops").select("*").eq("id", workshopId).single();
  const context = readLearningContext(workshop?.learning_context);
  if (!workshop || !context) return;

  const skills = context.suggestedSkills.map((s) => ({ key: skillKey(s.name), name: s.name, description: s.description }));
  await supabase
    .from("workshops")
    .update({
      skill_framework: skills.length > 0 ? skills : workshop.skill_framework,
      learning_objectives:
        context.suggestedObjectives.map((o, i) => `${i + 1}. ${o}`).join("\n") || workshop.learning_objectives,
      learning_context: { ...context, appliedAt: new Date().toISOString() } as never,
    })
    .eq("id", workshopId);
  await logActivity(supabase, user.id, "updated", "workshop", workshopId, "Used the suggested objectives and skills");
  revalidatePath(`/learning-environments/${workshop.environment_id}/workshops/${workshopId}`);
}
