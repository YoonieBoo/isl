"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type AuthFormState = { error: string } | undefined;

export async function signIn(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect(next || "/");
}

const SIGN_UP_ROLES = ["admin", "analyst", "educator", "learner"] as const;
type SignUpRole = (typeof SIGN_UP_ROLES)[number];

export async function signUp(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("displayName") ?? "");
  const role = String(formData.get("role") ?? "") as SignUpRole;

  if (!SIGN_UP_ROLES.includes(role)) {
    return { error: "Choose a role." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } },
  });

  if (error) {
    return { error: error.message };
  }
  if (!data.user) {
    return { error: "Account could not be created." };
  }

  const { error: roleError } = await supabase.from("profiles").update({ role }).eq("id", data.user.id);
  if (roleError) {
    return { error: `Account created, but the role couldn't be saved: ${roleError.message}` };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
