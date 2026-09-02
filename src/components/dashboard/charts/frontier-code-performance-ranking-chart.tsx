import { type ReactElement, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type {
  FrontierCodeLeaderboardRow,
  FrontierCodeRankingMetric,
  FrontierCodeRankingMode,
} from "@/types-and-constants/frontier-code";
import { getModelColor } from "@/utils/deep-swe";
import {
  compareFrontierCodeModelNames,
  formatFrontierCodeCost,
  formatFrontierCodeCostEfficiency,
  formatFrontierCodePassRate,
  formatFrontierCodeScore,
  getFrontierCodeCostEfficiency,
  getFrontierCodeReasoningEffortOrder,
} from "@/utils/frontier-code";

/**
 * Public properties for the FrontierCode performance ranking.
 */
export interface FrontierCodePerformanceRankingChartProps {
  rows: readonly FrontierCodeLeaderboardRow[];
  onConfigSelect?: (config: string | null) => void;
}

interface ModelGroup {
  model: string;
  rows: readonly FrontierCodeLeaderboardRow[];
  bestRow: FrontierCodeLeaderboardRow;
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
  row: FrontierCodeLeaderboardRow;
  onSelect: (config: string) => void;
}

interface ScoreAxisProps {
  maximum: number;
  ticks: readonly number[];
}

const RANKING_MODE_OPTIONS = [
  { label: "Best", value: "best" },
  { label: "All effort levels", value: "all" },
] as const satisfies readonly ToggleFilterOption<FrontierCodeRankingMode>[];

const RANKING_METRIC_OPTIONS = [
  { label: "Score", value: "score" },
  { label: "Cost Efficiency", value: "costEfficiency" },
] as const satisfies readonly ToggleFilterOption<FrontierCodeRankingMetric>[];

const SCORE_TICK_STEP = 20;
const MINIMUM_SCORE_AXIS_MAXIMUM = 80;

/**
 * Groups rows by model and selects the highest-scoring configuration as Best.
 *
 * @param rows - Visible FrontierCode configurations.
 * @returns Model groups with score-selected best rows.
 */
const groupRowsByModel = (
  rows: readonly FrontierCodeLeaderboardRow[],
): ModelGroup[] => {
  const rowsByModel = new Map<string, FrontierCodeLeaderboardRow[]>();

  rows.forEach((row) => {
    const modelRows = rowsByModel.get(row.model) ?? [];
    modelRows.push(row);
    rowsByModel.set(row.model, modelRows);
  });

  return [...rowsByModel.entries()]
    .map(([model, modelRows]) => ({
      model,
      rows: modelRows,
      bestRow: [...modelRows].sort(
        (first, second) =>
          second.score - first.score ||
          getFrontierCodeReasoningEffortOrder(second.reasoning_effort) -
            getFrontierCodeReasoningEffortOrder(first.reasoning_effort),
      )[0] as FrontierCodeLeaderboardRow,
    }))
    .sort(
      (first, second) =>
        second.bestRow.score - first.bestRow.score ||
        compareFrontierCodeModelNames(first.model, second.model),
    );
};

/**
 * Orders rows by FrontierCode score.
 *
 * @param first - First row.
 * @param second - Second row.
 * @returns Array-sort comparison value.
 */
const compareByScore = (
  first: FrontierCodeLeaderboardRow,
  second: FrontierCodeLeaderboardRow,
): number =>
  second.score - first.score ||
  compareFrontierCodeModelNames(first.model, second.model) ||
  getFrontierCodeReasoningEffortOrder(second.reasoning_effort) -
    getFrontierCodeReasoningEffortOrder(first.reasoning_effort);

/**
 * Orders rows by FrontierCode score percentage points per benchmark dollar.
 * Rows without usable cost data are placed last. Score is used as the tie
 * breaker.
 *
 * @param first - First row.
 * @param second - Second row.
 * @returns Array-sort comparison value.
 */
const compareByCostEfficiency = (
  first: FrontierCodeLeaderboardRow,
  second: FrontierCodeLeaderboardRow,
): number => {
  const firstEfficiency = getFrontierCodeCostEfficiency(first);
  const secondEfficiency = getFrontierCodeCostEfficiency(second);

  if (firstEfficiency === null && secondEfficiency === null) {
    return compareByScore(first, second);
  }

  if (firstEfficiency === null) return 1;
  if (secondEfficiency === null) return -1;

  return secondEfficiency - firstEfficiency || compareByScore(first, second);
};

/**
 * Calculates a readable score-axis maximum.
 *
 * @param rows - Rows currently shown in the ranking.
 * @returns Percentage-axis maximum.
 */
const getScoreAxisMaximum = (
  rows: readonly FrontierCodeLeaderboardRow[],
): number => {
  const highestScore = Math.max(0, ...rows.map((row) => row.score * 100));

  return Math.min(
    100,
    Math.max(
      MINIMUM_SCORE_AXIS_MAXIMUM,
      Math.ceil(highestScore / SCORE_TICK_STEP) * SCORE_TICK_STEP,
    ),
  );
};

/**
 * Creates evenly spaced score-axis ticks.
 *
 * @param maximum - Axis maximum.
 * @returns Percentage tick values.
 */
const createScoreTicks = (maximum: number): number[] =>
  Array.from(
    { length: Math.floor(maximum / SCORE_TICK_STEP) + 1 },
    (_, index) => index * SCORE_TICK_STEP,
  );

/**
 * Converts a fractional score to a percentage position within the axis.
 *
 * @param value - Fractional score.
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
      if (nextValue !== undefined) onChange(nextValue as T);
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
 * Renders a score bar without confidence bounds.
 *
 * FrontierCode provides a score but no confidence interval, so this visual
 * intentionally shows only the score position.
 *
 * @param props - Score-axis and row properties.
 * @returns Horizontal score visualization.
 */
const ScoreBar = ({
  axisMaximum,
  row,
}: Pick<RankingRowProps, "axisMaximum" | "row">): ReactElement => {
  const color = getModelColor(row.model);
  const scorePosition = getAxisPosition(row.score, axisMaximum);

  return (
    <div aria-hidden="true" className="relative h-5 min-w-0 flex-1">
      <div className="bg-muted/50 absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-sm" />
      <div
        className="absolute top-1/2 left-0 h-2 -translate-y-1/2 rounded-sm transition-[width] duration-200"
        style={{ backgroundColor: color, width: `${scorePosition}%` }}
      />
      <span
        className="border-card absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
        style={{ backgroundColor: color, left: `${scorePosition}%` }}
      />
    </div>
  );
};

/**
 * Renders one selectable FrontierCode ranking row.
 *
 * @param props - Ranking-row properties.
 * @returns Responsive ranking row.
 */
const RankingRow = ({
  axisMaximum,
  isSelected,
  onSelect,
  row,
}: RankingRowProps): ReactElement => {
  const score = formatFrontierCodeScore(row.score);
  const passRate = formatFrontierCodePassRate(row.pass_rate);
  const cost = formatFrontierCodeCost(row.cost);
  const costEfficiency = formatFrontierCodeCostEfficiency(
    getFrontierCodeCostEfficiency(row),
  );
  const flaggedRate =
    row.flagged_rate === null
      ? "—"
      : formatFrontierCodePassRate(row.flagged_rate);

  return (
    <Button
      aria-label={`${row.model}, ${row.reasoning_effort} effort, FrontierCode score ${score}, pass rate ${passRate}, average cost ${cost}, cost efficiency ${costEfficiency}, harness ${row.harness}, flagged rate ${flaggedRate}`}
      aria-pressed={isSelected}
      className="hover:bg-muted/50 aria-pressed:bg-accent/70 h-auto w-full justify-start rounded-none px-2 py-3 text-left whitespace-normal shadow-none lg:px-3"
      onClick={() => onSelect(row.config)}
      title={`${row.model} · ${row.reasoning_effort} · ${score}`}
      type="button"
      variant="ghost"
    >
      <div className="w-full min-w-0 lg:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden="true"
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: getModelColor(row.model) }}
          />
          <span className="min-w-0 flex-1 truncate font-medium">
            {row.model}
          </span>
          <Badge className="font-mono text-[10px]" variant="outline">
            {row.reasoning_effort.toUpperCase()}
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
            <dt className="text-muted-foreground">Pass rate</dt>
            <dd className="mt-0.5 tabular-nums">{passRate}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Harness</dt>
            <dd className="mt-0.5 truncate">{row.harness}</dd>
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
            <dt className="text-muted-foreground">Flagged</dt>
            <dd className="mt-0.5 tabular-nums">{flaggedRate}</dd>
          </div>
        </dl>
      </div>

      <div className="hidden w-full min-w-0 grid-cols-[minmax(145px,1.15fr)_minmax(185px,1.7fr)_5.25rem_5.75rem_6.5rem_minmax(105px,0.85fr)_5rem] items-center gap-4 lg:grid">
        <div className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden="true"
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: getModelColor(row.model) }}
          />
          <span className="min-w-0 truncate font-medium">{row.model}</span>
          <Badge className="shrink-0 font-mono text-[10px]" variant="outline">
            {row.reasoning_effort.toUpperCase()}
          </Badge>
        </div>

        <div className="grid min-w-0 grid-cols-[minmax(110px,1fr)_4rem] items-center gap-3">
          <ScoreBar axisMaximum={axisMaximum} row={row} />
          <span className="text-right font-medium tabular-nums">{score}</span>
        </div>

        <span className="text-right tabular-nums">{passRate}</span>
        <span className="text-right tabular-nums">{cost}</span>
        <span className="text-right tabular-nums">{costEfficiency}</span>
        <span className="truncate text-right">{row.harness}</span>
        <span className="text-right tabular-nums">{flaggedRate}</span>
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
  <div className="hidden grid-cols-[minmax(145px,1.15fr)_minmax(185px,1.7fr)_5.25rem_5.75rem_6.5rem_minmax(105px,0.85fr)_5rem] items-start gap-4 px-3 pt-2 pb-1 lg:grid">
    <div />
    <div className="grid min-w-0 grid-cols-[minmax(100px,1fr)_4rem] gap-3">
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
              style={{ left: `${position}%`, transform }}
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
 * Renders the FrontierCode performance ranking.
 *
 * Best selects the highest measured FrontierCode score for each model. The
 * ranking deliberately does not draw confidence whiskers because FrontierCode
 * does not provide confidence bounds in its response.
 *
 * @param props - Filtered FrontierCode rows and optional selection callback.
 * @returns Interactive FrontierCode ranking.
 */
