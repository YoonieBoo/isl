"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";
import type { Database } from "@/lib/supabase/database.types";

export type FormState = { error: string } | undefined;

type ReviewDecision = Database["public"]["Enums"]["review_decision"];
type ErrorCategory = Database["public"]["Enums"]["error_category"];

export async function submitReview(
  processingResultId: string,
  learnerId: string | null,
  nextReviewUrl: string | null,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const decision = String(formData.get("decision") ?? "") as ReviewDecision;
  const reviewNotes = String(formData.get("reviewNotes") ?? "").trim();
  const correctedOutputRaw = String(formData.get("correctedOutput") ?? "").trim();
  const errorCategories = formData.getAll("errorCategories") as ErrorCategory[];

  if (!decision) return { error: "Select a review decision." };

  let correctedOutput: unknown = null;
  if (decision === "revise" && correctedOutputRaw) {
    try {
      correctedOutput = JSON.parse(correctedOutputRaw);
    } catch {
      return { error: "Corrected output must be valid JSON." };
    }
  }

  const { error } = await supabase.from("reviews").insert({
    processing_result_id: processingResultId,
    learner_id: learnerId,
    reviewer_id: user.id,
    decision,
    corrected_output: correctedOutput as never,
    error_categories: errorCategories,
    review_notes: reviewNotes || null,
  });

  if (error) return { error: error.message };

  await logActivity(
    supabase,
    user.id,
    "reviewed",
    "processing_result",
    processingResultId,
    `Review decision: ${decision}`,
  );

  revalidatePath("/reviews");
  if (nextReviewUrl) {
    revalidatePath(nextReviewUrl);
    redirect(nextReviewUrl);
  }
  redirect("/reviews");
}
