const PRIMARY_FIELD_CANDIDATES = ["raw_evidence", "response", "answer", "reflection", "evidence_text"];

export function pickPrimaryField(sourceData: Record<string, string>): string | undefined {
  return PRIMARY_FIELD_CANDIDATES.find((f) => sourceData[f]);
}
