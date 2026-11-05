import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { LEVEL_LABEL, type SkillLevel } from "@/lib/skills/frameworks";
import { complete } from "@/lib/skills/overview";
import { courseCode } from "@/lib/course-code";
import { readWorkshopRatings, workshopFramework, workshopLabel, type Workshop } from "@/lib/workshops";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const RANK: Partial<Record<SkillLevel, number>> = { needs_support: 1, developing: 2, strong: 3 };
const shown = (level: SkillLevel | undefined): level is "needs_support" | "developing" | "strong" =>
  Boolean(level && RANK[level]);

export type SkillClassStats = {
  key: string;
  name: string;
  /** Students with a level for this skill from both the Pre and the Post form. */
  compared: number;
  improved: number;
  same: number;
  dropped: number;
  /** Levels after class (Post form; Pre form for students without a Post). */
  latest: { strong: number; developing: number; needs_support: number; not_shown: number };
};

export type ClassSummary = {
  text: string;
  students: number;
  skills: SkillClassStats[];
  updatedAt: string;
};

export function readClassSummary(value: unknown): ClassSummary | null {
  const v = value as ClassSummary | null;
  return v && typeof v.text === "string" && Array.isArray(v.skills) ? v : null;
}

const CLASS_FORMAT = `Output EXACTLY these three lines, nothing else:
Most improved: <the MOST IMPROVED skill given below with its count exactly as given, then what changed in students' answers, max 25 words>
Common gap: <the COMMON GAP skill given below with its count exactly as given, then what students' answers are still missing, max 25 words>
Teacher action: <one concrete thing to do in class next week about that gap, max 20 words>

Rules:
- Use the skills and counts exactly as given in MOST IMPROVED and COMMON GAP. Never invent, change or estimate a number.
- If MOST IMPROVED says none, write "Most improved: Not enough evidence to compare Pre and Post". If COMMON GAP says none, write "Common gap: Not enough evidence".
- Use the students' own Pre → Post and Learning gap notes only to describe WHAT changed or is missing, in concrete words tied to this week's topic.
- Plain, everyday words, like a teacher's quick note. No praise or filler ("demonstrates", "journey", "overall"). No names of students. No markdown.`;

// Picks the skill with the most students (not the highest share), so a skill
// only a handful of answers touched isn't presented as the class trend.
const MIN_STUDENTS = 5;

function pickHighlights(skills: SkillClassStats[]): {
  improved: string;
  gap: string;
  improvedKey: string | null;
  gapKey: string | null;
} {
  const improved = skills
    .filter((s) => s.compared >= MIN_STUDENTS && s.improved > 0)
    .sort((a, b) => b.improved - a.improved || b.improved / b.compared - a.improved / a.compared)[0];
  const notStrong = (s: SkillClassStats) => s.latest.developing + s.latest.needs_support;
  const shownCount = (s: SkillClassStats) => s.latest.strong + notStrong(s);
  const gap = skills
    .filter((s) => shownCount(s) >= MIN_STUDENTS && notStrong(s) > 0)
    .sort((a, b) => notStrong(b) - notStrong(a) || notStrong(b) / shownCount(b) - notStrong(a) / shownCount(a))[0];
  return {
    improvedKey: improved?.key ?? null,
    gapKey: gap?.key ?? null,
    improved: improved
      ? `${improved.name}: ${improved.improved} of ${improved.compared} students moved up a level from Pre to Post`
      : "none",
    gap: gap
      ? `${gap.name}: ${notStrong(gap)} of ${shownCount(gap)} students are not yet strong after class (${gap.latest.needs_support} need support, ${gap.latest.developing} developing)`
      : "none",
  };
}

// The class picture for one week: per-skill counts worked out here, then a
// three-line summary (Most improved / Common gap / Teacher action) written by
// the AI from exactly those counts. Stored on the week.
export async function refreshWeekClassSummary(
  supabase: Supabase,
  workshop: Workshop,
  courseName: string,
): Promise<ClassSummary | null> {
  const framework = workshopFramework(workshop, courseName);
  if (!framework) return null;
  const { data: rows } = await supabase
    .from("workshop_insights")
    .select("overview, skill_ratings, pre_ratings, post_ratings")
    .eq("workshop_id", workshop.id);
  if (!rows || rows.length === 0) return null;

  const skills: SkillClassStats[] = framework.skills.map((skill) => {
    const stats: SkillClassStats = {
      key: skill.key,
      name: skill.name,
      compared: 0,
      improved: 0,
      same: 0,
      dropped: 0,
      latest: { strong: 0, developing: 0, needs_support: 0, not_shown: 0 },
    };
    for (const row of rows) {
      const pre = readWorkshopRatings(row.pre_ratings)?.skills.find((s) => s.key === skill.key)?.level;
      const post = readWorkshopRatings(row.post_ratings)?.skills.find((s) => s.key === skill.key)?.level;
      const latest = post ?? readWorkshopRatings(row.skill_ratings)?.skills.find((s) => s.key === skill.key)?.level;
      if (shown(latest)) stats.latest[latest] += 1;
      else stats.latest.not_shown += 1;
      if (shown(pre) && shown(post)) {
        stats.compared += 1;
        const diff = RANK[post]! - RANK[pre]!;
        if (diff > 0) stats.improved += 1;
        else if (diff < 0) stats.dropped += 1;
        else stats.same += 1;
      }
    }
    return stats;
  });

  const statLines = skills
    .map(
      (s) =>
        `- ${s.name}: compared Pre→Post for ${s.compared} students (improved ${s.improved}, same ${s.same}, dropped ${s.dropped}); after class: ${s.latest.strong} ${LEVEL_LABEL.strong}, ${s.latest.developing} ${LEVEL_LABEL.developing}, ${s.latest.needs_support} ${LEVEL_LABEL.needs_support}, ${s.latest.not_shown} not shown`,
    )
    .join("\n");
  const highlights = pickHighlights(skills);
  // What the ratings said about the two picked skills, so each line describes
  // its own skill (not something from another skill).
  const reasons = (key: string | null, stage: "pre" | "post") =>
    key
      ? rows
          .map((r) => readWorkshopRatings(stage === "pre" ? r.pre_ratings : (r.post_ratings ?? r.skill_ratings)))
          .map((ratings) => ratings?.skills.find((s) => s.key === key))
          .filter((s) => s && shown(s.level))
          .map((s) => `- ${LEVEL_LABEL[s!.level]}: ${s!.summary}`)
          .slice(0, 40)
          .join("\n")
      : "";
  const text = await complete(`You are writing a short class summary for a teacher about ${courseCode(courseName)} ${workshopLabel(workshop)}.

${CLASS_FORMAT}
${workshop.learning_objectives?.trim() ? `\nThis week's learning objectives:\n${workshop.learning_objectives.trim()}\n` : ""}
MOST IMPROVED: ${highlights.improved}
COMMON GAP: ${highlights.gap}

All skills (${rows.length} students; "not shown" usually means that week's forms didn't ask about the skill):
${statLines}

Why students got their level for the MOST IMPROVED skill — before class:
${reasons(highlights.improvedKey, "pre")}
after class:
${reasons(highlights.improvedKey, "post")}

Why students got their level for the COMMON GAP skill after class:
${reasons(highlights.gapKey, "post")}`);
  if (!text) return null;

  const summary: ClassSummary = { text, students: rows.length, skills, updatedAt: new Date().toISOString() };
  await supabase.from("workshops").update({ class_summary: summary as never }).eq("id", workshop.id);
  return summary;
}
