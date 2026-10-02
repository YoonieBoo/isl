import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { LEVEL_LABEL, getSkillFramework, readSkillRatings, type SkillRatings } from "@/lib/skills/frameworks";
import { courseCode } from "@/lib/course-code";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// The "Overview" at the top of a learner's profile and PDF: an AI-written
// summary combining the course's skill ratings with the other things the AI
// noticed in the learner's answers (preferences, concerns). Written once when
// the learner is analyzed and stored, rather than regenerated on every view.

const RULES = `Rules:
- Write for the learner's instructor, in plain, warm, professional language.
- Use ONLY the information given. Do not invent skills, events, or context.
- Some observations may actually describe OTHER people the learner wrote about (survey respondents, customers, classmates, families) rather than the learner. Leave those out.
- Never use gendered pronouns (he/she/his/her). Use the learner's first name or "they".
- No bullet points, headers or markdown. One paragraph.`;

async function complete(prompt: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: "gpt-4o-mini", temperature: 0.2, messages: [{ role: "user", content: prompt }] }),
      });
      if (response.status === 429 || response.status >= 500) {
        await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
        continue;
      }
      if (!response.ok) return null;
      const json = await response.json();
      const text = json.choices?.[0]?.message?.content;
      return typeof text === "string" && text.trim() ? text.trim() : null;
    } catch {
      await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
    }
  }
  return null;
}

function skillLines(courseName: string, ratings: SkillRatings): string {
  const framework = getSkillFramework(courseName);
  return ratings.skills
    .map((s) => {
      const name = framework?.skills.find((k) => k.key === s.key)?.name ?? s.key;
      return `- ${name}: ${LEVEL_LABEL[s.level]} — ${s.summary}`;
    })
    .join("\n");
}

export async function writeCourseOverview(params: {
  learnerName: string;
  courseName: string;
  ratings: SkillRatings;
  preferences: string[];
  concerns: string[];
}): Promise<string | null> {
  const list = (items: string[]) => (items.length ? items.map((i) => `- ${i}`).join("\n") : "- none recorded");
  return complete(`Write an overview of ${params.learnerName} in course ${courseCode(params.courseName)}: 4-5 sentences covering (1) the overall picture, (2) their clearest strengths, (3) what to work on next, and (4) anything notable about how they like to learn or what concerns them, if the observations below support it.

${RULES}

SKILL RATINGS (fixed course skills, rated from the learner's own answers):
${skillLines(params.courseName, params.ratings)}

OTHER OBSERVATIONS — learning preferences ("label: quote"):
${list(params.preferences)}

OTHER OBSERVATIONS — concerns ("label: quote"):
${list(params.concerns)}`);
}

async function writeCombinedOverview(learnerName: string, courses: { code: string; overview: string }[]): Promise<string | null> {
  return complete(`Write an overview of ${learnerName} across all their courses: 4-5 sentences covering the overall picture, strengths that show up, what to work on, and how they differ between courses. Base it only on these per-course overviews:

${courses.map((c) => `${c.code}: ${c.overview}`).join("\n\n")}

${RULES}`);
}

export function readCourseOverview(approvedOutput: unknown): string | null {
  const overview = (approvedOutput as { overview?: unknown } | null)?.overview;
  if (typeof overview === "string" && overview) return overview;
  return readSkillRatings(approvedOutput)?.overview || null;
}

// Rebuilds the learner's all-courses overview from each course's latest
// stored overview, and saves it on learner_profiles.summary.
export async function refreshLearnerSummary(supabase: Supabase, learnerId: string): Promise<void> {
  const [{ data: learner }, { data: insights }] = await Promise.all([
    supabase.from("learners").select("display_name").eq("id", learnerId).single(),
    supabase
      .from("learner_insights")
      .select("environment_id, approved_output, updated_at, learning_environments(name)")
      .eq("learner_id", learnerId)
      .eq("status", "approved")
      .order("updated_at", { ascending: false }),
  ]);
  if (!learner) return;

  const byEnvironment = new Map<string, { code: string; overview: string }>();
  for (const insight of insights ?? []) {
    if (byEnvironment.has(insight.environment_id)) continue;
    const overview = readCourseOverview(insight.approved_output);
    const name = insight.learning_environments?.name;
    if (overview && name) byEnvironment.set(insight.environment_id, { code: courseCode(name), overview });
  }
  const courses = [...byEnvironment.values()].sort((a, b) => a.code.localeCompare(b.code));
  if (courses.length === 0) return;

  const summary =
    courses.length === 1 ? courses[0].overview : await writeCombinedOverview(learner.display_name, courses);
  if (!summary) return;

  await supabase.from("learner_profiles").upsert({ learner_id: learnerId, summary }, { onConflict: "learner_id" });
}
