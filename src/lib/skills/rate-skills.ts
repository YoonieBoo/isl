import "server-only";
import type { createClient } from "@/lib/supabase/server";
import {
  SKILL_LEVELS,
  type SkillEvidence,
  type SkillFramework,
  type SkillLevel,
  type SkillRating,
  type SkillRatings,
} from "@/lib/skills/frameworks";
import { NON_ANSWER_FIELD, isUsableAnswer } from "@/lib/answer-fields";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const MODEL = "gpt-4o-mini";
const MAX_ANSWER_CHARS = 700;
const MAX_TOTAL_CHARS = 60_000;
const MAX_QUOTES_PER_SKILL = 3;

// DDI1311's evidence sheet stores one answer per row with metadata columns.
const EVIDENCE_SHEET_QUESTION = "question_prompt";
const EVIDENCE_SHEET_ANSWER = "raw_evidence";

type Answer = { id: string; form: string; question: string; text: string; processingResultId: string | null };

export type FormStage = "pre" | "post";

// Narrows which forms a rating reads: one week's forms (weekly insights), and
// within it only the Pre or only the Post form. `objectives` is the week's
// learning objectives, given to the AI as context.
export type RateOptions = { workshopId?: string; stage?: FormStage; objectives?: string | null };

async function gatherAnswers(
  supabase: Supabase,
  learnerId: string,
  environmentId: string,
  { workshopId, stage }: RateOptions,
): Promise<Answer[]> {
  const records: {
    id: string;
    source_data: unknown;
    datasets: { name: string; environment_id: string } | null;
    processing_results: { id: string; created_at: string }[];
  }[] = [];
  for (let from = 0; ; from += 1000) {
    let query = supabase
      .from("dataset_records")
      .select("id, source_data, datasets!inner(name, environment_id, workshop_id), processing_results(id, created_at)")
      .eq("learner_id", learnerId)
      .eq("datasets.environment_id", environmentId);
    if (workshopId) query = query.eq("datasets.workshop_id", workshopId);
    if (stage) query = query.eq("datasets.form_stage", stage);
    const { data } = await query
      // Skips rows marked invalid, including "Already uploaded" duplicates.
      .in("validation_status", ["valid", "valid_with_warnings"])
      .range(from, from + 999);
    records.push(...((data ?? []) as typeof records));
    if (!data || data.length < 1000) break;
  }

  const answers: Answer[] = [];
  for (const record of records) {
    const sd = (record.source_data ?? {}) as Record<string, unknown>;
    const form = record.datasets?.name ?? "Form";
    const latestResult = [...(record.processing_results ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    const processingResultId = latestResult?.id ?? null;

    if (EVIDENCE_SHEET_ANSWER in sd) {
      const text = String(sd[EVIDENCE_SHEET_ANSWER] ?? "");
      if (!isUsableAnswer(text)) continue;
      const source = [sd.module, sd.week ? `Week ${sd.week}` : null, sd.activity_type].filter(Boolean).join(" · ");
      answers.push({
        id: "",
        form: source || form,
        question: String(sd[EVIDENCE_SHEET_QUESTION] ?? ""),
        text,
        processingResultId,
      });
      continue;
    }

    for (const [question, value] of Object.entries(sd)) {
      if (NON_ANSWER_FIELD.test(question)) continue;
      const text = String(value ?? "");
      if (!isUsableAnswer(text)) continue;
      answers.push({ id: "", form, question, text, processingResultId });
    }
  }

  // Stable order (form, then question) so the same data always produces the
  // same prompt — keeps ratings reproducible between runs.
  answers.sort((a, b) => a.form.localeCompare(b.form) || a.question.localeCompare(b.question));
  answers.forEach((a, i) => (a.id = `A${i + 1}`));
  return answers;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[“”"‘’'`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// The model is asked to quote verbatim, but small drift (curly quotes,
// whitespace, a trailing word) is common. Returns the matching answer and the
// learner's ORIGINAL wording, or null if the quote can't be found at all —
// unverifiable quotes are dropped rather than shown as evidence.
function verifyQuote(quote: string, preferred: Answer | undefined, all: Answer[]): { answer: Answer; quote: string } | null {
  const q = normalize(quote);
  if (q.length < 8) return null;
  const candidates = preferred ? [preferred, ...all.filter((a) => a !== preferred)] : all;
  for (const answer of candidates) {
    if (normalize(answer.text).includes(q)) return { answer, quote: quote.trim().replace(/^["“]|["”]$/g, "") };
  }
  // Fall back to locating the quote's opening words and taking the learner's
  // own text from there.
  const quoteWords = q.split(" ");
  if (quoteWords.length < 6) return null;
  const head = quoteWords.slice(0, 6);
  for (const answer of candidates) {
    const words = answer.text
      .split(/\s+/)
      .map((original) => ({ original, norm: normalize(original) }))
      .filter((w) => w.norm);
    for (let i = 0; i + head.length <= words.length; i++) {
      if (head.every((h, j) => words[i + j].norm === h)) {
        const excerpt = words.slice(i, i + quoteWords.length).map((w) => w.original).join(" ");
        return { answer, quote: excerpt };
      }
    }
  }
  return null;
}

const STAGE_RULE: Record<FormStage, string> = {
  pre: "- These answers were all written BEFORE this week's class (the Pre form). Rate them as they are: this is the learner's starting point, to be compared with their answers after class. A naive answer here is normal; rate it honestly, without penalty or extra credit.",
  post: "- These answers were all written AFTER this week's class (the Post form). Rate what the learner shows now, against this week's objectives.",
};
const MIXED_RULE =
  '- Pre-workshop forms ("Pre-Workshop", "Pre-workshop Response") ask for first guesses BEFORE the lesson, so a naive pre-workshop answer is expected and must not by itself pull a level down. Base the level mainly on workshop submissions and reflections; use pre-workshop answers mostly to notice growth.';

function buildPrompt(learnerName: string, framework: SkillFramework, answers: Answer[], options: RateOptions): string {
  const skillBlock = framework.skills
    .map((s) => `- key: ${s.key}\n  name: ${s.name}\n  meaning: ${s.description}\n  look for: ${s.lookFor}`)
    .join("\n");

  let used = 0;
  const answerLines: string[] = [];
  for (const a of answers) {
    const text = a.text.length > MAX_ANSWER_CHARS ? `${a.text.slice(0, MAX_ANSWER_CHARS)}…` : a.text;
    const line = `[${a.id}] (${a.form}) Q: ${a.question}\nA: ${text.replace(/\s+/g, " ")}`;
    if (used + line.length > MAX_TOTAL_CHARS) break;
    answerLines.push(line);
    used += line.length;
  }

  return `You are rating a university learner on a FIXED list of skills for course ${framework.courseCode}, using only their own written answers to course forms. Every learner in the course is rated on exactly these skills with the same standard, so instructors can compare learners fairly.

SKILLS:
${skillBlock}
${options.objectives?.trim() ? `\nTHIS WEEK'S LEARNING OBJECTIVES AND CONTENT:\n${options.objectives.trim()}\n` : ""}
LEVELS (use exactly one per skill):
- strong: several answers show the skill clearly, with specific, well-reasoned, concrete content.
- developing: the skill shows up, but answers are partial, generic, or inconsistent.
- needs_support: relevant answers show misunderstanding, are very thin or vague, or miss the point of the question.
- not_enough_evidence: no answer clearly relates to this skill. Use this rather than guessing.

RULES:
- Judge only what the learner actually wrote. Do not reward length alone; reward specific reasoning.
${options.stage ? STAGE_RULE[options.stage] : MIXED_RULE}
- Use needs_support only when the relevant answers, taken together, show misunderstanding or are consistently very thin. If the picture is mixed, use developing.
- Do not judge personality, intelligence, or English fluency.
- Rate a skill ONLY from answers whose content is actually about that skill (what the student says they did, decided, found or think about it). If no answer is about a skill, use not_enough_evidence.
- How well an answer is written (short, vague, unclear, grammar) is never evidence for a skill on its own. In particular, do not rate communication, presentation or pitching skills from writing style: rate them only from answers where the student is asked to explain, present or pitch something to an audience.
- Every quote must come from an answer that is about that skill. Never reuse a quote about one topic as evidence for an unrelated skill.
- Never use gendered pronouns (he/she/his/her). Refer to the learner by first name or as "they".
- For each skill give a 1-2 sentence "summary" explaining the level, in plain language, referring to what the learner wrote.
- For each skill except not_enough_evidence, give 1-${MAX_QUOTES_PER_SKILL} pieces of "evidence": the answer id and an EXACT quote copied word for word from that answer (8-35 words, enough to show the reasoning — not just a short label or a multiple-choice option). Never paraphrase inside a quote.
- Also write an "overview" for the instructor as two short lines, exactly "Doing well: <max 15 words>\nWork on: <max 15 words>". Plain words, no praise or filler, don't name the learner. It must agree with the levels you gave: only call out as "Work on" skills rated developing or needs_support.

Return ONLY JSON in this shape:
{"overview": "...", "skills": [{"key": "...", "level": "...", "summary": "...", "evidence": [{"answerId": "A1", "quote": "..."}]}]}

LEARNER: ${learnerName}
ANSWERS:
${answerLines.join("\n\n")}`;
}

async function callOpenAi(prompt: string): Promise<unknown | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: MODEL,
          temperature: 0,
          seed: 7,
          response_format: { type: "json_object" },
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (response.status === 429 || response.status >= 500) {
        await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
        continue;
      }
      if (!response.ok) return null;
      const json = await response.json();
      const content = json.choices?.[0]?.message?.content;
      return typeof content === "string" ? JSON.parse(content) : null;
    } catch {
      await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
    }
  }
  return null;
}

// Rates one learner on their course's fixed skill list from their raw form
// answers. Returns null when there's nothing to rate or the AI call fails, so
// callers can keep whatever was stored before rather than wiping it.
export async function rateLearnerSkills(
  supabase: Supabase,
  learnerId: string,
  learnerName: string,
  environmentId: string,
  framework: SkillFramework,
  options: RateOptions = {},
): Promise<SkillRatings | null> {
  const answers = await gatherAnswers(supabase, learnerId, environmentId, options);
  if (answers.length === 0) return null;

  const parsed = (await callOpenAi(buildPrompt(learnerName, framework, answers, options))) as {
    overview?: unknown;
    skills?: unknown;
  } | null;
  if (!parsed || !Array.isArray(parsed.skills)) return null;

  const byId = new Map(answers.map((a) => [a.id, a]));
  const rawByKey = new Map<string, Record<string, unknown>>();
  for (const raw of parsed.skills) {
    if (raw && typeof raw === "object" && typeof (raw as { key?: unknown }).key === "string") {
      rawByKey.set((raw as { key: string }).key, raw as Record<string, unknown>);
    }
  }

  const skills: SkillRating[] = framework.skills.map((skill) => {
    const raw = rawByKey.get(skill.key);
    let level: SkillLevel = SKILL_LEVELS.includes(raw?.level as SkillLevel)
      ? (raw!.level as SkillLevel)
      : "not_enough_evidence";
    let summary = typeof raw?.summary === "string" ? raw.summary.trim() : "";

    const evidence: SkillEvidence[] = [];
    const seen = new Set<string>();
    for (const e of Array.isArray(raw?.evidence) ? raw.evidence : []) {
      const item = e as { answerId?: unknown; quote?: unknown };
      if (typeof item.quote !== "string") continue;
      const verified = verifyQuote(item.quote, byId.get(String(item.answerId ?? "")), answers);
      if (!verified || seen.has(verified.quote)) continue;
      seen.add(verified.quote);
      evidence.push({
        quote: verified.quote,
        form: verified.answer.form,
        question: verified.answer.question,
        processingResultId: verified.answer.processingResultId,
      });
      if (evidence.length >= MAX_QUOTES_PER_SKILL) break;
    }

    // A rating with no checkable evidence behind it isn't shown as a rating.
    if (level !== "not_enough_evidence" && evidence.length === 0) {
      level = "not_enough_evidence";
      summary = "No answer clearly showed this skill yet.";
    }
    if (level === "not_enough_evidence" && !summary) summary = "No answer clearly showed this skill yet.";

    return { key: skill.key, level, summary, evidence };
  });

  return {
    courseCode: framework.courseCode,
    overview: typeof parsed.overview === "string" ? parsed.overview.trim() : "",
    skills,
    answerCount: answers.length,
    ratedAt: new Date().toISOString(),
    model: MODEL,
  };
}
