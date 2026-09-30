export const AI_SOURCE_LABELS: Record<string, string> = {
  mock: "Mock / Test Adapter",
  smartdiscovery: "SmartDiscovery Adapter",
  external_ai: "External AI Adapter",
  manual: "Manual Analysis Adapter",
};

export function aiSourceLabel(aiSource: string): string {
  return AI_SOURCE_LABELS[aiSource] ?? aiSource;
}
