"use client";

import { useActionState, useState } from "react";
import { PrimaryButton, SecondaryButton } from "@/components/ui";
import { saveCourseSkills, type SkillsFormState } from "@/app/actions/course";

type Row = { id: number; key: string; name: string; description: string };

const fieldClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-isl-blue";

// The course's fixed skill list. Every student in the course is rated on
// exactly these skills, so they can be compared side by side.
export function CourseSkillsEditor({
  environmentId,
  initialSkills,
}: {
  environmentId: string;
  initialSkills: { key: string; name: string; description: string }[];
}) {
  const [rows, setRows] = useState<Row[]>(() =>
    initialSkills.length > 0
      ? initialSkills.map((s, i) => ({ id: i, ...s }))
      : Array.from({ length: 3 }, (_, i) => ({ id: i, key: "", name: "", description: "" })),
  );
  const [state, formAction, pending] = useActionState<SkillsFormState, FormData>(
    saveCourseSkills.bind(null, environmentId),
    undefined,
  );

  return (
    <form action={formAction}>
      <div className="hidden gap-3 text-xs font-medium text-foreground-muted sm:grid sm:grid-cols-[14rem_1fr_auto]">
        <span>Skill</span>
        <span>What it means (helps the AI rate it)</span>
        <span className="w-16" />
      </div>
      <ul className="mt-2 space-y-2">
        {rows.map((row, i) => (
          <li key={row.id} className="grid gap-2 sm:grid-cols-[14rem_1fr_auto] sm:items-start">
            <input type="hidden" name="skill_key" value={row.key} />
            <input
              name="skill_name"
              aria-label={`Skill ${i + 1}`}
              defaultValue={row.name}
              placeholder="e.g. Sprint planning"
              className={fieldClass}
            />
            <input
              name="skill_description"
              aria-label={`What skill ${i + 1} means`}
              defaultValue={row.description}
              placeholder="e.g. Breaks work into small, realistic sprint goals"
              className={fieldClass}
            />
            <button
              type="button"
              onClick={() => setRows((r) => r.filter((x) => x.id !== row.id))}
              className="w-16 rounded-lg px-2 py-2 text-sm text-foreground-muted hover:bg-surface-pale hover:text-danger"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <SecondaryButton
          type="button"
          onClick={() => setRows((r) => [...r, { id: Date.now(), key: "", name: "", description: "" }])}
          disabled={rows.length >= 10}
        >
          Add skill
        </SecondaryButton>
        <PrimaryButton type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save skills"}
        </PrimaryButton>
        {state?.saved && !pending && <span className="text-sm text-success">Saved. Click “Update all students” to rate everyone on these skills.</span>}
        {state?.error && <span className="text-sm text-danger">{state.error}</span>}
      </div>
    </form>
  );
}
