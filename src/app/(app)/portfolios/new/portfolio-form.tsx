"use client";

import { useActionState } from "react";
import { Field, TextInput, Textarea, Select, PrimaryButton, ErrorText } from "@/components/ui";
import { createPortfolioArtifact, type FormState } from "@/app/actions/portfolio";

const ARTIFACT_TYPES = [
  "project",
  "assignment",
  "workshop_output",
  "reflection",
  "prototype",
  "presentation",
  "achievement",
  "other_evidence",
];

export function PortfolioForm({
  learners,
  environments,
  defaultLearnerId,
}: {
  learners: { id: string; display_name: string }[];
  environments: { id: string; name: string }[];
  defaultLearnerId?: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createPortfolioArtifact,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Learner" htmlFor="learnerId" required>
          <Select id="learnerId" name="learnerId" required defaultValue={defaultLearnerId ?? ""}>
            <option value="" disabled>
              Select a learner
            </option>
            {learners.map((l) => (
              <option key={l.id} value={l.id}>
                {l.display_name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Learning environment (optional)" htmlFor="environmentId">
          <Select id="environmentId" name="environmentId" defaultValue="">
            <option value="">None</option>
            {environments.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Artifact type" htmlFor="artifactType" required>
        <Select id="artifactType" name="artifactType" required defaultValue="">
          <option value="" disabled>
            Select a type
          </option>
          {ARTIFACT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.replace(/_/g, " ")}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Title" htmlFor="title" required>
        <TextInput id="title" name="title" required />
      </Field>

      <Field label="Description" htmlFor="description">
        <Textarea id="description" name="description" rows={2} />
      </Field>

      <Field label="File (optional)" htmlFor="file">
        <input
          id="file"
          name="file"
          type="file"
          className="block w-full text-sm text-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-isl-blue-pale file:px-3 file:py-2 file:text-sm file:font-medium file:text-isl-blue-dark"
        />
      </Field>

      <Field label="External URL (optional)" htmlFor="externalUrl">
        <TextInput id="externalUrl" name="externalUrl" type="url" placeholder="https://…" />
      </Field>

      <Field label="Evidence note" htmlFor="evidenceNote">
        <Textarea id="evidenceNote" name="evidenceNote" rows={2} />
      </Field>

      <Field label="Visibility" htmlFor="visibility">
        <Select id="visibility" name="visibility" defaultValue="internal">
          <option value="internal">Internal (staff only)</option>
          <option value="learner_visible">Visible to learner</option>
        </Select>
      </Field>

      <ErrorText>{state?.error}</ErrorText>

      <PrimaryButton type="submit" disabled={pending}>
        {pending ? "Saving…" : "Add artifact"}
      </PrimaryButton>
    </form>
  );
}
