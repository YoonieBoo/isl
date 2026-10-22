"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PrimaryButton } from "@/components/ui";
import { IslLoader } from "@/components/isl-loader";
import { listStudentsToUpdate, updateCourseStudent } from "@/app/actions/course";

const AT_A_TIME = 3;

type Progress = { total: number; done: number; failed: number };

// Updates every student in the course one request per student (a few at a
// time), so a big class never hits the server's time limit and the counter
// can show real progress. Answers already read are skipped on the server, so
// clicking again after an interruption just finishes the rest.
export function UpdateAllStudents({ environmentId, disabledReason }: { environmentId: string; disabledReason: string | null }) {
  const router = useRouter();
  const [progress, setProgress] = useState<Progress | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setRunning(true);
    setError(null);
    try {
      const students = await listStudentsToUpdate(environmentId);
      if (students.length === 0) {
        setError("No matched form answers yet. Upload a form file for this course first.");
        return;
      }
      const state: Progress = { total: students.length, done: 0, failed: 0 };
      setProgress({ ...state });
      const queue = [...students];
      await Promise.all(
        Array.from({ length: Math.min(AT_A_TIME, queue.length) }, async () => {
          for (let s = queue.shift(); s; s = queue.shift()) {
            let ok = false;
            try {
              ok = (await updateCourseStudent(environmentId, s.id)).ok;
            } catch {
              ok = false;
            }
            state.done += 1;
            if (!ok) state.failed += 1;
            setProgress({ ...state });
          }
        }),
      );
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <PrimaryButton type="button" onClick={start} disabled={running || Boolean(disabledReason)}>
          {running ? "Updating…" : "Update all students"}
        </PrimaryButton>
        {disabledReason && <span className="text-sm text-foreground-muted">{disabledReason}</span>}
      </div>

      {running && progress && (
        <div className="flex items-center gap-3 rounded-lg border border-isl-blue-pale bg-isl-blue-pale/50 p-3 text-sm text-foreground">
          <IslLoader size={22} label="Updating students" />
          <span>
            Updating students… {progress.done} of {progress.total} done. Please keep this page open.
          </span>
        </div>
      )}
      {!running && progress && (
        <div
          className={`rounded-lg border p-3 text-sm ${
            progress.failed ? "border-amber-200 bg-amber-50 text-warning" : "border-green-200 bg-green-50 text-success"
          }`}
        >
          {progress.failed
            ? `${progress.done - progress.failed} of ${progress.total} students updated. ${progress.failed} couldn't be updated — click “Update all students” again to retry them.`
            : `All ${progress.total} students are updated.`}
        </div>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
