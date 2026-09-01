/**
 * Supported FrontierCode benchmark versions.
 */
export type FrontierCodeVersion = "v1.1" | "v1";

/**
 * Supported FrontierCode task subsets.
 */
export type FrontierCodeSubset = "main" | "extended";

/**
 * Horizontal metric used by the FrontierCode efficiency chart.
 */
export type FrontierCodeEfficiencyMetric = "cost" | "outputTokens";

/**
 * Detail level used by the FrontierCode performance ranking.
 */
export type FrontierCodeRankingMode = "best" | "all";

/**
 * Metric used to order FrontierCode ranking rows.
 */
export type FrontierCodeRankingMetric = "performance" | "costEfficiency";

/**
 * One raw FrontierCode result for a model, effort, and task subset.
 */
export interface FrontierCodeResult {
  correct: number;
  new_score: number;
  cost: number;
  tokens: number;
  flagged_rate?: number | null;
}

/**
 * Raw data for one FrontierCode benchmark version.
 */
export interface FrontierCodeVersionData {
  models: readonly string[];
  harness: Readonly<Record<string, string>>;
  efforts: Readonly<Record<string, readonly string[]>>;
  subsets: Readonly<Record<FrontierCodeSubset, number>>;
  data: Readonly<
    Record<
      string,
      Readonly<Record<string, Readonly<Record<string, FrontierCodeResult>>>>
    >
  >;
}

/**
 * Complete FrontierCode response containing both supported versions.
 */
export interface FrontierCodeLeaderboard {
  v1: FrontierCodeVersionData;
  v1_1: FrontierCodeVersionData;
}

/**
 * Flattened FrontierCode configuration used by charts and filters.
 */
export interface FrontierCodeLeaderboardRow {
  model: string;
  harness: string;
  reasoning_effort: string;
  config: string;
  score: number;
  correctness: number;
  cost: number;
  tokens: number;
  flagged_rate: number | null;
}
