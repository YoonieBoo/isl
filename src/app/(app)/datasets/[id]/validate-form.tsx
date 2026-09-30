"use client";

import { useState, useTransition } from "react";
import { Field, Select, PrimaryButton, ErrorText } from "@/components/ui";
import { validateDataset } from "@/app/actions/datasets";

export function ValidateForm({
  datasetId,
  columns,
  defaultIdColumn,
  defaultNameColumn,
}: {
  datasetId: string;
  columns: string[];
  defaultIdColumn?: string;
  defaultNameColumn?: string;
}) {
  const [idColumn, setIdColumn] = useState(defaultIdColumn ?? "");
  const [nameColumn, setNameColumn] = useState(defaultNameColumn ?? "");
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Learner ID column" htmlFor="idColumn" required>
          <Select
            id="idColumn"
            value={idColumn}
            onChange={(e) => setIdColumn(e.target.value)}
          >
            <option value="" disabled>
              Select a column
            </option>
            {columns.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Learner name column (optional)" htmlFor="nameColumn">
          <Select
            id="nameColumn"
            value={nameColumn}
            onChange={(e) => setNameColumn(e.target.value)}
          >
            <option value="">Use ID as name for new learners</option>
            {columns.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <ErrorText>{error}</ErrorText>

      <PrimaryButton
        type="button"
        disabled={!idColumn || pending}
        onClick={() => {
          setError(undefined);
          startTransition(async () => {
            try {
              await validateDataset(datasetId, idColumn, nameColumn || null);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Validation failed.");
            }
          });
        }}
      >
        {pending ? "Validating…" : "Run validation"}
      </PrimaryButton>
      <p className="text-xs text-foreground-muted">
        Matches each row&apos;s ID value against existing learners by external
        reference; unmatched IDs create new learner records automatically.
      </p>
    </div>
  );
}
