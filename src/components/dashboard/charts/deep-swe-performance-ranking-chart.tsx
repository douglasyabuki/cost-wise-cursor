import { type ReactElement, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { DeepSweLeaderboardRow } from "@/types-and-constants/deep-swe";
import {
  compareModelNames,
  formatCompactNumber,
  formatConfidence,
  formatCost,
  formatCostEfficiency,
  formatScore,
  getConfidenceBounds,
  getCostEfficiency,
  getModelColor,
  getReasoningEffort,
} from "@/utils/deep-swe";

type RankingMode = "best" | "all";
type RankingMetric = "performance" | "costEfficiency";

interface DeepSwePerformanceRankingChartProps {
  rows: readonly DeepSweLeaderboardRow[];
  onConfigSelect?: (config: string | null) => void;
}

interface ModelGroup {
  model: string;
  rows: readonly DeepSweLeaderboardRow[];
  bestRow: DeepSweLeaderboardRow;
}

interface ToggleFilterOption<T extends string> {
  label: string;
  value: T;
}

interface ToggleFilterProps<T extends string> {
  label: string;
  options: readonly ToggleFilterOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

interface RankingRowProps {
  axisMaximum: number;
  isSelected: boolean;
  row: DeepSweLeaderboardRow;
  onSelect: (config: string) => void;
}

interface ScoreAxisProps {
  maximum: number;
  ticks: readonly number[];
}

const RANKING_MODE_OPTIONS = [
  { label: "Best", value: "best" },
  { label: "All effort levels", value: "all" },
] as const satisfies readonly ToggleFilterOption<RankingMode>[];

const RANKING_METRIC_OPTIONS = [
  { label: "Performance", value: "performance" },
  { label: "Cost efficiency", value: "costEfficiency" },
] as const satisfies readonly ToggleFilterOption<RankingMetric>[];

const REASONING_EFFORT_RANK: Readonly<Record<string, number>> = {
  default: 0,
  none: 0,
  minimal: 1,
  low: 2,
  medium: 3,
  high: 4,
  xhigh: 5,
  max: 6,
};

const SCORE_TICK_STEP = 20;
const MINIMUM_SCORE_AXIS_MAXIMUM = 80;

/**
 * Returns a sortable rank for a reasoning-effort label.
 *
 * @param effort - Reasoning-effort label.
 * @returns Numeric rank, with higher values representing higher effort.
 */
const getReasoningEffortRank = (effort: string): number =>
  REASONING_EFFORT_RANK[effort.toLowerCase()] ?? -1;

/**
 * Chooses the highest available reasoning-effort configuration for a model.
 *
 * Pass@1 breaks ties between configurations at the same effort level. In this
 * component, "Best" means highest available effort, not highest measured
 * Pass@1.
 *
 * @param rows - Configurations belonging to one model.
 * @returns Highest-effort configuration.
 */
const getBestEffortRow = (
  rows: readonly DeepSweLeaderboardRow[],
): DeepSweLeaderboardRow =>
  rows.reduce((bestRow, row) => {
    const effortDifference =
      getReasoningEffortRank(getReasoningEffort(row)) -
      getReasoningEffortRank(getReasoningEffort(bestRow));

    if (effortDifference > 0) {
      return row;
    }

    if (effortDifference === 0 && row.pass_at_1 > bestRow.pass_at_1) {
      return row;
    }

    return bestRow;
  });

/**
 * Groups leaderboard rows by model and orders the groups by the Pass@1 score
 * of each model's highest-effort configuration.
 *
 * @param rows - Filtered leaderboard configurations.
 * @returns Score-ordered model groups.
 */
const groupRowsByModel = (
  rows: readonly DeepSweLeaderboardRow[],
): ModelGroup[] => {
  const rowsByModel = new Map<string, DeepSweLeaderboardRow[]>();

  rows.forEach((row) => {
    const modelRows = rowsByModel.get(row.model) ?? [];

    modelRows.push(row);
    rowsByModel.set(row.model, modelRows);
  });

  return [...rowsByModel.entries()]
    .map(([model, modelRows]) => ({
      model,
      rows: modelRows,
      bestRow: getBestEffortRow(modelRows),
    }))
    .sort(
      (first, second) =>
        second.bestRow.pass_at_1 - first.bestRow.pass_at_1 ||
        compareModelNames(first.model, second.model),
    );
};

/**
 * Orders configurations by Pass@1.
 *
 * @param first - First configuration.
 * @param second - Second configuration.
 * @returns Array-sort comparison value.
 */
const compareByPerformance = (
  first: DeepSweLeaderboardRow,
  second: DeepSweLeaderboardRow,
): number =>
  second.pass_at_1 - first.pass_at_1 ||
  compareModelNames(first.model, second.model) ||
  getReasoningEffortRank(getReasoningEffort(second)) -
    getReasoningEffortRank(getReasoningEffort(first));

/**
 * Orders configurations by Pass@1 points per benchmark dollar.
 *
 * Rows without usable cost data are placed last. Performance is used as the
 * tie breaker.
 *
 * @param first - First configuration.
 * @param second - Second configuration.
 * @returns Array-sort comparison value.
 */
const compareByCostEfficiency = (
  first: DeepSweLeaderboardRow,
  second: DeepSweLeaderboardRow,
): number => {
  const firstEfficiency = getCostEfficiency(first);
  const secondEfficiency = getCostEfficiency(second);

  if (firstEfficiency === null && secondEfficiency === null) {
    return compareByPerformance(first, second);
  }

  if (firstEfficiency === null) {
    return 1;
  }

  if (secondEfficiency === null) {
    return -1;
  }

  return (
    secondEfficiency - firstEfficiency || compareByPerformance(first, second)
  );
};

/**
 * Calculates a readable score-axis maximum.
 *
 * The maximum is at least 80%, grows in 20-point increments when necessary,
 * and never exceeds 100%.
 *
 * @param rows - Rows currently shown in the ranking.
 * @returns Percentage-axis maximum.
 */
const getScoreAxisMaximum = (
  rows: readonly DeepSweLeaderboardRow[],
): number => {
  const highestUpperBound = Math.max(
    0,
    ...rows.map(
      (row) => Math.max(row.pass_at_1, getConfidenceBounds(row).upper) * 100,
    ),
  );

  return Math.min(
    100,
    Math.max(
      MINIMUM_SCORE_AXIS_MAXIMUM,
      Math.ceil(highestUpperBound / SCORE_TICK_STEP) * SCORE_TICK_STEP,
    ),
  );
};

/**
 * Creates evenly spaced score-axis ticks.
 *
 * @param maximum - Axis maximum percentage.
 * @returns Percentage tick values.
 */
const createScoreTicks = (maximum: number): number[] =>
  Array.from(
    {
      length: Math.floor(maximum / SCORE_TICK_STEP) + 1,
    },
    (_, index) => index * SCORE_TICK_STEP,
  );

/**
 * Converts a fractional score to a percentage position within the axis.
 *
 * @param value - Fractional score value.
 * @param axisMaximum - Percentage-axis maximum.
 * @returns Clamped CSS percentage.
 */
const getAxisPosition = (value: number, axisMaximum: number): number =>
  Math.min(100, Math.max(0, (value * 100 * 100) / axisMaximum));

/**
 * Renders a single-selection toggle filter.
 *
 * @param props - Toggle-filter properties.
 * @returns Filter control.
 */
const ToggleFilter = <T extends string>({
  label,
  options,
  value,
  onChange,
}: ToggleFilterProps<T>): ReactElement => (
  <ToggleGroup
    aria-label={label}
    className="bg-background"
    onValueChange={(values) => {
      const [nextValue] = values;

      if (nextValue !== undefined) {
        onChange(nextValue as T);
      }
    }}
    size="sm"
    spacing={0}
    value={[value]}
    variant="outline"
  >
    {options.map((option) => (
      <ToggleGroupItem
        aria-label={option.label}
        className="min-w-10"
        key={option.value}
        value={option.value}
      >
        {option.label}
      </ToggleGroupItem>
    ))}
  </ToggleGroup>
);

/**
 * Renders a score bar with its confidence-interval whisker.
 *
 * @param props - Score-visualization properties.
 * @returns Horizontal score visualization.
 */
const ScoreBar = ({
  axisMaximum,
  row,
}: Pick<RankingRowProps, "axisMaximum" | "row">): ReactElement => {
  const confidenceBounds = getConfidenceBounds(row);
  const scorePosition = getAxisPosition(row.pass_at_1, axisMaximum);
  const confidenceStart = getAxisPosition(confidenceBounds.lower, axisMaximum);
  const confidenceEnd = getAxisPosition(confidenceBounds.upper, axisMaximum);
  const color = getModelColor(row.model);

  return (
    <div aria-hidden="true" className="relative h-5 min-w-0 flex-1">
      <div className="bg-muted/50 absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-sm" />

      <div
        className="absolute top-1/2 left-0 h-2 -translate-y-1/2 rounded-sm transition-[width] duration-200"
        style={{
          backgroundColor: color,
          width: `${scorePosition}%`,
        }}
      />

      <div
        className="bg-foreground/80 absolute top-1/2 h-px -translate-y-1/2"
        style={{
          left: `${confidenceStart}%`,
          width: `${Math.max(0, confidenceEnd - confidenceStart)}%`,
        }}
      >
        <span className="bg-foreground/80 absolute top-1/2 left-0 h-2 w-px -translate-y-1/2" />
        <span className="bg-foreground/80 absolute top-1/2 right-0 h-2 w-px -translate-y-1/2" />
      </div>

      <span
        className="border-card absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
        style={{
          backgroundColor: color,
          left: `${scorePosition}%`,
        }}
      />
    </div>
  );
};

/**
 * Renders one selectable leaderboard configuration.
 *
 * @param props - Ranking-row properties.
 * @returns Responsive ranking row.
 */
const RankingRow = ({
  axisMaximum,
  isSelected,
  row,
  onSelect,
}: RankingRowProps): ReactElement => {
  const effort = getReasoningEffort(row);
  const score = formatScore(row.pass_at_1);
  const confidence = formatConfidence(row);
  const cost = formatCost(row.mean_cost_usd);
  const costEfficiency = formatCostEfficiency(getCostEfficiency(row));
  const outputTokens = formatCompactNumber(row.mean_output_tokens);
  const agentSteps = formatCompactNumber(row.mean_agent_steps);

  return (
    <Button
      aria-label={`${row.model}, ${effort} effort, Pass at 1 ${score}, average cost ${cost}, cost efficiency ${costEfficiency}`}
      aria-pressed={isSelected}
      className="hover:bg-muted/50 aria-pressed:bg-accent/70 h-auto w-full justify-start rounded-none px-2 py-3 text-left whitespace-normal shadow-none lg:px-3"
      onClick={() => onSelect(row.config)}
      title={`${row.model} · ${effort} · ${score} ${confidence}`}
      type="button"
      variant="ghost"
    >
      <div className="w-full min-w-0 lg:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden="true"
            className="size-2 shrink-0 rounded-full"
            style={{
              backgroundColor: getModelColor(row.model),
            }}
          />

          <span className="min-w-0 flex-1 truncate font-medium">
            {row.model}
          </span>

          <Badge className="font-mono text-[10px]" variant="outline">
            {effort.toUpperCase()}
          </Badge>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <ScoreBar axisMaximum={axisMaximum} row={row} />

          <span className="w-12 text-right font-medium tabular-nums">
            {score}
          </span>
        </div>

        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div>
            <dt className="text-muted-foreground">Confidence</dt>
            <dd className="mt-0.5 tabular-nums">{confidence}</dd>
          </div>

          <div>
            <dt className="text-muted-foreground">Avg cost</dt>
            <dd className="mt-0.5 tabular-nums">{cost}</dd>
          </div>

          <div>
            <dt className="text-muted-foreground">Cost efficiency</dt>
            <dd className="mt-0.5 tabular-nums">{costEfficiency}</dd>
          </div>

          <div>
            <dt className="text-muted-foreground">Out tok</dt>
            <dd className="mt-0.5 tabular-nums">{outputTokens}</dd>
          </div>

          <div>
            <dt className="text-muted-foreground">Steps</dt>
            <dd className="mt-0.5 tabular-nums">{agentSteps}</dd>
          </div>
        </dl>
      </div>

      <div className="hidden w-full min-w-0 grid-cols-[minmax(170px,1fr)_minmax(240px,2fr)_5rem_6rem_5rem_4rem] items-center gap-4 lg:grid">
        <div className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden="true"
            className="size-2 shrink-0 rounded-full"
            style={{
              backgroundColor: getModelColor(row.model),
            }}
          />

          <span className="min-w-0 truncate font-medium">{row.model}</span>

          <Badge className="shrink-0 font-mono text-[10px]" variant="outline">
            {effort.toUpperCase()}
          </Badge>
        </div>

        <div className="grid min-w-0 grid-cols-[minmax(120px,1fr)_4.75rem] items-center gap-3">
          <ScoreBar axisMaximum={axisMaximum} row={row} />

          <div className="text-right tabular-nums">
            <div className="font-medium">{score}</div>
            <div className="text-muted-foreground text-[10px]">
              {confidence}
            </div>
          </div>
        </div>

        <span className="text-right tabular-nums">{cost}</span>

        <span className="text-right tabular-nums">{costEfficiency}</span>

        <span className="text-right tabular-nums">{outputTokens}</span>

        <span className="text-right tabular-nums">{agentSteps}</span>
      </div>
    </Button>
  );
};

/**
 * Renders the percentage axis below the score bars.
 *
 * @param props - Axis maximum and tick values.
 * @returns Desktop score axis.
 */
const ScoreAxis = ({ maximum, ticks }: ScoreAxisProps): ReactElement => (
  <div className="hidden grid-cols-[minmax(170px,1fr)_minmax(240px,2fr)_5rem_6rem_5rem_4rem] items-start gap-4 px-3 pt-2 pb-1 lg:grid">
    <div />

    <div className="grid min-w-0 grid-cols-[minmax(120px,1fr)_4.75rem] gap-3">
      <div className="relative h-5">
        {ticks.map((tick) => {
          const position = (tick / maximum) * 100;
          const transform =
            tick === 0
              ? "translateX(0)"
              : tick === maximum
                ? "translateX(-100%)"
                : "translateX(-50%)";

          return (
            <span
              className="text-muted-foreground absolute top-0 text-[10px] tabular-nums"
              key={tick}
              style={{
                left: `${position}%`,
                transform,
              }}
            >
              {tick}%
            </span>
          );
        })}
      </div>

      <div />
    </div>
  </div>
);

/**
 * Renders the DeepSWE performance ranking chart.
 *
 * The parent dashboard supplies filtered rows and can remount this component
 * when the benchmark version changes, resetting its local ranking mode and
 * selected configuration.
 *
 * @param props - Filtered rows and optional selection callback.
 * @returns Interactive performance ranking chart.
 */
export const DeepSwePerformanceRankingChart = ({
  rows,
  onConfigSelect,
}: DeepSwePerformanceRankingChartProps): ReactElement => {
  const modelGroups = useMemo(() => groupRowsByModel(rows), [rows]);

  const [rankingMode, setRankingMode] = useState<RankingMode>("best");

  const [rankingMetric, setRankingMetric] =
    useState<RankingMetric>("performance");

  const [selectedConfig, setSelectedConfig] = useState<string | null>(null);

  const visibleRows = useMemo(() => {
    const rankedRows = modelGroups.flatMap((group) =>
      rankingMode === "best" ? [group.bestRow] : group.rows,
    );

    return [...rankedRows].sort(
      rankingMetric === "costEfficiency"
        ? compareByCostEfficiency
        : compareByPerformance,
    );
  }, [modelGroups, rankingMetric, rankingMode]);

  const activeSelectedConfig =
    selectedConfig !== null && rows.some((row) => row.config === selectedConfig)
      ? selectedConfig
      : null;

  const scoreAxisMaximum = getScoreAxisMaximum(visibleRows);

  const scoreTicks = createScoreTicks(scoreAxisMaximum);

  /**
   * Changes the ranking detail and clears a potentially hidden selection.
   *
   * @param nextMode - Ranking detail to display.
   */
  const handleRankingModeChange = (nextMode: RankingMode): void => {
    setRankingMode(nextMode);
    setSelectedConfig(null);
    onConfigSelect?.(null);
  };

  /**
   * Changes the metric used to order rows.
   *
   * @param nextMetric - Ranking metric to apply.
   */
  const handleRankingMetricChange = (nextMetric: RankingMetric): void => {
    setRankingMetric(nextMetric);
  };

  /**
   * Toggles the selected leaderboard configuration.
   *
   * @param config - Configuration identifier.
   */
  const handleConfigSelect = (config: string): void => {
    const nextConfig = activeSelectedConfig === config ? null : config;

    setSelectedConfig(nextConfig);
    onConfigSelect?.(nextConfig);
  };

  return (
    <section aria-labelledby="model-ranking-title" className="space-y-3">
      <h2 className="sr-only" id="model-ranking-title">
        Model ranking
      </h2>

      <div className="flex flex-wrap items-center justify-between">
        <ToggleFilter
          label="Ranking detail"
          onChange={handleRankingModeChange}
          options={RANKING_MODE_OPTIONS}
          value={rankingMode}
        />

        <div className="flex items-center gap-2">
          <span className="text-sm">Sort by:</span>
          <ToggleFilter
            label="Ranking metric"
            onChange={handleRankingMetricChange}
            options={RANKING_METRIC_OPTIONS}
            value={rankingMetric}
          />
          <span className="text-sm">↓</span>
        </div>
      </div>

      <div className="border-border bg-card rounded-md border px-3 py-2 lg:px-4 lg:py-3">
        <div className="text-muted-foreground hidden grid-cols-[minmax(170px,1fr)_minmax(240px,2fr)_5rem_6rem_5rem_4rem] gap-4 border-b px-3 pb-2 text-xs font-medium lg:grid">
          <span>Model</span>
          <span>Pass@1</span>
          <span className="text-right">Avg cost</span>
          <span className="text-right">Efficiency</span>
          <span className="text-right">Out tok</span>
          <span className="text-right">Steps</span>
        </div>

        {visibleRows.length === 0 ? (
          <div className="text-muted-foreground flex min-h-36 flex-col items-center justify-center gap-3 px-4 text-center text-sm">
            <p>No configurations are selected.</p>
          </div>
        ) : (
          <div className="divide-border divide-y">
            {visibleRows.map((row) => (
              <RankingRow
                axisMaximum={scoreAxisMaximum}
                isSelected={activeSelectedConfig === row.config}
                key={row.config}
                onSelect={handleConfigSelect}
                row={row}
              />
            ))}
          </div>
        )}

        {visibleRows.length > 0 ? (
          <ScoreAxis maximum={scoreAxisMaximum} ticks={scoreTicks} />
        ) : null}
      </div>
    </section>
  );
};
