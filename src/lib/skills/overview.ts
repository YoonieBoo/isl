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

export async function complete(prompt: string): Promise<string | null> {
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

const WEEK_FORMAT = `Output EXACTLY these three lines, nothing else:
Pre → Post: <how the learner changed from before class to after class, max 25 words>
Learning gap: <what is still missing after class, max 15 words>
Next action: <one concrete thing the teacher can ask the learner to do before next week, max 15 words>

"Pre → Post" covers ONLY skills marked COMPARABLE below (shown in both forms). Name the skill and its two levels exactly as given, then what changed in the learner's answers (e.g. "Innovation concepts: Needs support → Strong; now sees innovation as improving care, not just new tech"). Mention at most two skills. If no skill is comparable, write "Pre → Post: Not enough evidence to compare". If there is no Post form yet, write "Pre → Post: No Post form yet"; if there is no Pre form, write "Pre → Post: No Pre form to compare with".
A skill marked ONE FORM ONLY was simply not asked in the other form: never call it a drop, a gain or a gap because of that.
"Learning gap" is what the learner still hasn't shown after class against this week's objectives, using the Post form first. Never name as a gap something the learner showed at Developing or Strong in either form.
"Next action" must follow from the learning gap and must not ask for something the learner already showed well.
"Learning gap" and "Next action" must be specific to this learner's answers and this week's objectives. If the answers can't support a conclusion, write "Not enough evidence" for that line instead of guessing.`;

function levelChanges(framework: SkillFramework, pre: SkillRatings | null, post: SkillRatings | null): string {
  return framework.skills
    .map((skill) => {
      const before = pre?.skills.find((s) => s.key === skill.key);
      const after = post?.skills.find((s) => s.key === skill.key);
      const level = (r: typeof before) => (r ? LEVEL_LABEL[r.level] : "no form");
      const shown = (r: typeof before) => Boolean(r && r.level !== "not_enough_evidence");
      const tag = shown(before) && shown(after) ? "COMPARABLE" : shown(before) || shown(after) ? "ONE FORM ONLY" : "NOT SHOWN";
      const reasons = [before && `Pre: ${before.summary}`, after && `Post: ${after.summary}`].filter(Boolean).join(" ");
      return `- [${tag}] ${skill.name}: Pre ${level(before)} → Post ${level(after)}. ${reasons}`;
    })
    .join("\n");
}

// One learner's weekly overview: what changed from the Pre form to the Post
// form, what is still missing, and what the teacher can do next.
export async function writeWeeklyOverview(params: {
  weekName: string;
  objectives: string | null;
  framework: SkillFramework;
  pre: SkillRatings | null;
  post: SkillRatings | null;
}): Promise<string | null> {
  const { weekName, objectives, framework, pre, post } = params;
  return complete(`You are writing a short weekly note for a teacher about one learner in ${weekName}.

${WEEK_FORMAT}

${RULES}
${objectives?.trim() ? `\nThis week's learning objectives:\n${objectives.trim()}\n` : ""}
Skill levels before class (Pre form) and after class (Post form), with the reasons:
${levelChanges(framework, pre, post)}`);
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
