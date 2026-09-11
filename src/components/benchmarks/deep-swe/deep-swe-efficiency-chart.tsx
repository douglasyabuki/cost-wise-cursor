import { type ReactElement, useCallback, useMemo } from "react";

import { type BenchmarkChangelog as BenchmarkChangelogData } from "@/components/benchmarks/benchmark-changelog";
import {
  type EfficiencyChartPoint,
  type EfficiencyChartSeries,
  ModelEfficiencyChart,
} from "@/components/benchmarks/efficiency/model-efficiency-chart";
import type {
  DeepSweLeaderboardRow,
  DeepSweReasoningEffort,
  DeepSweVersion,
  EfficiencyMetric,
} from "@/types-and-constants/deep-swe";
import { calculateAxisTickStep } from "@/utils/chart";
import {
  formatMetricTick,
  formatMetricValue,
  getMetricAxisLabel,
  getMetricValue,
  getReasoningEffort,
  getReasoningEffortOrder,
} from "@/utils/deep-swe";
import { getModelColor } from "@/utils/model-colors";

/**
 * Properties for the DeepSWE score-versus-efficiency chart.
 *
 * @property availableRows - All matched configurations available for the active benchmark version.
 * @property changelog - Optional complete benchmark changelog.
 * @property metric - Efficiency metric plotted on the horizontal axis.
 * @property onAddConfig - Adds one configuration to the selected set.
 * @property onAddModel - Adds every configuration for one model.
 * @property onRemoveConfig - Removes one configuration from the selected set.
 * @property onRemoveModel - Removes every configuration for one model.
 * @property rows - Configurations currently selected for display.
 * @property showAllPointLabels - Whether every visible point receives labels.
 * @property showModelLines - Whether connected model lines are rendered.
 * @property version - Benchmark version used to reset chart interaction state.
 */
interface DeepSweEfficiencyChartProps {
  availableRows: readonly DeepSweLeaderboardRow[];
  changelog?: BenchmarkChangelogData;
  metric: EfficiencyMetric;
  onAddConfig: (config: string) => void;
  onAddModel: (model: string) => void;
  onRemoveConfig: (config: string) => void;
  onRemoveModel: (model: string) => void;
  rows: readonly DeepSweLeaderboardRow[];
  showAllPointLabels: boolean;
  showModelLines: boolean;
  version: DeepSweVersion;
}

const PREFERRED_LABEL_EFFORTS: Readonly<
  Partial<Record<string, DeepSweReasoningEffort>>
> = {
  "gpt-5-6-sol": "medium",
  "gpt-5-6-terra": "medium",
  "gpt-5-6-luna": "medium",
  "gpt-5-5": "medium",
  "claude-opus-4-8": "high",
  "claude-opus-4-7": "xhigh",
  "claude-fable-5": "high",
  "claude-sonnet-5": "high",
  "gemini-3-5-flash": "high",
  "gemini-3-7-flash": "medium",
  "muse-spark-1-1": "medium",
};
const X_AXIS_PADDING_RATIO = 1.04;
const X_AXIS_TARGET_TICK_COUNT = 6;

