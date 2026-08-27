/**
 * Supported DeepSWE benchmark versions.
 */
export type DeepSweVersion = "v1.1" | "v1";

export type EfficiencyMetric = "cost" | "outputTokens" | "agentSteps";

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
