"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field, TextInput, Textarea, PrimaryButton, ErrorText } from "@/components/ui";
import type { FormState } from "@/app/actions/learning-environments";

export function EnvironmentForm({
  action,
  defaultValues,
  submitLabel,
  onCancelHref,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  defaultValues?: {
    name: string;
    organisationName: string;
    environmentType: string;
    courseOrWorkshop: string;
    description: string | null;
    learningObjectives: string | null;
  };
  submitLabel: string;
  onCancelHref: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-4">
      <Field label="Name" htmlFor="name" required>
        <TextInput
          id="name"
          name="name"
          required
          defaultValue={defaultValues?.name}
          placeholder="e.g. Fintech Bootcamp Cohort 4"
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Organisation / Institution" htmlFor="organisationName" required>
          <TextInput
            id="organisationName"
            name="organisationName"
            required
            defaultValue={defaultValues?.organisationName}
            placeholder="e.g. Peanuts Academy"
          />
        </Field>
        <Field label="Environment type" htmlFor="environmentType" required>
          <TextInput
            id="environmentType"
            name="environmentType"
            required
            defaultValue={defaultValues?.environmentType}
            placeholder="e.g. professional upskilling program"
          />
        </Field>
      </div>

      <Field label="Course / Workshop name" htmlFor="courseOrWorkshop" required>
        <TextInput
          id="courseOrWorkshop"
          name="courseOrWorkshop"
          required
          defaultValue={defaultValues?.courseOrWorkshop}
        />
      </Field>

      <Field label="Description" htmlFor="description">
        <Textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={defaultValues?.description ?? ""}
        />
      </Field>

      <Field label="Learning objectives" htmlFor="learningObjectives">
        <Textarea
          id="learningObjectives"
          name="learningObjectives"
          rows={3}
          defaultValue={defaultValues?.learningObjectives ?? ""}
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
