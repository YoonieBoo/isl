// Form columns that identify the learner or are bookkeeping, not answers.
export const NON_ANSWER_FIELD = /timestamp|e-?mail|\bname\b|student\s*(id|code)|^id$|\bscore\b|\bsection\b|^\+/i;

export function isUsableAnswer(text: string): boolean {
  const t = text.trim();
  if (!t || /^(-|n\/?a|none|no|yes)$/i.test(t)) return false;
  if (/^https?:\/\/\S+$/.test(t)) return false; // bare upload links
  return true;
}

/** The answer columns in one form response, so nobody has to type question names in. */
export function autoEvidenceFields(sourceData: Record<string, unknown>): string[] {
  return Object.entries(sourceData)
    .filter(([question, value]) => !NON_ANSWER_FIELD.test(question) && isUsableAnswer(String(value ?? "")))
    .map(([question]) => question);
}
