import type { Database } from "@/lib/supabase/database.types";

export type SignalType = Database["public"]["Enums"]["signal_type"];
export type AiSource = Database["public"]["Enums"]["ai_source"];

export type SignalCandidate = {
  signalType: SignalType;
  label: string;
  evidenceText: string;
  sourceField: string;
  interpretationNote?: string;
};

export type ProcessingContextInput = {
  learningObjective: string;
  activityContext: string;
  learnerPopulation: string;
  activityType: string;
  interpretationFocus: string;
  signalCategories: string;
  taxonomyGuidance: string;
  processingNotes: string;
};

export type RecordProcessingInput = {
  sourceData: Record<string, string>;
  evidenceFields: string[];
  context: ProcessingContextInput;
};

export type RecordProcessingOutput = {
  status: "success" | "warning" | "failed" | "skipped";
  rawOutput: unknown;
  signals: SignalCandidate[];
  warning?: string;
  error?: string;
};

export interface ProcessingAdapter {
  sourceType: AiSource;
  modelOrTool: string;
  processRecord(input: RecordProcessingInput): Promise<RecordProcessingOutput>;
}