export const FrontierCodePerformanceRankingChart = ({
  onConfigSelect,
  rows,
}: FrontierCodePerformanceRankingChartProps): ReactElement => {
  const modelGroups = useMemo(() => groupRowsByModel(rows), [rows]);
  const [rankingMode, setRankingMode] =
    useState<FrontierCodeRankingMode>("best");
  const [rankingMetric, setRankingMetric] =
    useState<FrontierCodeRankingMetric>("score");
  const [selectedConfig, setSelectedConfig] = useState<string | null>(null);

  const visibleRows = useMemo(() => {
    const rankedRows = modelGroups.flatMap((group) =>
      rankingMode === "best" ? [group.bestRow] : group.rows,
    );

    return [...rankedRows].sort(
      rankingMetric === "costEfficiency"
        ? compareByCostEfficiency
        : compareByScore,
    );
  }, [modelGroups, rankingMetric, rankingMode]);

  const activeSelectedConfig =
    selectedConfig !== null && rows.some((row) => row.config === selectedConfig)
      ? selectedConfig
      : null;
  const scoreAxisMaximum = getScoreAxisMaximum(visibleRows);
  const scoreTicks = createScoreTicks(scoreAxisMaximum);

  /**
   * Changes the ranking detail and clears a hidden selection.
   *
   * @param nextMode - Ranking detail.
   */
  const handleRankingModeChange = (nextMode: FrontierCodeRankingMode): void => {
    setRankingMode(nextMode);
    setSelectedConfig(null);
    onConfigSelect?.(null);
  };

  /**
   * Changes the metric used to order rows.
   *
   * @param nextMetric - Ranking metric.
   */
  const handleRankingMetricChange = (
    nextMetric: FrontierCodeRankingMetric,
  ): void => setRankingMetric(nextMetric);

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
    <section
      aria-labelledby="frontier-code-model-ranking-title"
      className="flex flex-col gap-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3
          className="text-lg leading-tight font-semibold tracking-tight"
          id="frontier-code-model-ranking-title"
        >
          Model ranking
        </h3>

        <div className="flex flex-wrap items-center gap-2">
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
            <span aria-hidden="true" className="text-sm">
              ↓
            </span>
          </div>
        </div>
      </div>

      <div className="border-border bg-card rounded-md border px-3 py-2 lg:px-4 lg:py-3">
        <div className="text-muted-foreground hidden grid-cols-[minmax(145px,1.15fr)_minmax(185px,1.7fr)_5.25rem_5.75rem_6.5rem_minmax(105px,0.85fr)_5rem] gap-4 border-b px-3 pb-2 text-xs font-medium lg:grid">
          <span>Model</span>
          <span>FrontierCode score</span>
          <span className="text-right">Pass rate</span>
          <span className="text-right">Avg cost</span>
          <span className="text-right">Cost efficiency</span>
          <span className="text-right">Harness</span>
          <span className="text-right">Flagged</span>
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
