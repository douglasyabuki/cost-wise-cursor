/**
 * Provider-family palettes used to identify models across benchmarks consistently.
 */
const MODEL_PROVIDER_COLORS = {
  anthropic: ["#f97316", "#fb923c", "#ea580c"],
  openai: ["#22c55e", "#4ade80", "#16a34a"],
  google: ["#60a5fa", "#38bdf8", "#2563eb"],
  xai: ["#94a3b8", "#cbd5e1", "#64748b"],
  zhipu: ["#06b6d4", "#22d3ee", "#0891b2"],
  moonshot: ["#f43f5e", "#fb7185", "#e11d48"],
  alibaba: ["#14b8a6", "#2dd4bf", "#0f766e"],
  deepseek: ["#a855f7", "#c084fc", "#7e22ce"],
  meta: ["#3b82f6", "#60a5fa", "#1d4ed8"],
  other: ["#a3a3a3", "#d4d4d4", "#737373"],
} as const;

type ModelProvider = keyof typeof MODEL_PROVIDER_COLORS;

const getModelProvider = (model: string): ModelProvider => {
  const normalizedModel = model.toLowerCase();

  if (normalizedModel.startsWith("claude")) return "anthropic";
  if (normalizedModel.startsWith("gpt")) return "openai";
  if (normalizedModel.startsWith("gemini")) return "google";
  if (normalizedModel.startsWith("grok")) return "xai";
  if (normalizedModel.startsWith("glm")) return "zhipu";
  if (normalizedModel.startsWith("kimi")) return "moonshot";
  if (normalizedModel.startsWith("qwen")) return "alibaba";
  if (normalizedModel.startsWith("deepseek")) return "deepseek";
  if (normalizedModel.startsWith("muse")) return "meta";

  return "other";
};

const getModelPaletteIndex = (model: string, paletteSize: number): number => {
  let hash = 0;

  for (const character of model) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }

  return hash % paletteSize;
};

/**
 * Returns a stable provider-family color for a model.
 * @param model - Model identifier shared across benchmark datasets.
 * @returns Provider-family color with a stable per-model variant.
 */
export const getModelColor = (model: string): string => {
  const palette = MODEL_PROVIDER_COLORS[getModelProvider(model)];
  const paletteIndex = getModelPaletteIndex(model, palette.length);

  return palette[paletteIndex] ?? palette[0];
};
