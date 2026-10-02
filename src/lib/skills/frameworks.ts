import { courseCode } from "@/lib/course-code";

// Fixed, instructor-defined skill lists per course. Every learner in a course
// is rated on the SAME skills, so learners can be compared side by side and
// across the class — unlike free-form strengths/needs, which differ for every
// learner because the AI words them from scratch each time.
//
// DDI2332/DDI2331: the first three skills are the instructor's own (Pi Teet);
// the rest were picked from the questions those courses' forms ask repeatedly.
// DDI1311: derived from the course's official learning objectives, which are
// recorded in its evidence sheet.
//
// To change a course's skills, edit this file and re-run Analyze (or the
// backfill) — ratings are stored per learner and rebuilt from raw answers.

export type Skill = {
  key: string;
  name: string;
  /** What the skill means, in one sentence — shown to the AI and in tooltips. */
  description: string;
  /** What to look for in the learner's answers. */
  lookFor: string;
};

export type SkillFramework = { courseCode: string; skills: Skill[] };

export const SKILL_LEVELS = ["strong", "developing", "needs_support", "not_enough_evidence"] as const;
export type SkillLevel = (typeof SKILL_LEVELS)[number];

export const LEVEL_LABEL: Record<SkillLevel, string> = {
  strong: "Strong",
  developing: "Developing",
  needs_support: "Needs support",
  not_enough_evidence: "Not enough evidence",
};

