"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PrimaryButton } from "@/components/ui";
import { IslLoader } from "@/components/isl-loader";
import { listStudentsToUpdate, updateCourseStudent } from "@/app/actions/course";
import { listWorkshopStudents, updateWorkshopStudent } from "@/app/actions/workshops";

const AT_A_TIME = 3;

type Progress = { total: number; done: number; failed: number };

// Updates students one request per student (a few at a time), so a big class
// never hits the server's time limit and the counter can show real progress.
// By default only students with new answers are updated: their new answers
// are read, then their course insights and the weeks those answers belong to
// are rebuilt. "Re-rate everyone" rebuilds every student (after skills
// change) — the whole course, or with `workshopId` just that week.
export function UpdateAllStudents({
  environmentId,
  workshopId,
  disabledReason,
}: {
  environmentId: string;
  workshopId?: string;
  disabledReason: string | null;
}) {
  const router = useRouter();
  const [progress, setProgress] = useState<Progress | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upToDate, setUpToDate] = useState(false);

  async function start(everyone = false) {
    setRunning(true);
    setError(null);
    setUpToDate(false);
    setProgress(null);
    try {
      const students = workshopId
        ? await listWorkshopStudents(workshopId, { onlyNew: !everyone })
        : await listStudentsToUpdate(environmentId, { everyone });
      if (students.length === 0) {
        if (everyone) setError("No matched form answers yet. Upload a form file first.");
        else setUpToDate(true);
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
              ok =
                workshopId && everyone
                  ? (await updateWorkshopStudent(workshopId, s.id)).ok
                  : (await updateCourseStudent(environmentId, s.id, { everyone })).ok;
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
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <PrimaryButton type="button" onClick={() => start()} disabled={running || Boolean(disabledReason)}>
          {running ? "Updating…" : "Update students"}
        </PrimaryButton>
        {disabledReason ? (
          <span className="text-sm text-foreground-muted">{disabledReason}</span>
        ) : (
          <span className="text-xs text-foreground-muted">
            Only students with new answers are updated.{" "}
            <button
              type="button"
              onClick={() => start(true)}
              disabled={running}
              className="font-medium text-isl-blue hover:underline disabled:opacity-50"
            >
              Re-rate everyone
            </button>{" "}
            after changing skills.
          </span>
        )}
      </div>
      {upToDate && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-success">
          Everyone is up to date. There are no new answers since the last update.
        </div>
      )}

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
            ? `${progress.done - progress.failed} of ${progress.total} students updated. ${progress.failed} couldn't be updated — click “Update students” again to retry them.`
            : `All ${progress.total} students are updated.`}
        </div>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
