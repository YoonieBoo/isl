"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";
import { normalizeStudentId } from "@/lib/student-id";

export type FormState = { error: string } | undefined;

export async function createLearner(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const displayName = String(formData.get("displayName") ?? "").trim();
  const externalReference = normalizeStudentId(String(formData.get("externalReference") ?? ""));
  const email = String(formData.get("email") ?? "").trim();
  const environmentId = String(formData.get("environmentId") ?? "").trim();

  if (!displayName) {
    return { error: "Display name is required." };
  }

  const { data: learner, error } = await supabase
    .from("learners")
    .insert({
      display_name: displayName,
      external_reference: externalReference || null,
      email: email || null,
    })
    .select("id")
    .single();

  if (error || !learner) {
    return { error: error?.message ?? "Failed to create learner." };
  }

  if (environmentId) {
    await supabase.from("learner_environments").insert({
      learner_id: learner.id,
      environment_id: environmentId,
    });
  }

  await supabase.from("learner_profiles").insert({ learner_id: learner.id });

  await logActivity(
    supabase,
    user.id,
    "created",
    "learner",
    learner.id,
    `Created learner "${displayName}"`,
  );

  revalidatePath("/learners");
  if (environmentId) revalidatePath(`/learning-environments/${environmentId}`);
  redirect(`/learners/${learner.id}`);
}

export async function updateLearner(
  id: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const displayName = String(formData.get("displayName") ?? "").trim();
  const externalReference = normalizeStudentId(String(formData.get("externalReference") ?? ""));
  const email = String(formData.get("email") ?? "").trim();

  if (!displayName) {
    return { error: "Display name is required." };
  }

  const { error } = await supabase
    .from("learners")
    .update({
      display_name: displayName,
      external_reference: externalReference || null,
      email: email || null,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  await logActivity(supabase, user.id, "updated", "learner", id, `Updated learner "${displayName}"`);

  revalidatePath("/learners");
  revalidatePath(`/learners/${id}`);
  redirect(`/learners/${id}`);
}

export async function setLearnerStatus(
  id: string,
  name: string,
  status: "active" | "archived",
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { error } = await supabase.from("learners").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);

  await logActivity(
    supabase,
    user.id,
    status === "archived" ? "archived" : "restored",
    "learner",
    id,
    `${status === "archived" ? "Archived" : "Restored"} learner "${name}"`,
  );

  revalidatePath("/learners");
  revalidatePath(`/learners/${id}`);
}

export async function addLearnerToEnvironment(learnerId: string, environmentId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { error } = await supabase
    .from("learner_environments")
    .insert({ learner_id: learnerId, environment_id: environmentId });

  if (error) throw new Error(error.message);

  revalidatePath(`/learners/${learnerId}`);
  revalidatePath(`/learning-environments/${environmentId}`);
}
