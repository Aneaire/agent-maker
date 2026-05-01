export type ModelCapability = "vision" | "thinking";

export interface ModelEntry {
  value: string;
  label: string;
  description: string;
  group: "Claude" | "Gemini" | "OpenAI";
  tier: string;
  capabilities: ModelCapability[];
  type: "chat";
}

export const CHAT_MODELS: ModelEntry[] = [
  { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", description: "Balanced speed and capability", group: "Claude", tier: "$$", capabilities: ["vision", "thinking"], type: "chat" },
  { value: "claude-opus-4-6", label: "Claude Opus 4.6", description: "Most capable Claude model", group: "Claude", tier: "$$$", capabilities: ["vision", "thinking"], type: "chat" },
  { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", description: "Fastest and most affordable", group: "Claude", tier: "$", capabilities: ["vision"], type: "chat" },
  { value: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro", description: "Most capable Gemini model", group: "Gemini", tier: "$$$", capabilities: ["vision", "thinking"], type: "chat" },
  { value: "gemini-3-flash-preview", label: "Gemini 3 Flash", description: "Lightning-fast with agentic capability", group: "Gemini", tier: "$$", capabilities: ["vision", "thinking"], type: "chat" },
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash", description: "Balanced Gemini model", group: "Gemini", tier: "$$", capabilities: ["vision", "thinking"], type: "chat" },
  { value: "gpt-4o", label: "GPT-4o", description: "OpenAI flagship multimodal model", group: "OpenAI", tier: "$$$", capabilities: ["vision"], type: "chat" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini", description: "Fast and affordable OpenAI model", group: "OpenAI", tier: "$", capabilities: ["vision"], type: "chat" },
  { value: "o4-mini", label: "o4-mini", description: "OpenAI fast reasoning model", group: "OpenAI", tier: "$$", capabilities: ["thinking"], type: "chat" },
];

export function getModelLabel(value: string) {
  return CHAT_MODELS.find((m) => m.value === value)?.label ?? value;
}

/** Maps provider group names to credential type keys. */
export const PROVIDER_TO_CRED: Record<string, string> = {
  Claude: "anthropic",
  Gemini: "google_ai",
  OpenAI: "openai",
};
