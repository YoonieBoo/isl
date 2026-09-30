// AU spreadsheets identify the same student either by plain student number
// ("6730071") or by AU login ("u6730071"). Treating those as different IDs
// created 20 duplicate learners, so every ID is stored in the bare-number form.
export function normalizeStudentId(raw: string): string {
  const trimmed = raw.trim();
  return /^[uU]\d+$/.test(trimmed) ? trimmed.slice(1) : trimmed;
}
