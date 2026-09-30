"use client";

import { useActionState, useState } from "react";
import { Field, Select, Textarea, PrimaryButton, ErrorText } from "@/components/ui";
import { submitReview, type FormState } from "@/app/actions/reviews";

const DECISIONS = [
  { value: "agree", label: "Agree" },
  { value: "revise", label: "Revise" },
  { value: "reject", label: "Reject" },
  { value: "unsure", label: "Mark Unsure" },
  { value: "needs_more_evidence", label: "Request More Evidence" },
  { value: "request_rerun", label: "Request Rerun" },
];

const ERROR_CATEGORIES = [
  "false_positive",
  "false_negative",
  "over_interpretation",
  "missing_signal",
  "normalization_error",
  "taxonomy_mismatch",
  "pattern_mismatch",
  "insufficient_evidence",
];

export function ReviewForm({
  processingResultId,
  learnerId,
  defaultCorrectedOutput,
  nextReviewUrl,
}: {
  processingResultId: string;
  learnerId: string | null;
  defaultCorrectedOutput: string;
  nextReviewUrl?: string | null;
}) {
  const boundAction = submitReview.bind(null, processingResultId, learnerId, nextReviewUrl ?? null);
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    boundAction,
    undefined,
  );
  const [decision, setDecision] = useState("agree");

  return (
    <form action={formAction} className="space-y-4">
      <Field label="Decision" htmlFor="decision" required>
        <Select id="decision" name="decision" value={decision} onChange={(e) => setDecision(e.target.value)}>
          {DECISIONS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </Select>
      </Field>

      {decision === "revise" && (
        <Field label="Corrected output (JSON)" htmlFor="correctedOutput">
          <Textarea
            id="correctedOutput"
            name="correctedOutput"
            rows={8}
            defaultValue={defaultCorrectedOutput}
            className="font-mono text-xs"
          />
        </Field>
      )}

      <fieldset>
        <legend className="text-sm font-medium text-foreground">
          Error categories (optional)
        </legend>
        <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
          {ERROR_CATEGORIES.map((cat) => (
            <label key={cat} className="flex items-center gap-2 text-foreground-muted">
              <input type="checkbox" name="errorCategories" value={cat} className="rounded border-border" />
              {cat.replace(/_/g, " ")}
            </label>
          ))}
        </div>
      </fieldset>

      <Field label="Review notes" htmlFor="reviewNotes">
        <Textarea id="reviewNotes" name="reviewNotes" rows={3} />
      </Field>

      <ErrorText>{state?.error}</ErrorText>

      <PrimaryButton type="submit" disabled={pending}>
        {pending ? "Submitting…" : "Submit review"}
      </PrimaryButton>
    </form>
  );
}
