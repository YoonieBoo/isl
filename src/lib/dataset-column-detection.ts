import { AU_EMAIL } from "@/lib/student-id";

const ID_COLUMN_CANDIDATES = [
  "student id",
  "student id number",
  "student number",
  "student no",
  "student no.",
  "id number",
  "learner id",
  "external reference",
  "external_reference",
  "learner_id",
  "id",
];
const EMAIL_COLUMN_CANDIDATES = ["email address", "email", "e-mail"];
const NAME_COLUMN_CANDIDATES = ["full name", "display name", "student name", "learner name", "name"];

// Google Forms (the source of most real course exports we've seen) numbers
// every question column, e.g. "1. Student ID" — strip that prefix before
// comparing, or every such file falls back to picking columns by hand.
function normalize(column: string): string {
  return column.toLowerCase().trim().replace(/^\d+[.)]\s*/, "");
}

function findColumn(columns: string[], candidates: string[]): string | undefined {
  const normalized = columns.map(normalize);
  for (const candidate of candidates) {
    const index = normalized.indexOf(candidate);
    if (index !== -1) return columns[index];
  }
  return undefined;
}

// Best-effort guess at which column holds the learner ID/name, so the
// validate step can come pre-filled instead of making someone pick from a
// dropdown for every single file in a multi-file upload.
//
// Forms filled in with university Google accounts carry the student's AU
// email (u6511158@au.edu), which Google fills in itself — unlike a typed
// "Student ID" answer, it can't be mistyped (typed IDs caused the duplicate
// students in Q3). So when most emails in the file are AU student emails, the
// email column is used as the ID; normalizeStudentId turns it into 6511158.
export function suggestColumns(
  columns: string[],
  rows: Record<string, string>[] = [],
): { idColumn?: string; nameColumn?: string } {
  const emailColumn = findColumn(columns, EMAIL_COLUMN_CANDIDATES);
  let idColumn = findColumn(columns, ID_COLUMN_CANDIDATES);
  if (emailColumn && rows.length > 0) {
    const filled = rows.map((r) => (r[emailColumn] ?? "").trim()).filter(Boolean);
    const auShare = filled.length ? filled.filter((v) => AU_EMAIL.test(v)).length / filled.length : 0;
    if (auShare >= 0.8 || !idColumn) idColumn = emailColumn;
  } else if (!idColumn && emailColumn) {
    idColumn = emailColumn;
  }
  return { idColumn: idColumn ?? findColumnLoosely(columns, /student\s*(id|no|number)/), nameColumn: findColumn(columns, NAME_COLUMN_CANDIDATES) ?? findColumnLoosely(columns, /\b(full|student|your)\s+name\b|^name\b/, /team|group|project|product|file|business|company/) };
}

// Fallback for reworded questions, e.g. "Full Name (English)" or
// "Student ID (e.g. 6612345)". `exclude` keeps "Team name" and the like from
// being mistaken for the student's own name.
function findColumnLoosely(columns: string[], pattern: RegExp, exclude?: RegExp): string | undefined {
  return columns.find((c) => {
    const n = normalize(c);
    return pattern.test(n) && !(exclude && exclude.test(n));
  });
}
