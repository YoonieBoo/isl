const ID_COLUMN_CANDIDATES = ["student id", "learner id", "external reference", "external_reference", "learner_id", "id"];
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
export function suggestColumns(columns: string[]): { idColumn?: string; nameColumn?: string } {
  return {
    idColumn: findColumn(columns, ID_COLUMN_CANDIDATES),
    nameColumn: findColumn(columns, NAME_COLUMN_CANDIDATES),
  };
}
