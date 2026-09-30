"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field, TextInput, PrimaryButton, ErrorText } from "@/components/ui";
import type { FormState } from "@/app/actions/learners";

export function LearnerForm({
  action,
  defaultValues,
  submitLabel,
  onCancelHref,
  environmentId,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  defaultValues?: {
    displayName: string;
    externalReference: string | null;
    email: string | null;
  };
  submitLabel: string;
  onCancelHref: string;
  environmentId?: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-4">
      {environmentId && (
        <input type="hidden" name="environmentId" value={environmentId} />
      )}

      <Field label="Display name" htmlFor="displayName" required>
        <TextInput
          id="displayName"
          name="displayName"
          required
          defaultValue={defaultValues?.displayName}
        />
      </Field>

      <Field label="External learner reference" htmlFor="externalReference">
        <TextInput
          id="externalReference"
          name="externalReference"
          defaultValue={defaultValues?.externalReference ?? ""}
          placeholder="e.g. student ID from the source system"
        />
      </Field>

      <Field label="Email" htmlFor="email">
        <TextInput
          id="email"
          name="email"
          type="email"
          defaultValue={defaultValues?.email ?? ""}
        />
      </Field>

      <ErrorText>{state?.error}</ErrorText>

      <div className="flex items-center gap-3">
        <PrimaryButton type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </PrimaryButton>
        <Link
          href={onCancelHref}
          className="text-sm font-medium text-foreground-muted hover:text-foreground"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
