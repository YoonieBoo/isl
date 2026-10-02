// "DDI2331 Design Thinking" -> "DDI2331"; names without a course code are kept as-is.
export function courseCode(name: string): string {
  return name.match(/\b[A-Z]{2,}\s?\d{3,}[A-Z]?\b/)?.[0]?.replace(/\s/g, "") ?? name;
}

// "4. DDI2331 Workshop 2 — Learning Reflection (Responses) (1)" -> "Workshop 2 — Learning Reflection".
// Upload filenames carry ordering numbers, the course code and Google Forms'
// "(Responses)" suffix, none of which help someone reading the evidence.
export function shortFormName(name: string): string {
  const cleaned = name
    .replace(/^\s*\d+\.\s*/, "")
    .replace(/\s*\(Responses\)/gi, "")
    .replace(/\s*\(\d+\)\s*$/, "")
    .replace(/^\s*[A-Z]{2,}\s?\d{3,}[A-Z]?\s*[—–-]?\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || name;
}
