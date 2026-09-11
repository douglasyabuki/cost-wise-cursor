import { type ReactElement, useMemo } from "react";

import type { BenchmarkChangelog as BenchmarkChangelogData } from "@/components/benchmarks/benchmark-changelog";
import {
  type EfficiencyChartPoint,
  type EfficiencyChartSeries,
  ModelEfficiencyChart,
} from "@/components/benchmarks/efficiency/model-efficiency-chart";
import type { FrontierCodeLeaderboardRow } from "@/types-and-constants/frontier-code";
import { calculateAxisTickStep, formatCostAxisTick } from "@/utils/chart";
import {
  formatFrontierCodeCost,
  getFrontierCodeReasoningEffortOrder,
} from "@/utils/frontier-code";
import { getModelColor } from "@/utils/model-colors";

/**
 * Properties for the FrontierCode score-versus-cost chart.
 *
 * @property availableRows - All matched configurations available for the active benchmark selection.
 * @property changelog - Optional complete benchmark changelog.
 * @property onAddConfig - Adds one configuration to the selected set.
 * @property onAddModel - Adds every configuration for one model.
 * @property onRemoveConfig - Removes one configuration from the selected set.
 * @property onRemoveModel - Removes every configuration for one model.
 * @property rows - Configurations currently selected for display.
 * @property showAllPointLabels - Whether every visible point receives labels.
 * @property showModelLines - Whether connected model lines are rendered.
 */
export interface FrontierCodeEfficiencyChartProps {
  availableRows: readonly FrontierCodeLeaderboardRow[];
  changelog?: BenchmarkChangelogData;
  onAddConfig: (config: string) => void;
  onAddModel: (model: string) => void;
  onRemoveConfig: (config: string) => void;
  onRemoveModel: (model: string) => void;
  rows: readonly FrontierCodeLeaderboardRow[];
  showAllPointLabels: boolean;
  showModelLines: boolean;
}

const X_AXIS_PADDING_RATIO = 1.04;
const X_AXIS_TARGET_TICK_COUNT = 6;

/** Converts valid rows into ordered FrontierCode efficiency series. */
const createChartSeries = (
  rows: readonly FrontierCodeLeaderboardRow[],
): EfficiencyChartSeries[] => {
  const groupedPoints = new Map<string, EfficiencyChartPoint[]>();

  rows.forEach((row) => {
    if (
      row.cost === null ||
      !Number.isFinite(row.cost) ||
      row.cost <= 0 ||
      !Number.isFinite(row.score)
    ) {
      return;
    }

    const points = groupedPoints.get(row.model) ?? [];
    points.push({
      config: row.config,
      model: row.model,
      effort: row.reasoning_effort,
      isLabelAnchor: false,
      score: row.score * 100,
      xValue: row.cost,
    });
    groupedPoints.set(row.model, points);
  });

  return [...groupedPoints.entries()]
    .map(([model, unsortedPoints]) => {
      const points = [...unsortedPoints].sort(
        (first, second) =>
          getFrontierCodeReasoningEffortOrder(first.effort) -
            getFrontierCodeReasoningEffortOrder(second.effort) ||
          first.xValue - second.xValue,
      );
      const labelPoint = points[points.length - 1];
      return {
        model,
        color: getModelColor(model),
        points: points.map((point) => ({
          ...point,
          isLabelAnchor: point.config === labelPoint?.config,
        })),
      };
    })
    .filter((series) => series.points.length > 0)
    .sort(
      (first, second) =>
        Math.max(...second.points.map((point) => point.score)) -
        Math.max(...first.points.map((point) => point.score)),
    );
};

/** Calculates the padded FrontierCode benchmark-cost domain and ticks. */
const getCostAxis = (
  series: readonly EfficiencyChartSeries[],
): { maximum: number; ticks: number[] } => {
  const highestCost = Math.max(
    0,
    ...series.flatMap((item) => item.points.map((point) => point.xValue)),
  );
  const maximum = highestCost > 0 ? highestCost * X_AXIS_PADDING_RATIO : 1;
  const step = calculateAxisTickStep(maximum, X_AXIS_TARGET_TICK_COUNT);
  const ticks: number[] = [];
  for (let value = 0; value <= maximum + Number.EPSILON; value += step) {
    ticks.push(Math.round(value * 1_000_000) / 1_000_000);
  }
  return { maximum, ticks };
};

/**
 * Renders the FrontierCode score-versus-cost chart.
 *
 * @param props - Visible rows and display configuration.
 * @returns Interactive FrontierCode comparison visualization.
 */
export const FrontierCodeEfficiencyChart = ({
  availableRows,
  changelog,
  onAddConfig,
  onAddModel,
  onRemoveConfig,
  onRemoveModel,
  rows,
  showAllPointLabels,
  showModelLines,
}: FrontierCodeEfficiencyChartProps): ReactElement => {
  const series = useMemo(() => createChartSeries(rows), [rows]);
  const availableConfigs = useMemo(
    () =>
      availableRows.map((row) => ({
        config: row.config,
        level: row.reasoning_effort,
        model: row.model,
      })),
    [availableRows],
  );
  const costAxis = useMemo(() => getCostAxis(series), [series]);

  return (
    <ModelEfficiencyChart
      availableConfigs={availableConfigs}
      changelog={changelog}
      chartAriaDescription="Higher scores and lower benchmark costs indicate stronger value."
      chartAriaLabel="FrontierCode score by benchmark cost"
      emptyMessage="No data is available for the selected configurations."
      formatXAxisTick={formatCostAxisTick}
      formatXAxisValue={formatFrontierCodeCost}
      heading="Score versus benchmark cost"
      headingId="frontier-code-comparison-title"
      metricDescription="Higher scores and lower costs indicate stronger value."
      onAddConfig={onAddConfig}
      onAddModel={onAddModel}
      onRemoveConfig={onRemoveConfig}
      onRemoveModel={onRemoveModel}
      series={series}
      showAllPointLabels={showAllPointLabels}
      showModelLines={showModelLines}
      xAxisLabel="Benchmark cost"
      xAxisMaximum={costAxis.maximum}
      xAxisTicks={costAxis.ticks}
      yAxisLabel="Frontier score"
    />
  );
};
