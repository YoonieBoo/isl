"use client";

import { useActionState } from "react";
import { PrimaryButton, TextInput, Textarea } from "@/components/ui";
import type { SkillsFormState } from "@/app/actions/course";

// Topic, date and learning objectives of one week.
export function WeekDetailsForm({
  save,
  title,
  date,
  objectives,
}: {
  save: (prev: SkillsFormState, formData: FormData) => Promise<SkillsFormState>;
  title: string;
  date: string | null;
  objectives: string | null;
}) {
  const [state, formAction, pending] = useActionState<SkillsFormState, FormData>(save, undefined);
  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
        <label className="text-xs font-medium text-foreground-muted">
          Workshop topic
          <TextInput name="title" defaultValue={title} required className="mt-1" />
        </label>
        <label className="text-xs font-medium text-foreground-muted">
          Date
          <TextInput name="workshop_date" type="date" defaultValue={date ?? ""} className="mt-1" />
        </label>
      </div>
      <label className="block text-xs font-medium text-foreground-muted">
        Learning objectives (what students should be able to do after this week)
        <Textarea
          name="learning_objectives"
          defaultValue={objectives ?? ""}
          rows={4}
          placeholder={"e.g.\n1. Identify and clearly describe a healthcare-related problem.\n2. Explain who is affected and what value could be created."}
          className="mt-1"
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <PrimaryButton type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save week details"}
        </PrimaryButton>
        {state?.saved && !pending && <span className="text-sm text-success">Saved.</span>}
        {state?.error && <span className="text-sm text-danger">{state.error}</span>}
      </div>
    </form>
  );
}
