// AU spreadsheets identify the same student either by plain student number
// ("6730071") or by AU login ("u6730071"). Treating those as different IDs
// created 20 duplicate learners, so every ID is stored in the bare-number form.
export function normalizeStudentId(raw: string): string {
  const trimmed = raw.trim();
  // University Google accounts ("u6511158@au.edu") -> the bare student number.
  const auEmail = trimmed.match(AU_EMAIL);
  if (auEmail) return auEmail[1];
  return /^[uU]\d+$/.test(trimmed) ? trimmed.slice(1) : trimmed;
}

// AU student login emails: optional "u", the student number, then @au.edu
// (or a subdomain of it).
export const AU_EMAIL = /^[uU]?(\d{5,})@([a-z0-9-]+\.)*au\.edu$/i;