/** Normalizes a model identifier for stable label-anchor lookups. */
const normalizeModelIdentifier = (model: string): string =>
  model
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** Converts valid rows into ordered DeepSWE efficiency series. */
const createChartSeries = (
  rows: readonly DeepSweLeaderboardRow[],
  metric: EfficiencyMetric,
): EfficiencyChartSeries[] => {
  const groupedPoints = new Map<string, EfficiencyChartPoint[]>();

  rows.forEach((row) => {
    const metricValue = getMetricValue(row, metric);
    if (
      metricValue === null ||
      !Number.isFinite(metricValue) ||
      metricValue <= 0 ||
      !Number.isFinite(row.pass_at_1)
    ) {
      return;
    }

    const points = groupedPoints.get(row.model) ?? [];
    points.push({
      config: row.config,
      model: row.model,
      effort: getReasoningEffort(row),
      isLabelAnchor: false,
      score: row.pass_at_1 * 100,
      xValue: metricValue,
    });
    groupedPoints.set(row.model, points);
  });

  return [...groupedPoints.entries()]
    .map(([model, unsortedPoints]) => {
      const points = [...unsortedPoints].sort(
        (first, second) =>
          getReasoningEffortOrder(first.effort) -
            getReasoningEffortOrder(second.effort) ||
          first.xValue - second.xValue,
      );
      const preferredEffort =
        PREFERRED_LABEL_EFFORTS[normalizeModelIdentifier(model)];
      const labelPoint =
        points.find(
          (point) => point.effort.toLowerCase() === preferredEffort,
        ) ?? points[points.length - 1];

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

/** Calculates the padded DeepSWE metric domain and readable ticks. */
const getMetricAxis = (
  series: readonly EfficiencyChartSeries[],
): { maximum: number; ticks: number[] } => {
  const highestMetricValue = Math.max(
    0,
    ...series.flatMap((item) => item.points.map((point) => point.xValue)),
  );
  const maximum =
    highestMetricValue > 0 ? highestMetricValue * X_AXIS_PADDING_RATIO : 1;
  const step = calculateAxisTickStep(maximum, X_AXIS_TARGET_TICK_COUNT);
  const ticks: number[] = [];
  for (let value = 0; value <= maximum + Number.EPSILON; value += step) {
    ticks.push(Math.round(value * 1_000_000) / 1_000_000);
  }
  return { maximum, ticks };
};

/**
 * Renders the DeepSWE score-versus-efficiency chart.
 *
 * @param props - Filtered rows, metadata, configuration, and benchmark version.
 * @returns Interactive score-versus-efficiency visualization.
 */
export const DeepSweEfficiencyChart = ({
  availableRows,
  changelog,
  metric,
  onAddConfig,
  onAddModel,
  onRemoveConfig,
  onRemoveModel,
  rows,
  showAllPointLabels,
  showModelLines,
  version,
}: DeepSweEfficiencyChartProps): ReactElement => {
  const series = useMemo(() => createChartSeries(rows, metric), [metric, rows]);
  const availableConfigs = useMemo(
    () =>
      availableRows.map((row) => ({
        config: row.config,
        level: getReasoningEffort(row),
        model: row.model,
      })),
    [availableRows],
  );
  const metricAxis = useMemo(() => getMetricAxis(series), [series]);
  const formatXAxisTick = useCallback(
    (value: number): string => formatMetricTick(metric, value),
    [metric],
  );
  const formatXAxisValue = useCallback(
    (value: number): string => formatMetricValue(metric, value),
    [metric],
  );

  return (
    <ModelEfficiencyChart
      key={`${version}-${metric}`}
      availableConfigs={availableConfigs}
      changelog={changelog}
      chartAriaDescription="Higher scores and lower metric values indicate stronger efficiency."
      chartAriaLabel={`DeepSWE score by ${getMetricAxisLabel(metric)}`}
      emptyMessage="No data is available for the selected configurations and metric."
      formatXAxisTick={formatXAxisTick}
      formatXAxisValue={formatXAxisValue}
      heading="Efficiency comparison"
      headingId="deep-swe-efficiency-title"
      metricDescription="Compare benchmark score against cost, output tokens, or agent steps."
      onAddConfig={onAddConfig}
      onAddModel={onAddModel}
      onRemoveConfig={onRemoveConfig}
      onRemoveModel={onRemoveModel}
      series={series}
      showAllPointLabels={showAllPointLabels}
      showModelLines={showModelLines}
      xAxisLabel={getMetricAxisLabel(metric)}
      xAxisMaximum={metricAxis.maximum}
      xAxisTicks={metricAxis.ticks}
      yAxisLabel="DeepSWE score"
    />
  );
};
