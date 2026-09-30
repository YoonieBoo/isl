"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";

export type FormState = { error: string } | undefined;

export async function createLearningEnvironment(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const name = String(formData.get("name") ?? "").trim();
  const organisationName = String(formData.get("organisationName") ?? "").trim();
  const environmentType = String(formData.get("environmentType") ?? "").trim();
  const courseOrWorkshop = String(formData.get("courseOrWorkshop") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const learningObjectives = String(formData.get("learningObjectives") ?? "").trim();

  if (!name || !organisationName || !environmentType || !courseOrWorkshop) {
    return { error: "Name, organisation, type, and course/workshop are required." };
  }

  const { data, error } = await supabase
    .from("learning_environments")
    .insert({
      name,
      organisation_name: organisationName,
      environment_type: environmentType,
      course_or_workshop: courseOrWorkshop,
      description: description || null,
      learning_objectives: learningObjectives || null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "Failed to create learning environment." };
  }

  await logActivity(
    supabase,
    user.id,
    "created",
    "learning_environment",
    data.id,
    `Created learning environment "${name}"`,
  );

  revalidatePath("/learning-environments");
  redirect(`/learning-environments/${data.id}`);
}

export async function updateLearningEnvironment(
  id: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const name = String(formData.get("name") ?? "").trim();
  const organisationName = String(formData.get("organisationName") ?? "").trim();
  const environmentType = String(formData.get("environmentType") ?? "").trim();
  const courseOrWorkshop = String(formData.get("courseOrWorkshop") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const learningObjectives = String(formData.get("learningObjectives") ?? "").trim();

  if (!name || !organisationName || !environmentType || !courseOrWorkshop) {
    return { error: "Name, organisation, type, and course/workshop are required." };
  }

  const { error } = await supabase
    .from("learning_environments")
    .update({
      name,
      organisation_name: organisationName,
      environment_type: environmentType,
      course_or_workshop: courseOrWorkshop,
      description: description || null,
      learning_objectives: learningObjectives || null,
    })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  await logActivity(
    supabase,
    user.id,
    "updated",
    "learning_environment",
    id,
    `Updated learning environment "${name}"`,
  );

  revalidatePath("/learning-environments");
  revalidatePath(`/learning-environments/${id}`);
  redirect(`/learning-environments/${id}`);
}

export async function setLearningEnvironmentStatus(
  id: string,
  name: string,
  status: "active" | "archived",
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { error } = await supabase
    .from("learning_environments")
    .update({ status })
    .eq("id", id);

  if (error) throw new Error(error.message);

  await logActivity(
    supabase,
    user.id,
    status === "archived" ? "archived" : "restored",
    "learning_environment",
    id,
    `${status === "archived" ? "Archived" : "Restored"} learning environment "${name}"`,
  );

  revalidatePath("/learning-environments");
  revalidatePath(`/learning-environments/${id}`);
}
