"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";
import type { Database } from "@/lib/supabase/database.types";

export type FormState = { error: string } | undefined;

type ArtifactType = Database["public"]["Enums"]["artifact_type"];

export async function createPortfolioArtifact(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const learnerId = String(formData.get("learnerId") ?? "").trim();
  const environmentId = String(formData.get("environmentId") ?? "").trim() || null;
  const artifactType = String(formData.get("artifactType") ?? "") as ArtifactType;
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const externalUrl = String(formData.get("externalUrl") ?? "").trim();
  const evidenceNote = String(formData.get("evidenceNote") ?? "").trim();
  const visibility = String(formData.get("visibility") ?? "internal") as "internal" | "learner_visible";
  const file = formData.get("file") as File | null;

  if (!learnerId || !artifactType || !title) {
    return { error: "Learner, artifact type, and title are required." };
  }

  let fileReference: string | null = null;
  if (file && file.size > 0) {
    const path = `${learnerId}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("portfolio")
      .upload(path, file, { contentType: file.type || undefined });
    if (uploadError) return { error: `File upload failed: ${uploadError.message}` };
    fileReference = path;
  }

  const { data: artifact, error } = await supabase
    .from("portfolio_artifacts")
    .insert({
      learner_id: learnerId,
      environment_id: environmentId,
      artifact_type: artifactType,
      title,
      description: description || null,
      file_reference: fileReference,
      external_url: externalUrl || null,
      evidence_note: evidenceNote || null,
      visibility,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !artifact) {
    return { error: error?.message ?? "Failed to create portfolio artifact." };
  }

  await logActivity(
    supabase,
    user.id,
    "created",
    "portfolio_artifact",
    artifact.id,
    `Added portfolio artifact "${title}"`,
  );

  revalidatePath("/portfolios");
  revalidatePath(`/profiles/${learnerId}`);
  redirect(`/portfolios?learner=${learnerId}`);
}
