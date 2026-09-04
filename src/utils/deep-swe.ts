import type {
  DeepSweConfidenceBounds,
  DeepSweLeaderboard,
  DeepSweLeaderboardRow,
  DeepSweReasoningEffort,
  EfficiencyMetric,
} from "@/types-and-constants/deep-swe";
import {
  DEEP_SWE_PROVIDER_COLORS,
  DEEP_SWE_REASONING_EFFORT_ORDER,
} from "@/types-and-constants/deep-swe";
import { formatCostAxisTick } from "@/utils/chart";

/**
 * Checks whether a value is a non-null object.
 *
 * @param value - Value to inspect.
 * @returns Whether the value is an object record.
 */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/**
 * Checks the minimum expected structure of a leaderboard row.
 *
 * @param value - Value to inspect.
 * @returns Whether the value resembles a leaderboard row.
 */
const isLeaderboardRow = (value: unknown): value is DeepSweLeaderboardRow =>
  isRecord(value) &&
  typeof value.model === "string" &&
  typeof value.harness === "string" &&
  (typeof value.reasoning_effort === "string" ||
    value.reasoning_effort === null) &&
  typeof value.config === "string" &&
  typeof value.source === "string" &&
  typeof value.pass_at_1 === "number" &&
  typeof value.n_attempted === "number";

/**
 * Parses and validates a DeepSWE leaderboard payload.
 *
 * @param value - Decoded JSON payload returned by DeepSWE.
 * @returns Parsed leaderboard data.
 * @throws {Error} When the payload structure is invalid.
 */
export const parseDeepSweLeaderboard = (value: unknown): DeepSweLeaderboard => {
  if (
    !isRecord(value) ||
    typeof value.scope !== "string" ||
    typeof value.unit !== "string" ||
    typeof value.generated_at !== "string" ||
    typeof value.n_tasks_in_set !== "number" ||
    !Array.isArray(value.rows) ||
    !value.rows.every(isLeaderboardRow)
  ) {
    throw new Error("DeepSWE returned an invalid leaderboard response");
  }

  return value as unknown as DeepSweLeaderboard;
};

const compactNumberFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const modelNameCollator = new Intl.Collator("en-US", {
  numeric: true,
  sensitivity: "base",
});

type DeepSweModelProvider = keyof typeof DEEP_SWE_PROVIDER_COLORS;

/**
 * Returns the display label for a row's reasoning effort.
 *
 * @param row - Leaderboard configuration.
 * @returns Reasoning-effort label.
 */
export const getReasoningEffort = (row: DeepSweLeaderboardRow): string =>
  row.reasoning_effort ?? "default";

/**
 * Returns the display order for a reasoning-effort label.
 *
 * @param effort - Reasoning-effort label.
 * @returns Stable numeric order.
 */
export const getReasoningEffortOrder = (effort: string): number => {
  const index = DEEP_SWE_REASONING_EFFORT_ORDER.indexOf(
    effort.toLowerCase() as DeepSweReasoningEffort,
  );

  return index === -1 ? DEEP_SWE_REASONING_EFFORT_ORDER.length : index;
};

/**
 * Compares DeepSWE model names using natural, case-insensitive ordering.
 *
 * @param first - First model name.
 * @param second - Second model name.
 * @returns Array-sort comparison value.
 */
export const compareModelNames = (first: string, second: string): number =>
  modelNameCollator.compare(first, second);

