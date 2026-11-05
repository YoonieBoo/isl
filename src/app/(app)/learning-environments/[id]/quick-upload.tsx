"use client";

import { useActionState, useRef } from "react";
import { SecondaryButton } from "@/components/ui";
import { uploadDatasets, type FormState } from "@/app/actions/datasets";

// "Upload form file" right where it is needed: picking the file(s) uploads
// them straight away into this course (and week), then returns to this page.
export function QuickUpload({
  environmentId,
  workshopId,
  returnTo,
}: {
  environmentId: string;
  workshopId?: string;
  returnTo: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, formAction, pending] = useActionState<FormState, FormData>(uploadDatasets, undefined);

  return (
    <form ref={formRef} action={formAction} className="inline-flex flex-col">
      <input type="hidden" name="environmentId" value={environmentId} />
      {workshopId && <input type="hidden" name="workshopId" value={workshopId} />}
      <input type="hidden" name="returnTo" value={returnTo} />
      <input
        ref={inputRef}
        name="files"
        type="file"
        accept=".csv,.xlsx"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) formRef.current?.requestSubmit();
        }}
      />
      <SecondaryButton type="button" disabled={pending} onClick={() => inputRef.current?.click()}>
        {pending ? "Uploading…" : "Upload form file"}
      </SecondaryButton>
      {state?.error && <span className="mt-1 text-sm text-danger">{state.error}</span>}
    </form>
  );
}
