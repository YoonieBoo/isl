"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PrimaryButton } from "@/components/ui";
import { IslLoader } from "@/components/isl-loader";
import { listStudentsToUpdate, updateCourseStudent } from "@/app/actions/course";
import { listWorkshopStudents, refreshClassSummary, updateWorkshopStudent } from "@/app/actions/workshops";

// Students updated in parallel. Each needs several AI calls, so far more than
// this hits the AI service's rate limit and ends up slower, not faster.
const AT_A_TIME = 10;

type Progress = { total: number; done: number; failed: number; skipped: number };

// Updates students one request per student (a few at a time), so a big class
// never hits the server's time limit and the counter can show real progress.
// By default only students with new answers are updated. On the whole-course
// page their new answers are read and their course insights (plus the weeks
// those answers belong to) rebuilt. On a week page (`workshopId`) only that
// week's results are rebuilt, which is much quicker; the whole course is
// updated from its own page. "Re-rate everyone" rebuilds every student (after
// skills change).
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
  const [summarizing, setSummarizing] = useState(false);

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
      const state: Progress = { total: students.length, done: 0, failed: 0, skipped: 0 };
      setProgress({ ...state });
      const queue = [...students];
      await Promise.all(
        Array.from({ length: Math.min(AT_A_TIME, queue.length) }, async () => {
          for (let s = queue.shift(); s; s = queue.shift()) {
            let result: { ok: boolean; skipped?: boolean } = { ok: false };
            try {
              result = workshopId
                ? await updateWorkshopStudent(workshopId, s.id)
                : await updateCourseStudent(environmentId, s.id, { everyone });
            } catch {
              result = { ok: false };
            }
            state.done += 1;
            if (!result.ok) state.failed += 1;
            else if (result.skipped) state.skipped += 1;
            setProgress({ ...state });
          }
        }),
      );
      // The week's class summary is built from everyone's weekly insights.
      if (workshopId && state.done > state.failed) {
        setSummarizing(true);
        await refreshClassSummary(workshopId).catch(() => null);
        setSummarizing(false);
      }
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
            {workshopId ? "Updates this week only, for students with new answers." : "Only students with new answers are updated."}{" "}
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
            {summarizing
              ? "Writing the class summary…"
              : `Updating students… ${progress.done} of ${progress.total} done. Please keep this page open.`}
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
            : progress.skipped
              ? `${progress.total - progress.skipped} students are updated. ${progress.skipped} had no Pre or Post answers this week, so there was nothing to rate.`
              : `All ${progress.total} students are updated.`}
        </div>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
