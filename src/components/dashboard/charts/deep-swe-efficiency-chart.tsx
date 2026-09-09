import {
  type ChartRenderContext,
  defineChart,
  dot,
  lineY,
  text,
  whenFocused,
} from "@tanstack/charts";
import { focusGuideX } from "@tanstack/charts/focus/guide";
import { decorative } from "@tanstack/charts/mark/decorative";
import { Chart } from "@tanstack/charts/react";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { type ReactElement, useCallback, useMemo } from "react";

import type {
  DeepSweLeaderboard,
  DeepSweLeaderboardRow,
  DeepSweReasoningEffort,
  DeepSweVersion,
  EfficiencyMetric,
} from "@/types-and-constants/deep-swe";
import {
  formatChartPercentage,
  getResponsiveChartLabelFontSize,
  setChartPointTitles,
} from "@/utils/chart";
import { formatLongDate } from "@/utils/date";
import {
  formatMetricTick,
  formatMetricValue,
  getMetricAxisLabel,
  getMetricValue,
  getModelColor,
  getReasoningEffort,
  getReasoningEffortOrder,
} from "@/utils/deep-swe";

interface DeepSweEfficiencyChartProps {
  leaderboard: DeepSweLeaderboard;
  metric: EfficiencyMetric;
  rows: readonly DeepSweLeaderboardRow[];
  /** Whether every visible point should display its model and effort labels. */
  showAllPointLabels: boolean;
  /** Whether connected model lines should be rendered. */
  showModelLines: boolean;
  version: DeepSweVersion;
}

type DeepSweEfficiencyChartContentProps = Omit<
  DeepSweEfficiencyChartProps,
  "version"
>;

interface ChartPoint {
  config: string;
  model: string;
  effort: string;
  isLabelAnchor: boolean;
  score: number;
  metricValue: number;
}

interface ChartSeries {
  model: string;
  color: string;
  points: ChartPoint[];
}

