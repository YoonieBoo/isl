import "server-only";

// Synthesizes the learner's already-approved, evidence-backed bullets into a
// short narrative paragraph for the PDF report's overview section. This is
// explicitly a rewording/summarization task, not a new extraction — the
// prompt is scoped to only the bullets given, so it can't introduce claims
// that weren't already reviewed/approved elsewhere in the pipeline.
export async function generateLearnerOverview(params: {
  learnerName: string;
  strengths: string[];
  developmentNeeds: string[];
  learningPreferences: string[];
  environments: string[];
}): Promise<string | null> {
  const hasContent =
    params.strengths.length + params.developmentNeeds.length + params.learningPreferences.length > 0;
  if (!hasContent) return null;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const bulletBlock = (label: string, items: string[]) =>
    items.length > 0 ? `${label}:\n${items.map((i) => `- ${i}`).join("\n")}` : `${label}: none recorded`;

  const prompt = `You are writing a short overview paragraph for a learner report card. Summarize ONLY the information given below — do not invent new claims, skills, or context not present in these bullet points, and do not add caveats or disclaimers. Write exactly 4-5 sentences in plain, professional, third-person prose describing ${params.learnerName}'s overall profile: their key strengths, main development areas, learning preferences, and which courses they're in. No bullet points, no headers, no markdown — just flowing prose.

${bulletBlock("Strengths", params.strengths)}

${bulletBlock("Development needs", params.developmentNeeds)}

${bulletBlock("Learning preferences", params.learningPreferences)}

Courses: ${params.environments.join(", ") || "none recorded"}`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.3,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!response.ok) return null;
    const json = await response.json();
    const text = json.choices?.[0]?.message?.content;
    return typeof text === "string" ? text.trim() : null;
  } catch {
    return null;
  }
}
