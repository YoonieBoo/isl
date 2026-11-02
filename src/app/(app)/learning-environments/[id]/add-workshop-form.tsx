"use client";

import { useActionState, useState } from "react";
import { PrimaryButton, SecondaryButton, TextInput } from "@/components/ui";
import { createWorkshop, type WorkshopFormState } from "@/app/actions/workshops";

// "Add a week" on the course page: week number, topic and date.
export function AddWorkshopForm({ environmentId, nextWeek }: { environmentId: string; nextWeek: number }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<WorkshopFormState, FormData>(
    createWorkshop.bind(null, environmentId),
    undefined,
  );

  if (!open) {
    return (
      <SecondaryButton type="button" onClick={() => setOpen(true)}>
        Add a week
      </SecondaryButton>
    );
  }

  return (
    <form action={formAction} className="space-y-3 rounded-lg border border-border p-4">
      <div className="grid gap-3 sm:grid-cols-[6rem_1fr_10rem]">
        <label className="text-xs font-medium text-foreground-muted">
          Week
          <TextInput name="week_number" type="number" min={1} max={52} defaultValue={nextWeek} required className="mt-1" />
        </label>
        <label className="text-xs font-medium text-foreground-muted">
          Workshop topic
          <TextInput name="title" placeholder="e.g. From Problems to Opportunities" required className="mt-1" />
        </label>
        <label className="text-xs font-medium text-foreground-muted">
          Date
          <TextInput name="workshop_date" type="date" className="mt-1" />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <PrimaryButton type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add week"}
        </PrimaryButton>
        <SecondaryButton type="button" onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </SecondaryButton>
        {state?.error && <span className="text-sm text-danger">{state.error}</span>}
      </div>
    </form>
  );
}