const FRAMEWORKS: SkillFramework[] = [
  {
    courseCode: "DDI2332",
    skills: [
      {
        key: "ai_fit_judgment",
        name: "AI-fit judgment",
        description: "Judges where AI genuinely fits a business task — and where it doesn't, or a non-AI solution is better.",
        lookFor:
          "Answers about where AI should help in a workflow, what makes an AI tool a good fit for a specific company, why the biggest market isn't always the best fit, and when a non-AI solution fits better.",
      },
      {
        key: "adoption_decision",
        name: "Adoption decision",
        description: "Makes and justifies a clear adopt / don't-adopt / pilot recommendation for a specific business.",
        lookFor:
          "Adoption recommendations and the strongest reason given, whether it is worth the cost for a business of that size, how it would be tested cheaply, and what would make it more likely to be adopted.",
      },
      {
        key: "stakeholder_customer_insight",
        name: "Stakeholder & customer insight",
        description: "Understands the customers, users and stakeholders affected — their real needs and concerns.",
        lookFor:
          "Who the target customer is, what customer need or problem a business addresses, who inside a business would use the solution, and what stakeholder questions revealed.",
      },
      {
        key: "workflow_analysis",
        name: "Workflow analysis",
        description: "Maps how work is done today and how an intervention would change it, step by step.",
        lookFor:
          "Before-AI and after-AI workflow descriptions, how an intervention fits into real operations, and understanding of the current workflow before adding AI.",
      },
      {
        key: "business_value",
        name: "Business value thinking",
        description: "Distinguishes impressive AI from real business value, and states concrete, measurable value.",
        lookFor:
          "The difference between an impressive demo and real value, what concrete value is created (decision changed, time or money saved), and success metrics with a baseline and target.",
      },
      {
        key: "critical_ai_use",
        name: "Checking AI output",
        description: "Checks and corrects AI output rather than trusting it, and knows what still needs human judgment.",
        lookFor:
          "What still required human judgment, verifying numbers by hand, correcting an AI-generated report or pitch, and where AI helped versus misled.",
      },
    ],
  },
  {
    courseCode: "DDI2331",
    skills: [
      {
        key: "understanding_qualitative_data",
        name: "Understanding of qualitative data",
        description: "Understands what qualitative data (open responses, interviews) can and can't tell you, and how coding it works.",
        lookFor:
          "What they learned about working with qualitative data, how coding responses helped them understand the data, theme labels used, and how they kept coding consistent.",
      },
      {
        key: "confidence_qualitative_data",
        name: "Confidence in using qualitative data",
        description: "How confident the learner is in using qualitative data to support a recommendation — and why.",
        lookFor:
          "Self-rated confidence answers (e.g. 'How confident are you...' on a number scale) together with the reason given, and any change in confidence between earlier and later forms. Base this skill mainly on what the learner reports about their own confidence.",
      },
      {
        key: "data_interpretation",
        name: "Data interpretation",
        description: "Finds meaningful patterns in data, backs them with evidence, and avoids over-reading them.",
        lookFor:
          "The patterns or findings they identified, the evidence they cite for them, what a pattern means for the decision, and awareness of the risk of interpreting data too quickly.",
      },
      {
        key: "data_collection",
        name: "Data collection",
        description: "Plans how to collect real evidence from the right people with suitable methods.",
        lookFor:
          "Who should be asked to get real evidence, which collection methods fit the question, risks when collecting responses from real people, and what they'd do differently next time.",
      },
      {
        key: "findings_to_recommendation",
        name: "Turning findings into recommendations",
        description: "Turns analysis into a specific, targeted recommendation with a way to check it worked.",
        lookFor:
          "Recommendations or interventions proposed, the target group and why it fits, how an activation activity would work, and what data or result would show success.",
      },
      {
        key: "responsible_data_use",
        name: "Responsible & ethical data use",
        description: "Recognises limitations, ethical concerns and responsible use of data and AI about people.",
        lookFor:
          "Stated limitations of their data or analysis, ethical concerns with behavioural data, how DDI should use data responsibly, and how they used and checked AI.",
      },
    ],
  },
  {
    courseCode: "DDI1311",
    skills: [
      {
        key: "user_empathy_problem_discovery",
        name: "User empathy & problem discovery",
        description: "Understands users, maps their experience, and finds real pain points and opportunities.",
        lookFor:
          "User journeys, pain points, workarounds, user insights, problem reframing, and how well they understand the user's experience.",
      },
      {
        key: "assumption_testing",
        name: "Assumption testing",
        description: "Tests assumptions quickly with evidence and improves ideas through Build–Measure–Learn cycles.",
        lookFor:
          "Initial assumptions, what they tested, the evidence gathered, what changed as a result, and next tests.",
      },
      {
        key: "mvp_demand_validation",
        name: "MVP & demand validation",
        description: "Uses MVPs to test demand and tells apart interest, intent and actual purchase behaviour.",
        lookFor:
          "MVP design, interest vs intent vs purchase counts, demand assumptions and revisions, and what the response showed.",
      },
      {
        key: "prototyping",
        name: "Prototyping",
        description: "Turns early ideas into simple prototypes that can be shared and improved.",
        lookFor: "Solution direction, low-fidelity prototypes, and how feedback changed the prototype.",
      },
      {
        key: "viability_feasibility",
        name: "Viability & feasibility",
        description: "Evaluates business viability and technical feasibility together.",
        lookFor: "Viability and feasibility conclusions, risks identified, and how the two were weighed.",
      },
      {
        key: "teamwork_reflection",
        name: "Teamwork & reflection",
        description: "Contributes to the team and reflects honestly on their own learning and difficulties.",
        lookFor:
          "Their personal contribution to the team, what they learned, remaining difficulties, and how their confidence changed.",
      },
    ],
  },
];

export function getSkillFramework(environmentName: string | null | undefined): SkillFramework | null {
  if (!environmentName) return null;
  const code = courseCode(environmentName);
  return FRAMEWORKS.find((f) => f.courseCode === code) ?? null;
}

// --- Stored rating shape (kept in learner_insights.approved_output.skill_ratings) ---

export type SkillEvidence = {
  quote: string;
  form: string;
  question: string;
  processingResultId: string | null;
};

export type SkillRating = {
  key: string;
  level: SkillLevel;
  summary: string;
  evidence: SkillEvidence[];
};

export type SkillRatings = {
  courseCode: string;
  overview: string;
  skills: SkillRating[];
  answerCount: number;
  ratedAt: string;
  model: string;
};

export function readSkillRatings(approvedOutput: unknown): SkillRatings | null {
  const r = (approvedOutput as { skill_ratings?: SkillRatings } | null)?.skill_ratings;
  return r && Array.isArray(r.skills) ? r : null;
}
