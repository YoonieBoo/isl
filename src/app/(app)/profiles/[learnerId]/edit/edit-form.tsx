"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Card, PrimaryButton, SecondaryButton } from "@/components/ui";
import { saveInsightEdits, type EditFormState } from "@/app/actions/insight-edits";
import { LEVEL_LABEL, SKILL_LEVELS, type SkillLevel } from "@/lib/skills/frameworks";

type EditableSkill = {
  key: string;
  name: string;
  description: string;
  level: SkillLevel;
  summary: string;
  editedBy: string | null;
};

const fieldClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-isl-blue";

export function EditInsightsForm({
  learnerId,
  environmentId,
  overview,
  preferences,
  skills,
}: {
  learnerId: string;
  environmentId: string;
  overview: string;
  preferences: string[];
  skills: EditableSkill[];
}) {
  const [state, formAction, pending] = useActionState<EditFormState, FormData>(
    saveInsightEdits.bind(null, learnerId, environmentId),
    undefined,
  );

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <Card>
        <label htmlFor="overview" className="text-base font-semibold text-foreground">
          Overview
        </label>
        <textarea id="overview" name="overview" rows={9} defaultValue={overview} className={`mt-3 ${fieldClass}`} />
      </Card>

      <Card>
        <h2 className="text-base font-semibold text-foreground">Skills</h2>
        <p className="mt-1 text-sm text-foreground-muted">
          The level decides whether a skill shows under Strengths (Strong) or Development focus.
        </p>
        <ul className="mt-4 divide-y divide-border border-t border-border">
          {skills.map((skill) => (
            <li key={skill.key} className="grid gap-3 py-4 sm:grid-cols-[14rem_1fr]">
              <div>
                <label htmlFor={`level_${skill.key}`} className="text-sm font-semibold text-foreground" title={skill.description}>
                  {skill.name}
                </label>
                <select
                  id={`level_${skill.key}`}
                  name={`level_${skill.key}`}
                  defaultValue={skill.level}
                  className={`mt-2 ${fieldClass}`}
                >
                  {SKILL_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {LEVEL_LABEL[level]}
                    </option>
                  ))}
                </select>
                {skill.editedBy && <p className="mt-1.5 text-xs text-foreground-muted">Edited by {skill.editedBy}</p>}
              </div>
              <div>
                <label htmlFor={`summary_${skill.key}`} className="text-xs font-medium text-foreground-muted">
                  Reason
                </label>
                <textarea
                  id={`summary_${skill.key}`}
                  name={`summary_${skill.key}`}
                  rows={3}
                  defaultValue={skill.summary}
                  className={`mt-1 ${fieldClass}`}
                />
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <label htmlFor="preferences" className="text-base font-semibold text-foreground">
          Learning preferences
        </label>
        <p className="mt-1 text-sm text-foreground-muted">One per line. Delete a line to remove it.</p>
        <textarea
          id="preferences"
          name="preferences"
          rows={Math.max(4, preferences.length + 1)}
          defaultValue={preferences.join("\n")}
          className={`mt-3 ${fieldClass}`}
        />
      </Card>

      {state?.error && <p className="text-sm text-danger">{state.error}</p>}

      <div className="flex items-center gap-2">
        <PrimaryButton type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </PrimaryButton>
        <Link href={`/profiles/${learnerId}?environment=${environmentId}`}>
          <SecondaryButton type="button">Cancel</SecondaryButton>
        </Link>
      </div>
    </form>
  );
}
