import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { LEVEL_LABEL, getSkillFramework, readSkillRatings, type SkillFramework, type SkillRatings } from "@/lib/skills/frameworks";
import { courseCode } from "@/lib/course-code";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// The "Overview" at the top of a learner's profile and PDF: an AI-written
// summary combining the course's skill ratings with the other things the AI
// noticed in the learner's answers (preferences, concerns). Written once when
// the learner is analyzed and stored, rather than regenerated on every view.

// Instructors scan these, so the overview is three short labelled lines, not
// a paragraph. The page and PDF render each "Label: text" line separately.
const FORMAT = `Output EXACTLY these lines, nothing else:
Doing well: <what the learner does well, max 15 words>
Work on: <the 1-2 most important next steps, max 15 words>
Worth noting: <one concrete interest, concern or preference the learner stated, max 12 words>

"Doing well" names the learner's actual topic or example (e.g. "Clear on why long OPD waits hurt elderly patients"), not a generic phrase.
"Worth noting" must add something NOT already in the other two lines (e.g. a stated preference, worry or goal). Leave the line out completely if it would repeat them or nothing concrete supports it.`;

const RULES = `Rules:
- Write like a busy teacher's quick note: plain, everyday words, short phrases. Fragments are fine.
- No filler or praise words: never "demonstrates", "commendable", "showcasing", "journey", "moving forward", "overall", "valuable asset", "room for growth", "solid understanding".
- Don't name the learner or start with their name; the page already shows it. Never use he/she/his/her.
- Be specific to what the learner actually wrote (their topic, their example). No generic statements that could fit anyone.
- Use ONLY the information given. Do not invent skills, events, or context.
- Some observations may describe OTHER people the learner wrote about (survey respondents, customers, classmates, families). Leave those out.
- If almost nothing is known yet, say so plainly, e.g. "Work on: Too early to tell; only first-week answers so far."
- No markdown, no bullet symbols.`;

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
      if (typeof text !== "string" || !text.trim()) return null;
      return text
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .join("\n");
    } catch {
      await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
    }
  }
  return null;
}

function skillLines(courseName: string, ratings: SkillRatings, stored?: SkillFramework | null): string {
  const framework = stored ?? getSkillFramework(courseName);
  return ratings.skills
    .map((s) => {
      const name = framework?.skills.find((k) => k.key === s.key)?.name ?? s.key;
      return `- ${name}: ${LEVEL_LABEL[s.level]} — ${s.summary}`;
    })
    .join("\n");
}

const STOP = new Set("a an the and or of in on to for with about as at by is are be their its it this that from into more".split(" "));
const words = (t: string) => new Set(t.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)));

// The model often fills "Worth noting" with a rewording of "Doing well" or
// with "nothing shared yet". Drop the line in both cases so the overview
// never says the same thing twice or pads itself out.
function tidyOverview(text: string | null): string | null {
  if (!text) return text;
  const lines = text.split("\n");
  const doingWell = lines.find((l) => /^doing well\s*:/i.test(l)) ?? "";
  return lines
    .filter((line) => {
      const m = line.match(/^worth noting\s*:\s*(.*)$/i);
      if (!m) return true;
      const note = m[1];
      if (/^(no|none|nothing|not\b|n\/a)/i.test(note)) return false;
      const nw = words(note), dw = words(doingWell);
      const shared = [...nw].filter((w) => dw.has(w)).length;
      return nw.size > 0 && shared / nw.size < 0.4;
    })
    .join("\n");
}

export async function writeCourseOverview(params: {
  learnerName: string;
  courseName: string;
  framework?: SkillFramework | null;
  ratings: SkillRatings;
  preferences: string[];
  concerns: string[];
}): Promise<string | null> {
  const list = (items: string[]) => (items.length ? items.map((i) => `- ${i}`).join("\n") : "- none recorded");
  return tidyOverview(await complete(`Write a quick overview of a learner in course ${courseCode(params.courseName)} for their instructor.

${FORMAT}

${RULES}

SKILL RATINGS (fixed course skills, rated from the learner's own answers):
${skillLines(params.courseName, params.ratings, params.framework)}

OTHER OBSERVATIONS — learning preferences ("label: quote"):
${list(params.preferences)}

OTHER OBSERVATIONS — concerns ("label: quote"):
${list(params.concerns)}`));
}

async function writeCombinedOverview(courses: { code: string; overview: string }[]): Promise<string | null> {
  return tidyOverview(await complete(`Write a quick overview of a learner across all their courses, for an instructor. In "Doing well" and "Work on", mention the course code when a point applies to one course only. Base it only on these per-course overviews:

${courses.map((c) => `${c.code}:\n${c.overview}`).join("\n\n")}

${FORMAT}

${RULES}`));
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
    courses.length === 1 ? courses[0].overview : await writeCombinedOverview(courses);
  if (!summary) return;

  await supabase.from("learner_profiles").upsert({ learner_id: learnerId, summary }, { onConflict: "learner_id" });
}
