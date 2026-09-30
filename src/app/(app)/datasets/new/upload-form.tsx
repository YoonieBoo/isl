"use client";

import { useActionState, useState } from "react";
import { Field, Select, PrimaryButton, ErrorText } from "@/components/ui";
import { uploadDatasets, type FormState } from "@/app/actions/datasets";

export function UploadForm({
  environments,
  defaultEnvironmentId,
  returnTo,
}: {
  environments: { id: string; name: string }[];
  defaultEnvironmentId?: string;
  returnTo?: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    uploadDatasets,
    undefined,
  );
  const [fileCount, setFileCount] = useState(0);

  return (
    <form action={formAction} className="space-y-4">
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}

      <Field label="Learning environment" htmlFor="environmentId" required>
        <Select id="environmentId" name="environmentId" required defaultValue={defaultEnvironmentId ?? ""}>
          <option value="" disabled>
            Select an environment
          </option>
          {environments.map((env) => (
            <option key={env.id} value={env.id}>
              {env.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Files (CSV or XLSX)" htmlFor="files" required>
        <input
          id="files"
          name="files"
          type="file"
          accept=".csv,.xlsx"
          required
          multiple
          onChange={(e) => setFileCount(e.target.files?.length ?? 0)}
          className="block w-full text-sm text-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-isl-blue-pale file:px-3 file:py-2 file:text-sm file:font-medium file:text-isl-blue-dark hover:file:bg-isl-blue-pale/80"
        />
        <p className="mt-1.5 text-xs text-foreground-muted">
          Select or drag in as many files as you need — each one becomes its own dataset, named after
          the file. When the learner ID/name columns can be guessed confidently, they&apos;re validated
          right away; otherwise you&apos;ll pick the columns afterward.
        </p>
      </Field>

      <ErrorText>{state?.error}</ErrorText>

      <PrimaryButton type="submit" disabled={pending}>
        {pending
          ? "Uploading…"
          : fileCount > 1
            ? `Upload ${fileCount} files`
            : "Upload"}
      </PrimaryButton>
    </form>
  );
}
