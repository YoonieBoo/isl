import Link from "next/link";
import { AutoRefresh } from "@/components/auto-refresh";

// Names only; each opens the student's insights.
export function StudentList({
  students,
  emptyText,
}: {
  students: { id: string; name: string; href: string; note?: string }[];
  emptyText: string;
}) {
  if (students.length === 0) return <p className="text-sm text-foreground-muted">{emptyText}</p>;
  return (
    <ul className="divide-y divide-border rounded-lg border border-border">
      {students.map((s) => (
        <li key={s.id}>
          <Link href={s.href} className="flex items-center justify-between gap-2 px-4 py-3 text-sm hover:bg-surface-pale">
            <span className="font-medium text-isl-blue">{s.name}</span>
            {s.note && <span className="text-xs text-foreground-muted">{s.note}</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}

type PendingFile = { id: string; name: string; validation_summary: unknown };

// Files still waiting to be matched to students: those with a student
// email/ID column are matched automatically in the background; the rest wait
// for someone to pick the column by hand.
export function splitPending(files: PendingFile[]) {
  const autoMatch = (f: PendingFile) => {
    const summary = f.validation_summary as { suggestedIdColumn?: string | null } | null;
    return Boolean(summary?.suggestedIdColumn);
  };
  return { matching: files.some(autoMatch), needsColumns: files.filter((f) => !autoMatch(f)) };
}

// After "Upload form file": says how many files went up, and keeps the page
// refreshing while the students in them are still being matched.
export function UploadBanner({
  uploaded,
  failed,
  matching,
  needsColumns,
}: {
  uploaded: number;
  failed: number;
  matching: boolean;
  needsColumns: { id: string; name: string }[];
}) {
  return (
    <>
      {needsColumns.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-warning">
          {needsColumns.map((f) => (
            <p key={f.id}>
              Couldn&apos;t find the student email or ID column in “{f.name}”.{" "}
              <Link href={`/datasets/${f.id}`} className="font-medium underline">
                Pick it here
              </Link>
              .
            </p>
          ))}
        </div>
      )}
      <AutoRefresh active={matching} intervalMs={4000} />
      {uploaded > 0 && (matching || needsColumns.length === 0) && (
        <div
          className={`mt-4 rounded-lg border p-3 text-sm ${
            matching ? "border-isl-blue-pale bg-isl-blue-pale/50 text-foreground" : "border-green-200 bg-green-50 text-success"
          }`}
        >
          {matching
            ? `Uploaded ${uploaded} file${uploaded === 1 ? "" : "s"}. Matching students… this page refreshes by itself.`
            : `Uploaded ${uploaded} file${uploaded === 1 ? "" : "s"} and matched the students. Next: click “Update students”.`}
          {failed > 0 && ` ${failed} file${failed === 1 ? "" : "s"} couldn't be uploaded.`}
        </div>
      )}
    </>
  );
}
