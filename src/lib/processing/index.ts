import "server-only";
import type { AiSource, ProcessingAdapter } from "@/lib/processing/types";
import { mockAdapter } from "@/lib/processing/mock-adapter";
import { createOpenAiAdapter } from "@/lib/processing/openai-adapter";

const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

// SmartDiscovery and Manual Analysis adapters aren't built yet — this repo
// doesn't have a separate, purpose-built learner-intelligence engine beyond
// the External AI Adapter (spec §6 distinguishes them; see the "AI adapter"
// decision recorded in project memory for why). Selecting either currently
// falls back to Mock so runs still complete rather than fail confusingly —
// the run keeps its requested ai_source label, so provenance stays honest.
export function getProcessingAdapter(aiSource: AiSource, modelOrTool: string | null): ProcessingAdapter {
  switch (aiSource) {
    case "external_ai":
      return createOpenAiAdapter(modelOrTool || DEFAULT_OPENAI_MODEL);
    case "mock":
    case "smartdiscovery":
    case "manual":
    default:
      return mockAdapter;
  }
}