const getModelProvider = (model: string): DeepSweModelProvider => {
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
 *
 * @param model - DeepSWE model identifier.
 * @returns Provider-family color with a stable per-model variant.
 */
export const getModelColor = (model: string): string => {
  const palette = DEEP_SWE_PROVIDER_COLORS[getModelProvider(model)];
  const paletteIndex = getModelPaletteIndex(model, palette.length);

  return palette[paletteIndex] ?? palette[0];
};

/**
 * Formats a nullable number in compact notation.
 *
 * @param value - Value to format.
 * @returns Compact value or an em dash when unavailable.
 */
export const formatCompactNumber = (value: number | null): string =>
  value === null || !Number.isFinite(value)
    ? "—"
    : compactNumberFormatter.format(value);

/**
 * Formats an average benchmark-task cost.
 *
 * @param value - Cost in US dollars.
 * @returns Dollar value or an em dash when unavailable.
 */
export const formatCost = (value: number | null): string =>
  value === null || !Number.isFinite(value) ? "—" : `$${value.toFixed(2)}`;

/**
 * Formats a Pass@1 value as a percentage.
 *
 * @param value - Fractional Pass@1 value.
 * @returns Percentage with one decimal place.
 */
export const formatScore = (value: number): string =>
  `${(value * 100).toFixed(1)}%`;

/**
 * Calculates Pass@1 percentage points per DeepSWE benchmark dollar.
 *
 * @param row - Leaderboard configuration.
 * @returns Cost-efficiency score or null when cost is unavailable.
 */
export const getCostEfficiency = (
  row: DeepSweLeaderboardRow,
): number | null => {
  const cost = row.mean_cost_usd;

  if (cost === null || !Number.isFinite(cost) || cost <= 0) {
    return null;
  }

  return (row.pass_at_1 * 100) / cost;
};

/**
 * Formats a DeepSWE cost-efficiency score.
 *
 * @param value - Pass@1 percentage points per benchmark dollar.
 * @returns Formatted score or an em dash when unavailable.
 */
export const formatCostEfficiency = (value: number | null): string =>
  value === null || !Number.isFinite(value) ? "—" : `${value.toFixed(1)} pts/$`;

/**
 * Returns finite confidence bounds for a leaderboard row.
 *
 * @param row - Leaderboard configuration.
 * @returns Fractional lower and upper confidence bounds.
 */
export const getConfidenceBounds = (
  row: DeepSweLeaderboardRow,
): DeepSweConfidenceBounds => {
  const lower =
    typeof row.ci_lo === "number" && Number.isFinite(row.ci_lo)
      ? row.ci_lo
      : row.pass_at_1;

  const upper =
    typeof row.ci_hi === "number" && Number.isFinite(row.ci_hi)
      ? row.ci_hi
      : row.pass_at_1;

  return {
    lower: Math.min(lower, upper),
    upper: Math.max(lower, upper),
  };
};

/**
 * Returns a row's confidence-interval half-width.
 *
 * @param row - Leaderboard configuration.
 * @returns Fractional confidence-interval half-width.
 */
const getConfidenceHalfWidth = (row: DeepSweLeaderboardRow): number => {
  if (typeof row.ci_half === "number" && Number.isFinite(row.ci_half)) {
    return Math.max(0, row.ci_half);
  }

  const { lower, upper } = getConfidenceBounds(row);

  return Math.max(0, (upper - lower) / 2);
};

/**
 * Formats a row's confidence interval.
 *
 * @param row - Leaderboard configuration.
 * @returns Percentage interval prefixed by a plus/minus sign.
 */
export const formatConfidence = (row: DeepSweLeaderboardRow): string =>
  `±${(getConfidenceHalfWidth(row) * 100).toFixed(1)}%`;

/**
 * Returns the selected metric from a leaderboard row.
 *
 * @param row - Leaderboard configuration.
 * @param metric - Selected efficiency metric.
 * @returns Metric value or null when unavailable.
 */
export const getMetricValue = (
  row: DeepSweLeaderboardRow,
  metric: EfficiencyMetric,
): number | null => {
  switch (metric) {
    case "cost":
      return row.mean_cost_usd;

    case "outputTokens":
      return row.mean_output_tokens;

    case "agentSteps":
      return row.mean_agent_steps;
  }
};

/**
 * Returns the axis label for an efficiency metric.
 *
 * @param metric - Selected efficiency metric.
 * @returns Human-readable axis label.
 */
export const getMetricAxisLabel = (metric: EfficiencyMetric): string => {
  switch (metric) {
    case "cost":
      return "Average cost per task";

    case "outputTokens":
      return "Average output tokens";

    case "agentSteps":
      return "Average agent steps";
  }
};

/**
 * Formats an efficiency metric for an axis tick.
 *
 * @param metric - Selected metric.
 * @param value - Numeric metric value.
 * @returns Compact axis value.
 */
export const formatMetricTick = (
  metric: EfficiencyMetric,
  value: number,
): string => {
  switch (metric) {
    case "cost":
      return formatCostAxisTick(value);

    case "outputTokens":
      return formatCompactNumber(value);

    case "agentSteps":
      return Math.round(value).toString();
  }
};

/**
 * Formats an efficiency metric for a tooltip.
 *
 * @param metric - Selected metric.
 * @param value - Numeric metric value.
 * @returns Detailed metric value.
 */
export const formatMetricValue = (
  metric: EfficiencyMetric,
  value: number,
): string => {
  switch (metric) {
    case "cost":
      return `$${value.toFixed(2)}`;

    case "outputTokens":
      return `${formatCompactNumber(value)} tokens`;

    case "agentSteps":
      return `${Math.round(value)} steps`;
  }
};
