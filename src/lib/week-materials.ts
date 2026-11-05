import "server-only";

// Runs once per week per upload, so the stronger model is worth it here: the
// small one followed the question-by-question mapping unreliably.
const MODEL = "gpt-4o";

export type LearningContext = {
  materials: { name: string; path: string }[];
  keyConcepts: string[];
  /** What a good student answer shows, one line per objective or concept. */
  goodAnswers: string[];
  suggestedObjectives: string[];
  suggestedSkills: { name: string; description: string }[];
  /** Objectives that no Pre or Post form question asks about. */
  notAskedInForms?: string[];
  readAt: string;
  /** Set once the teacher has put the suggestions into the week. */
  appliedAt?: string;
};

export function readLearningContext(value: unknown): LearningContext | null {
  const v = value as LearningContext | null;
  return v && Array.isArray(v.keyConcepts) && Array.isArray(v.suggestedSkills) ? v : null;
}

// The week's objectives plus what the AI read from its slides, as one block
// of context for rating students' answers.
export function weekContextText(objectives: string | null, context: unknown): string | null {
  const c = readLearningContext(context);
  const parts = [
    objectives?.trim(),
    c?.keyConcepts.length ? `Key concepts taught this week:\n${c.keyConcepts.map((k) => `- ${k}`).join("\n")}` : null,
    c?.goodAnswers.length ? `What a good answer shows:\n${c.goodAnswers.map((k) => `- ${k}`).join("\n")}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join("\n\n") : null;
}

const strings = (v: unknown, max: number) =>
  (Array.isArray(v) ? v : [])
    .filter((x): x is string => typeof x === "string" && x.trim() !== "")
    .map((x) => x.trim())
    .slice(0, max);

async function callJson(content: unknown[]): Promise<Record<string, unknown> | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: MODEL,
          temperature: 0,
          seed: 7,
          response_format: { type: "json_object" },
          messages: [{ role: "user", content }],
        }),
      });
      if (response.status === 429 || response.status >= 500) {
        await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
        continue;
      }
      if (!response.ok) return null;
      const json = await response.json();
      return JSON.parse(json.choices?.[0]?.message?.content ?? "null") as Record<string, unknown> | null;
    } catch {
      await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
    }
  }
  return null;
}

const numbered = (items: string[]) => items.map((x, i) => `${i + 1}. ${x}`).join("\n");

// Reads a week's slides / workshop instructions (PDFs, including slides that
// are only images) and suggests what the week teaches and how to rate it.
// Two steps, so each stays reliable: (1) read the materials for objectives,
// key concepts and what a good answer shows; (2) without the files, match the
// week's Pre/Post form questions to those and build skills students' answers
// can actually show. Objectives no question asks about are worked out in code.
export async function extractLearningContext(params: {
  weekName: string;
  files: { name: string; base64: string }[];
  /** The week's Pre/Post form questions, e.g. "Pre: What does innovation mean to you?". */
  formQuestions: string[];
}): Promise<Omit<LearningContext, "materials" | "readAt"> | null> {
  const read = await callJson([
    ...params.files.map((f) => ({
      type: "file",
      file: { filename: f.name, file_data: `data:application/pdf;base64,${f.base64}` },
    })),
    {
      type: "text",
      text: `These are the teaching materials (slides and/or workshop instructions) for ${params.weekName}, a university class. Read every page, including text inside images. Return ONLY JSON:
{"objectives": ["..."], "keyConcepts": ["..."], "goodAnswers": ["..."]}

- objectives: 2-4 learning objectives for the week. Copy them word for word if the materials state them; otherwise write them as "Students can ...".
- keyConcepts: 4-8 key ideas actually taught, each one short line in the materials' own terms (e.g. "Innovation is more than something new: product, service, process or experience").
- goodAnswers: 3-6 lines, each saying what a good student answer shows for one objective or concept (e.g. "Names who is affected by the problem and why it matters").
- Use only what is in the materials. Plain words, no filler.`,
    },
  ]);
  if (!read) return null;
  const objectives = strings(read.objectives, 4);
  const keyConcepts = strings(read.keyConcepts, 8);
  const goodAnswers = strings(read.goodAnswers, 6);
  const questions = params.formQuestions;

  const plan = await callJson([
    {
      type: "text",
      text: `A teacher rates each student's learning in ${params.weekName} from their written answers to short forms: Pre (before class) and Post (after class). Suggest the skills to rate. Return ONLY JSON:
{"coverage": [{"question": 1, "objectives": [1], "concepts": [1, 2]}], "skills": [{"name": "...", "description": "...", "questions": [1, 4]}]}

OBJECTIVES:
${numbered(objectives)}

KEY CONCEPTS:
${numbered(keyConcepts)}

WHAT A GOOD ANSWER SHOWS:
${goodAnswers.map((g) => `- ${g}`).join("\n")}

FORM QUESTIONS:
${questions.length ? numbered(questions) : "(none uploaded yet)"}

Steps:
1. coverage: for EVERY form question (by number), the objectives and key concepts (by number) it asks about DIRECTLY. A general question such as "What was the most important thing you learned?" covers no specific objective or concept: give it [] for both.
2. skills: 3-6 skills, each something a student's answer to at least one form question can show:
   - one skill for each objective covered by at least one question;
   - one skill for each key concept, or closely related group of concepts, that a question asks about directly (e.g. "What does innovation mean to you?" → understanding of innovation);
   - a reflection skill if a question asks what students learned or how their thinking changed.
   If there are no form questions, make one skill per objective.
   "questions" lists the form questions (by number) whose answers can show the skill.
   "name" is 2-5 words. "description" says in one or two plain sentences what a strong answer shows, in the materials' terms, so another teacher would rate it the same way.`,
    },
  ]);

  const suggestedSkills = (Array.isArray(plan?.skills) ? plan.skills : [])
    .map((s) => s as { name?: unknown; description?: unknown; questions?: unknown })
    .filter((s) => typeof s.name === "string" && s.name.trim() !== "")
    // With form questions, keep only skills some question can actually show.
    .filter((s) => questions.length === 0 || (Array.isArray(s.questions) && s.questions.some((n) => typeof n === "number")))
    .map((s) => ({ name: String(s.name).trim(), description: typeof s.description === "string" ? s.description.trim() : "" }))
    .slice(0, 6);

  // Objectives no question asks about directly can't be seen in answers.
  let notAskedInForms: string[] = [];
  if (questions.length > 0 && Array.isArray(plan?.coverage)) {
    const covered = new Set<number>();
    for (const row of plan.coverage) {
      for (const n of (row as { objectives?: unknown }).objectives instanceof Array ? (row as { objectives: unknown[] }).objectives : []) {
        if (typeof n === "number") covered.add(n);
      }
    }
    notAskedInForms = objectives.filter((_, i) => !covered.has(i + 1));
  }

  return { suggestedObjectives: objectives, keyConcepts, goodAnswers, suggestedSkills, notAskedInForms };
}