interface MetricAxis {
  maximum: number;
  ticks: number[];
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
const SCORE_AXIS_MINIMUM_MAX = 80;
const SCORE_TICK_STEP = 10;

/** Normalizes a model identifier for stable label-anchor lookups. */
const normalizeModelIdentifier = (model: string): string =>
  model
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** Converts valid rows into ordered model series. */
const createChartSeries = (
  rows: readonly DeepSweLeaderboardRow[],
  metric: EfficiencyMetric,
): ChartSeries[] => {
  const groupedPoints = new Map<string, ChartPoint[]>();

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
      metricValue,
    });
    groupedPoints.set(row.model, points);
  });

  return [...groupedPoints.entries()]
    .map(([model, unsortedPoints]) => {
      const points = [...unsortedPoints].sort(
        (first, second) =>
          getReasoningEffortOrder(first.effort) -
            getReasoningEffortOrder(second.effort) ||
          first.metricValue - second.metricValue,
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

/** Calculates the vertical score-axis maximum. */
const getScoreMaximum = (series: readonly ChartSeries[]): number => {
  const highestScore = Math.max(
    0,
    ...series.flatMap((item) => item.points.map((point) => point.score)),
  );
  return Math.min(
    100,
    Math.max(
      SCORE_AXIS_MINIMUM_MAX,
      Math.ceil(highestScore / SCORE_TICK_STEP) * SCORE_TICK_STEP,
    ),
  );
};

/** Creates score ticks from zero through the score-domain maximum. */
const createScoreTicks = (maximum: number): number[] =>
  Array.from(
    { length: maximum / SCORE_TICK_STEP + 1 },
    (_, index) => index * SCORE_TICK_STEP,
  );

/** Calculates a readable 2/5/10 tick interval. */
const getNiceTickStep = (maximum: number, targetTickCount: number): number => {
  if (maximum <= 0) return 1;
  const rawStep = maximum / targetTickCount;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalizedStep = rawStep / magnitude;
  if (normalizedStep >= 5) return 10 * magnitude;
  if (normalizedStep >= 2) return 5 * magnitude;
  return 2 * magnitude;
};

/** Calculates the padded metric domain and readable tick values. */
const getMetricAxis = (series: readonly ChartSeries[]): MetricAxis => {
  const highestMetricValue = Math.max(
    0,
    ...series.flatMap((item) => item.points.map((point) => point.metricValue)),
  );
  const maximum =
    highestMetricValue > 0 ? highestMetricValue * X_AXIS_PADDING_RATIO : 1;
  const step = getNiceTickStep(maximum, X_AXIS_TARGET_TICK_COUNT);
  const ticks: number[] = [];
  for (let value = 0; value <= maximum + Number.EPSILON; value += step) {
    ticks.push(Math.round(value * 1_000_000) / 1_000_000);
  }
  return { maximum, ticks };
};

/** Renders the stateful TanStack Charts host. */
const DeepSweEfficiencyChartContent = ({
  leaderboard,
  metric,
  rows,
  showAllPointLabels,
  showModelLines,
}: DeepSweEfficiencyChartContentProps): ReactElement => {
  const series = useMemo(() => createChartSeries(rows, metric), [metric, rows]);
  const handleChartRender = useCallback(
    ({ scene, svg }: ChartRenderContext<ChartPoint, number, number>) => {
      setChartPointTitles(
        svg,
        scene.points,
        (point) =>
          `${point.model} · ${point.effort} effort · ${formatChartPercentage(point.score)} score · ${formatMetricValue(metric, point.metricValue)}`,
      );
    },
    [metric],
  );
  const definition = useMemo(() => {
    const points = series.flatMap((item) => item.points);
    const labelPoints = points.filter(
      (point) => showAllPointLabels || point.isLabelAnchor,
    );
    const scoreMaximum = getScoreMaximum(series);
    const scoreTicks = createScoreTicks(scoreMaximum);
    const metricAxis = getMetricAxis(series);
    const hoveredLevelPoints = points.filter(
      (point) => !showAllPointLabels && !point.isLabelAnchor,
    );
    const dimUnrelatedModel = {
      when: ({
        datum,
        focus,
      }: {
        datum: ChartPoint;
        focus: { primary: { datum: ChartPoint } | null };
      }) => focus.primary !== null && focus.primary.datum.model !== datum.model,
      style: { opacity: 0.55 },
    } as const;
    const interactionMark = showModelLines
      ? lineY(points, {
          id: "configurations",
          x: "metricValue",
          y: "score",
          z: "model",
          color: "model",
          key: "config",
          points: true,
          strokeWidth: 2.5,
          states: [dimUnrelatedModel],
        })
      : dot(points, {
          id: "configurations",
          x: "metricValue",
          y: "score",
          z: "model",
          color: "model",
          key: "config",
          r: 4,
          states: [
            dimUnrelatedModel,
            {
              when: { focus: "primary" },
              style: { r: 6, stroke: "var(--background)", strokeWidth: 2 },
            },
          ],
        });

    const hoveredLevelLabel =
      hoveredLevelPoints.length > 0
        ? whenFocused(
            text(hoveredLevelPoints, {
              id: "hovered-effort-label",
              x: "metricValue",
              y: "score",
              text: (point) => point.effort.toUpperCase(),
              color: "model",
              key: (point) => `${point.config}-hovered-effort`,
              anchor: "start",
              dx: 11,
              dy: 4,
              fontSize: 10,
              fontWeight: 500,
            }),
            { match: "primary" },
          )
        : null;
    const projection = focusGuideX(points, {
      id: "active-configuration-guide",
      x: "metricValue",
      y: "score",
      z: "model",
      key: "config",
      xRule: {
        stroke: (point) => getModelColor(point.model),
        strokeDasharray: "4 4",
        strokeOpacity: 0.8,
      },
      yRule: {
        stroke: (point) => getModelColor(point.model),
        strokeDasharray: "4 4",
        strokeOpacity: 0.8,
      },
      xLabel: {
        format: (_value, { point }) =>
          formatMetricValue(metric, point.datum.metricValue),
        background: "transparent",
        color: (point) => getModelColor(point.model),
        paddingX: 0,
        paddingY: 0,
        stroke: "transparent",
        fontSize: 12,
        fontWeight: 600,
      },
      yLabel: {
        format: (_value, { point }) => formatChartPercentage(point.datum.score),
        side: "start",
        background: "transparent",
        color: (point) => getModelColor(point.model),
        paddingX: 0,
        paddingY: 0,
        stroke: "transparent",
        fontSize: 12,
        fontWeight: 600,
      },
    });

    return defineChart({
      focus: "nearest",
      keyboard: true,
      chart: ({ width }) => ({
        marks: [
          interactionMark,
          decorative(
            text(labelPoints, {
              id: "model-labels",
              x: "metricValue",
              y: "score",
              text: "model",
              color: "model",
              key: (point) => `${point.config}-model`,
              dy: -18,
              fontSize: getResponsiveChartLabelFontSize(width, 8, 12),
              fontWeight: 600,
            }),
          ),
          decorative(
            text(labelPoints, {
              id: "effort-labels",
              x: "metricValue",
              y: "score",
              text: (point) => point.effort.toUpperCase(),
              color: "model",
              key: (point) => `${point.config}-effort`,
              dy: -7,
              fontSize: getResponsiveChartLabelFontSize(width, 6, 9),
            }),
          ),
          ...(hoveredLevelLabel === null ? [] : [hoveredLevelLabel]),
          projection,
        ],
        scales: {
          x: {
            scale: scaleLinear().domain([0, metricAxis.maximum]),
            reverse: true,
            grid: true,
            axis: {
              line: false,
              ticks: {
                values:
                  width < 560
                    ? metricAxis.ticks.filter((_, index) => index % 2 === 0)
                    : metricAxis.ticks,
                format: (value) => formatMetricTick(metric, value),
              },
              label: getMetricAxisLabel(metric),
            },
          },
          y: {
            scale: scaleLinear().domain([0, scoreMaximum]),
            grid: true,
            axis: {
              line: false,
              ticks: {
                values: scoreTicks,
                format: (value) => `${value}%`,
              },
              label: "DeepSWE score",
            },
          },
        },
        color: {
          domain: series.map((item) => item.model),
          range: series.map((item) => item.color),
        },
        theme: {
          foreground: "var(--muted-foreground)",
          muted: "var(--muted-foreground)",
        },
        margin: { top: 56, right: 76, bottom: 52, left: 56 },
      }),
    });
  }, [metric, series, showAllPointLabels, showModelLines]);
  const lastJobDate = formatLongDate(
    leaderboard.latest_job?.finished_at ?? leaderboard.generated_at,
  );

  return (
    <section
      aria-labelledby="deep-swe-efficiency-title"
      className="flex flex-col gap-3"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3
            className="text-lg leading-tight font-semibold tracking-tight"
            id="deep-swe-efficiency-title"
          >
            Efficiency comparison
          </h3>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-6">
            Compare benchmark score against cost, output tokens, or agent steps.
          </p>
        </div>
        {lastJobDate ? (
          <span className="text-muted-foreground hidden items-center gap-1 text-sm md:flex">
            <span className="hidden lg:block">Last job executed on</span>
            {lastJobDate}
          </span>
        ) : null}
      </div>

      <div className="bg-card relative min-w-0 overflow-hidden rounded-md border">
        <div className="text-muted-foreground pointer-events-none absolute top-4 right-5 z-10 text-xs italic">
          most efficient ↗
        </div>
        {series.length === 0 ? (
          <div className="text-muted-foreground flex h-110 items-center justify-center px-6 text-center text-sm">
            No data is available for the selected configurations and metric.
          </div>
        ) : (
          <Chart
            ariaDescription="Higher scores and lower metric values indicate stronger efficiency."
            ariaLabel={`DeepSWE score by ${getMetricAxisLabel(metric)}`}
            className="w-full"
            definition={definition}
            height={680}
            initialWidth={960}
            onRender={handleChartRender}
          />
        )}
      </div>
    </section>
  );
};

/**
 * Renders the DeepSWE efficiency chart.
 *
 * @param props - Filtered rows, metadata, configuration, and benchmark version.
 * @returns Interactive score-versus-efficiency visualization.
 */
export const DeepSweEfficiencyChart = ({
  leaderboard,
  metric,
  rows,
  showAllPointLabels,
  showModelLines,
  version,
}: DeepSweEfficiencyChartProps): ReactElement => (
  <DeepSweEfficiencyChartContent
    key={`${version}-${metric}`}
    leaderboard={leaderboard}
    metric={metric}
    rows={rows}
    showAllPointLabels={showAllPointLabels}
    showModelLines={showModelLines}
  />
);
