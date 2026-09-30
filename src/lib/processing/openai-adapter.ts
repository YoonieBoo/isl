import "server-only";
import type { ProcessingAdapter, RecordProcessingOutput, SignalCandidate, SignalType } from "@/lib/processing/types";

const SIGNAL_TYPES: SignalType[] = ["strength", "need", "concern", "preference", "activity_behaviour"];

const SYSTEM_PROMPT = `You are the External AI Adapter in SmartDiscovery + ISL, a learner intelligence platform.
Extract evidence-backed learner signals from the learner text fields given to you.

Rules:
- Every signal MUST be grounded in a direct quote or close paraphrase from the given text — never invent evidence.
- evidenceText must come from the field's ANSWER (the text after the colon), never from the field's own question/label text, even when that label is phrased in a way that sounds like it's addressing the learner (e.g. a field literally named "The quarter totals you verified BY HAND ... and which property is the worst?" is the question — if the learner's answer is just "Riverside property is the worst", do not construct evidenceText like "I verified BY HAND" by echoing wording from the label; that is inventing a quote the learner never wrote, from the label rather than their answer, and violates the "never invent evidence" rule above.
- Distinguish the learner's own experience from someone else's. Learner text sometimes describes a researched customer, user, persona, or teammate rather than the learner (e.g. "the customer felt confused", "my persona is nervous about pricing", "she said she wasn't sure"). Do NOT extract that as the learner's own strength/need/concern/preference — it describes a third party, not the learner's self-assessment. Only extract personal signals from sentences that are the learner's own reflection, feeling, or self-assessment (first person: "I", "my", "we" about the learner's own effort). This still applies sentence-by-sentence when a field mixes both — do not extract a sentence describing someone else's feelings just because another sentence in the same field is genuinely self-referential. Example: the field "The customer felt frustrated by our slow onboarding. I personally struggled to explain our value proposition." contains exactly ONE valid signal, from "I personally struggled to explain our value proposition" — the "customer felt frustrated" sentence must be skipped entirely, even though it sits right next to a valid sentence in the same field.
- The same sentence-by-sentence rule applies to business case-study or scenario evidence, and it cuts the OTHER way: a field can be mostly written about a fictional company or business situation (e.g. analysing what a case-study business like "Sabai Hotels" should do, or citing "Riverside's" complaint numbers) without describing the learner's own experience at all — but if that same field ALSO contains a first-person sentence about the learner's own work on the analysis (e.g. "I caught that the vendor email actually says...", "I hand tallied the spreadsheet to confirm...", "I corrected the AI's number"), that sentence IS valid personal evidence — typically activity_behaviour or strength, since catching an error or independently verifying a number is a real personal action — and MUST be extracted even though the rest of the field is business-case narration. Do not return an empty signal list just because a field is dominated by third-party case-study content — check every sentence for an embedded first-person action before concluding there is nothing to extract.
- signalType must be exactly one of: strength, need, concern, preference, activity_behaviour.
- Do NOT produce permanent identity labels (e.g. "this learner is lazy/gifted/anxious"). Prefer framing like "observed signal", "emerging pattern", "current evidence suggests" in the interpretationNote.
- Do NOT diagnose personality, intelligence, or mental health.
- If a field has no interpretable signal, omit it rather than forcing one.
- Return ONLY strict JSON matching this shape, no prose outside the JSON:
{"signals": [{"signalType": "...", "label": "short label", "evidenceText": "quoted/paraphrased evidence", "sourceField": "field name", "interpretationNote": "bounded interpretation, one sentence"}]}`;

export function createOpenAiAdapter(model: string): ProcessingAdapter {
  return {
    sourceType: "external_ai",
    modelOrTool: model,

    async processRecord({ sourceData, evidenceFields, context }): Promise<RecordProcessingOutput> {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return {
          status: "failed",
          rawOutput: null,
          signals: [],
          error: "OPENAI_API_KEY is not configured on the server.",
        };
      }

      const evidenceText = evidenceFields
        .map((field) => `${field}: ${(sourceData[field] ?? "").trim() || "(empty)"}`)
        .join("\n");

      const userPrompt = `Processing context:
Learning objective: ${context.learningObjective || "(none given)"}
Activity context: ${context.activityContext || "(none given)"}
Learner population: ${context.learnerPopulation || "(none given)"}
Activity type: ${context.activityType || "(none given)"}
Interpretation focus: ${context.interpretationFocus || "(none given)"}
Signal categories to look for: ${context.signalCategories || "(any)"}
Taxonomy guidance: ${context.taxonomyGuidance || "(none given)"}
Processing notes: ${context.processingNotes || "(none)"}

Learner evidence fields:
${evidenceText}`;

      let response: Response;
      try {
        response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            response_format: { type: "json_object" },
            temperature: 0.2,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: userPrompt },
            ],
          }),
        });
      } catch (e) {
        return {
          status: "failed",
          rawOutput: null,
          signals: [],
          error: `Network error calling OpenAI: ${e instanceof Error ? e.message : String(e)}`,
        };
      }

      if (!response.ok) {
        const bodyText = await response.text().catch(() => "");
        return {
          status: "failed",
          rawOutput: bodyText,
          signals: [],
          error: `OpenAI API error (${response.status}): ${bodyText.slice(0, 500)}`,
        };
      }

      const payload = await response.json();
      const content: string | undefined = payload?.choices?.[0]?.message?.content;

      if (!content) {
        return {
          status: "failed",
          rawOutput: payload,
          signals: [],
          error: "OpenAI response contained no message content.",
        };
      }

      let parsed: { signals?: unknown[] };
      try {
        parsed = JSON.parse(content);
      } catch {
        return {
          status: "failed",
          rawOutput: payload,
          signals: [],
          error: "Failed to parse OpenAI output as JSON.",
        };
      }

      const signals: SignalCandidate[] = [];
      const rawSignals = Array.isArray(parsed.signals) ? parsed.signals : [];

      for (const raw of rawSignals) {
        if (typeof raw !== "object" || raw === null) continue;
        const r = raw as Record<string, unknown>;
        const signalType = typeof r.signalType === "string" ? r.signalType : "";
        if (!SIGNAL_TYPES.includes(signalType as SignalType)) continue;
        if (typeof r.label !== "string" || typeof r.evidenceText !== "string") continue;

        signals.push({
          signalType: signalType as SignalType,
          label: r.label,
          evidenceText: r.evidenceText,
          sourceField: typeof r.sourceField === "string" ? r.sourceField : evidenceFields[0],
          interpretationNote: typeof r.interpretationNote === "string" ? r.interpretationNote : undefined,
        });
      }

      if (signals.length === 0) {
        return {
          status: "warning",
          rawOutput: payload,
          signals: [],
          warning: "Model returned no valid signals for this record.",
        };
      }

      return { status: "success", rawOutput: payload, signals };
    },
  };
}
