/**
 * Supported DeepSWE benchmark versions.
 */
export type DeepSweVersion = "v1.1" | "v1";

export type EfficiencyMetric = "cost" | "outputTokens" | "agentSteps";

/**
 * Stable semantic order for DeepSWE reasoning-effort labels.
 */
export const DEEP_SWE_REASONING_EFFORT_ORDER = [
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
  "default",
] as const;

/**
 * Known reasoning-effort labels used by DeepSWE configurations.
 */
export type DeepSweReasoningEffort =
  (typeof DEEP_SWE_REASONING_EFFORT_ORDER)[number];

/**
 * Provider-family palettes used to identify DeepSWE models consistently.
 */
export const DEEP_SWE_PROVIDER_COLORS = {
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

/**
 * Finite fractional confidence bounds for a DeepSWE leaderboard result.
 */
export interface DeepSweConfidenceBounds {
  lower: number;
  upper: number;
}

/**
 * Metadata for the latest leaderboard job.
 */
export interface DeepSweLatestJob {
  name: string;
  finished_at: string;
}

/**
 * A model configuration evaluated by DeepSWE.
 */
export interface DeepSweLeaderboardRow {
  model: string;
  harness: string;
  reasoning_effort: string | null;
  config: string;
  source: string;

  pass_rate: number;
  pass_at_1: number;
  pass_at_4: number;

  n_passed: number;
  n_attempted: number;
  n_tasks_attempted: number;
  n_tasks_passed_any: number;

  ci_passed: number;
  ci_attempted: number;
  ci_lo: number;
  ci_hi: number;
  ci_half: number;
  ci_method: string;

  n_runs: number;

  mean_cost_usd: number | null;
  median_cost_usd: number | null;

  mean_output_tokens: number | null;
  median_output_tokens: number | null;

  mean_input_tokens: number | null;
  median_input_tokens: number | null;

  mean_duration_seconds: number | null;
  median_duration_seconds: number | null;

  mean_agent_steps: number | null;
  median_agent_steps: number | null;

  median_peak_context_tokens: number | null;
  median_output_tokens_to_pass: number | null;
}

/**
 * Response returned by the DeepSWE live leaderboard endpoint.
 */
export interface DeepSweLeaderboard {
  scope: string;
  unit: string;
  generated_at: string;
  n_tasks_in_set: number;
  latest_job: DeepSweLatestJob | null;
  rows: DeepSweLeaderboardRow[];
}
