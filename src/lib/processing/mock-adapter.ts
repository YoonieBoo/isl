import type { ProcessingAdapter, RecordProcessingOutput, SignalCandidate } from "@/lib/processing/types";

// Deterministic, no external calls — exercises the real signal/evidence
// pipeline with inspectable keyword heuristics so the rest of the workflow
// (review, insights, profiles) can be built and tested end-to-end without an
// API key. Explicitly "demo and testing only" per spec §6 — never
// interpretation you'd act on for a real learner.
//
// Two heuristic corrections layered on top of the base keyword match, added
// after the Q3/2026 validation cycle found both as repeatable, real mistakes:
//   1. Negation: "not confident" was matching "confident" and getting tagged
//      a strength. A nearby negator now redirects (or drops) the tag.
//   2. Third-person: exercises that ask a learner to describe a researched
//      customer/persona ("the student feels overwhelmed...") were getting
//      tagged as the learner's own need/concern. A simple third-person check
//      now drops those rather than misattributing them.
// Both are still plain regex heuristics, not real language understanding —
// they catch the specific patterns found during validation, not every case.
const KEYWORD_RULES: {
  pattern: RegExp;
  signalType: SignalCandidate["signalType"];
  label: string;
  /** How to handle a match that's negated. undefined/null = drop the match entirely. */
  negated?: { signalType: SignalCandidate["signalType"]; label: string };
}[] = [
  { pattern: /\b(struggl|difficult|confus|behind|stuck)\w*/i, signalType: "need", label: "Possible difficulty mentioned" },
  { pattern: /\b(concern|worried|anxious|frustrat)\w*/i, signalType: "concern", label: "Possible concern mentioned" },
  {
    pattern: /\b(enjoy|confident|good at|proud|strength)\w*/i,
    signalType: "strength",
    label: "Possible strength mentioned",
    negated: { signalType: "need", label: "Possible low confidence mentioned (negated statement)" },
  },
  { pattern: /\b(prefer|like to|would rather|enjoy working)\w*/i, signalType: "preference", label: "Possible preference mentioned" },
];

const NEGATION_PATTERN = /\b(not|n't|never|no|isn't|aren't|wasn't|weren't|don't|doesn't|didn't|can't|cannot|won't|barely|hardly)\b/i;
const NEGATION_WINDOW_CHARS = 25;

function isNegated(text: string, matchIndex: number): boolean {
  const windowStart = Math.max(0, matchIndex - NEGATION_WINDOW_CHARS);
  return NEGATION_PATTERN.test(text.slice(windowStart, matchIndex));
}

// Catches the clearest cases found in validation ("the student feels...",
// "the user struggles...", "a ... student who is struggling..."). Does not
// catch every third-person phrasing — see comment above.
const THIRD_PERSON_PATTERN = /\b(the student|the user|the customer|this persona|the persona)\b|\b(a|this)\s+[\w\s]{0,20}\b(student|user|customer)\b[\w\s]{0,15}\bwho\b/i;

function describesSomeoneElse(text: string): boolean {
  return THIRD_PERSON_PATTERN.test(text);
}

export const mockAdapter: ProcessingAdapter = {
  sourceType: "mock",
  modelOrTool: "mock-keyword-heuristic-v1",

  async processRecord({ sourceData, evidenceFields }): Promise<RecordProcessingOutput> {
    const signals: SignalCandidate[] = [];

    for (const field of evidenceFields) {
      const text = (sourceData[field] ?? "").trim();
      if (!text) continue;

      const thirdPerson = describesSomeoneElse(text);

      const matched = KEYWORD_RULES.filter((rule) => rule.pattern.test(text));
      if (matched.length === 0) {
        signals.push({
          signalType: "activity_behaviour",
          label: "No specific signal detected",
          evidenceText: text.slice(0, 280),
          sourceField: field,
          interpretationNote:
            "This response didn't match a known strength, need, concern, or preference pattern — logged as general activity only, not yet interpreted.",
        });
        continue;
      }

      for (const rule of matched) {
        const match = rule.pattern.exec(text);
        const negated = match ? isNegated(text, match.index) : false;

        if (thirdPerson) {
          signals.push({
            signalType: "activity_behaviour",
            label: "Describes someone else, not the learner",
            evidenceText: text.slice(0, 280),
            sourceField: field,
            interpretationNote:
              "This response appears to describe a researched customer or persona rather than the learner's own experience — not tagged as a personal signal.",
          });
          continue;
        }

        if (negated) {
          if (!rule.negated) continue; // drop: negated need/concern/preference isn't informative either way
          signals.push({
            signalType: rule.negated.signalType,
            label: rule.negated.label,
            evidenceText: text.slice(0, 280),
            sourceField: field,
            interpretationNote:
              "Automated first-pass reading only — needs human review before being treated as a confirmed signal. (Negation detected in the original wording and adjusted.)",
          });
          continue;
        }

        signals.push({
          signalType: rule.signalType,
          label: rule.label,
          evidenceText: text.slice(0, 280),
          sourceField: field,
          interpretationNote:
            "Automated first-pass reading only — needs human review before being treated as a confirmed signal.",
        });
      }
    }

    if (signals.length === 0) {
      return {
        status: "warning",
        rawOutput: { evidenceFields, note: "no non-empty evidence fields" },
        signals: [],
        warning: "No non-empty evidence fields found for this record.",
      };
    }

    return {
      status: "success",
      rawOutput: { signals },
      signals,
    };
  },
};
