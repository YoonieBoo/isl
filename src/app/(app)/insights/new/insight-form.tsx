"use client";

import { useActionState } from "react";
import { Field, TextInput, Textarea, PrimaryButton, ErrorText } from "@/components/ui";
import { createLearnerInsight, type FormState } from "@/app/actions/insights";

type Signal = {
  id: string;
  signal_type: string;
  label: string;
  evidence_text: string;
};

export function InsightForm({
  learnerId,
  learnerName,
  environmentId,
  processingRunId,
  signals,
}: {
  learnerId: string;
  learnerName: string;
  environmentId: string;
  processingRunId: string | null;
  signals: Signal[];
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createLearnerInsight,
    undefined,
  );

  const byType = (type: string) =>
    signals
      .filter((s) => s.signal_type === type)
      .map((s) => `${s.label}: ${s.evidence_text}`)
      .join("\n");

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="learnerId" value={learnerId} />
      <input type="hidden" name="environmentId" value={environmentId} />
      {processingRunId && <input type="hidden" name="processingRunId" value={processingRunId} />}
      {signals.map((s, i) => (
        <span key={`${s.id}-${i}`}>
          <input type="hidden" name="evidenceSignalId" value={s.id} />
          <input type="hidden" name="evidenceText" value={`${s.label}: ${s.evidence_text}`} />
        </span>
      ))}

      <Field label="Title" htmlFor="title" required>
        <TextInput id="title" name="title" required defaultValue={`Insight for ${learnerName}`} />
      </Field>

      <Field label="Summary" htmlFor="summary" required>
        <Textarea id="summary" name="summary" rows={3} required />
      </Field>

      <Field label="Observed strengths (one per line)" htmlFor="observedStrengths">
        <Textarea id="observedStrengths" name="observedStrengths" rows={3} defaultValue={byType("strength")} />
      </Field>

      <Field label="Development needs (one per line)" htmlFor="developmentNeeds">
        <Textarea id="developmentNeeds" name="developmentNeeds" rows={3} defaultValue={byType("need")} />
      </Field>

      <Field label="Learning preferences (one per line)" htmlFor="learningPreferences">
        <Textarea id="learningPreferences" name="learningPreferences" rows={2} defaultValue={byType("preference")} />
      </Field>

      <Field label="Concerns (one per line)" htmlFor="concerns">
        <Textarea id="concerns" name="concerns" rows={2} defaultValue={byType("concern")} />
      </Field>

      <Field label="Interpretation boundary" htmlFor="interpretationBoundary">
        <Textarea
          id="interpretationBoundary"
          name="interpretationBoundary"
          rows={2}
          placeholder="e.g. Based on one week of reflections only — needs further evidence before treating as a stable pattern."
        />
      </Field>

      <ErrorText>{state?.error}</ErrorText>

      <PrimaryButton type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save as candidate insight"}
      </PrimaryButton>
    </form>
  );
}
