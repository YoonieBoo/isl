import "server-only";
import type { ReportCourse } from "@/lib/pdf/learner-report";
import { LEVEL_LABEL } from "@/lib/skills/frameworks";

// Synthesizes the learner's already-generated, evidence-backed skill ratings
// into a short narrative paragraph for the PDF report's overview section.
// This is a rewording/summarization task, not a new judgment — the prompt is
// scoped to only the ratings given, so it can't introduce new claims.
export async function generateLearnerOverview(params: {
  learnerName: string;
  courses: ReportCourse[];
}): Promise<string | null> {
  const rated = params.courses.filter((c) => c.skills && c.skills.length > 0);
  if (rated.length === 0) return null;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const courseBlock = rated
    .map(
      (c) =>
        `${c.code}:\n${c.skills!.map((s) => `- ${s.name}: ${LEVEL_LABEL[s.level]} — ${s.summary}`).join("\n")}`,
    )
    .join("\n\n");

  const prompt = `You are writing a short overview paragraph for a learner report card. Summarize ONLY the skill ratings given below — do not invent new claims, skills, or context, and do not add caveats or disclaimers. Write exactly 4-5 sentences in plain, professional prose describing ${params.learnerName}'s overall profile: what they do well, what to work on, and how this differs between courses if more than one. Refer to the learner by first name or as "they" — never he/she/his/her. No bullet points, no headers, no markdown — just flowing prose.

${courseBlock}`;

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
