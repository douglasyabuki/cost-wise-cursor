import { defineChart, dot, lineY, text, whenFocused } from "@tanstack/charts";
import { focusGuideX } from "@tanstack/charts/focus/guide";
import { decorative } from "@tanstack/charts/mark/decorative";
import { Chart } from "@tanstack/charts/react";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { type ReactElement, useCallback, useMemo, useState } from "react";

import {
  BenchmarkChangelog,
  type BenchmarkChangelog as BenchmarkChangelogData,
} from "@/components/benchmarks/benchmark-changelog";
import { ModelChartContextMenu } from "@/components/benchmarks/efficiency/model-chart-context-menu";
import {
  createChartPointSvgRenderer,
  formatChartPercentage,
  getMutedChartColor,
  getResponsiveChartLabelFontSize,
} from "@/utils/chart";
import { getModelColor } from "@/utils/model-colors";

/** A normalized efficiency-chart point used by both benchmark datasets. */
export interface EfficiencyChartPoint {
  /** Stable configuration identifier used for focus and context actions. */
  config: string;
  /** Model identifier shown in labels and the legend color. */
  model: string;
  /** Reasoning-effort label shown beside the model. */
  effort: string;
  /** Whether this point is the default label anchor for its model. */
  isLabelAnchor: boolean;
  /** Score in percentage points. */
  score: number;
  /** Normalized x-axis value, such as cost or efficiency metric. */
  xValue: number;
}

/** A colored model series for the shared efficiency chart. */
export interface EfficiencyChartSeries {
  /** Model identifier represented by the series. */
  model: string;
  /** Model color used by marks and labels. */
  color: string;
  /** Ordered configurations represented by the model. */
  points: EfficiencyChartPoint[];
}

interface ModelEfficiencyChartProps {
  availableConfigs: readonly {
    config: string;
    level: string;
    model: string;
  }[];
  changelog?: BenchmarkChangelogData;
  chartAriaDescription: string;
  chartAriaLabel: string;
  emptyMessage: string;
  formatXAxisTick: (value: number) => string;
  formatXAxisValue: (value: number) => string;
  heading: string;
  headingId: string;
  metricDescription: string;
  onAddConfig: (config: string) => void;
  onAddModel: (model: string) => void;
  onRemoveConfig: (config: string) => void;
  onRemoveModel: (model: string) => void;
  series: readonly EfficiencyChartSeries[];
  showAllPointLabels: boolean;
  showModelLines: boolean;
  xAxisLabel: string;
  xAxisMaximum: number;
  xAxisTicks: readonly number[];
  yAxisLabel: string;
}

const SCORE_AXIS_MINIMUM_MAX = 80;
const SCORE_TICK_STEP = 10;

const getScoreMaximum = (series: readonly EfficiencyChartSeries[]): number => {
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

const createScoreTicks = (maximum: number): number[] =>
  Array.from(
    { length: maximum / SCORE_TICK_STEP + 1 },
    (_, index) => index * SCORE_TICK_STEP,
  );

/**
 * Renders the shared interactive score-versus-efficiency chart.
 *
 * @param props - Prepared series, axis formatting, metadata, and chart actions.
 * @returns An accessible, keyboard-navigable efficiency comparison chart.
 */
export const ModelEfficiencyChart = ({
  availableConfigs,
  changelog,
  chartAriaDescription,
  chartAriaLabel,
  emptyMessage,
  formatXAxisTick,
  formatXAxisValue,
  heading,
  headingId,
  metricDescription,
  onAddConfig,
  onAddModel,
  onRemoveConfig,
  onRemoveModel,
  series,
  showAllPointLabels,
  showModelLines,
  xAxisLabel,
  xAxisMaximum,
  xAxisTicks,
  yAxisLabel,
}: ModelEfficiencyChartProps): ReactElement => {
  const [activeModel, setActiveModel] = useState<string | null>(null);
  const handleFocusChange = useCallback(
    (point: { datum: EfficiencyChartPoint } | null): void => {
      setActiveModel(point?.datum.model ?? null);
    },
    [],
  );
  const renderSvg = useMemo(
    () =>
      createChartPointSvgRenderer<EfficiencyChartPoint>(
        (point) =>
          `${point.model} · ${point.effort} effort · ${formatChartPercentage(point.score)} score · ${formatXAxisValue(point.xValue)}`,
        (point) => ({
          config: point.config,
          level: point.effort,
          model: point.model,
        }),
      ),
    [formatXAxisValue],
  );
  const definition = useMemo(() => {
    const points = series.flatMap((item) => item.points);
    const labelPoints = points.filter(
      (point) => showAllPointLabels || point.isLabelAnchor,
    );
    const scoreMaximum = getScoreMaximum(series);
    const scoreTicks = createScoreTicks(scoreMaximum);
    const hoveredLevelPoints = points.filter(
      (point) => !showAllPointLabels && !point.isLabelAnchor,
    );
    const interactionMark = showModelLines
      ? lineY(points, {
          id: "configurations",
          x: "xValue",
          y: "score",
          z: "model",
          color: "model",
          key: "config",
          points: true,
          strokeWidth: 2.5,
        })
      : dot(points, {
          id: "configurations",
          x: "xValue",
          y: "score",
          z: "model",
          color: "model",
          key: "config",
          r: 4,
          states: [
            {
              when: { focus: "primary" },
              style: { r: 6, stroke: "var(--background)", strokeWidth: 2 },
            },
          ],
        });
    const focusedInteractionMark = whenFocused(
      showModelLines
        ? lineY(points, {
            id: "focused-configurations",
            x: "xValue",
            y: "score",
            z: "model",
            color: "model",
            key: "config",
            points: true,
            strokeWidth: 2.5,
          })
        : dot(points, {
            id: "focused-configurations",
            x: "xValue",
            y: "score",
            z: "model",
            color: "model",
            key: "config",
            r: 4,
          }),
      { match: "series" },
    );
    const hoveredLevelLabel =
      hoveredLevelPoints.length > 0
        ? whenFocused(
            text(hoveredLevelPoints, {
              id: "hovered-effort-label",
              x: "xValue",
              y: "score",
              z: "model",
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
      x: "xValue",
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
        format: (_value, { point }) => formatXAxisValue(point.datum.xValue),
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
      svgAnimation: {
        duration: 150,
        easing: "ease-out",
        respectReducedMotion: true,
      },
      chart: ({ width }) => ({
        marks: [
          interactionMark,
          decorative(
            text(labelPoints, {
              id: "model-labels",
              x: "xValue",
              y: "score",
              z: "model",
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
              x: "xValue",
              y: "score",
              z: "model",
              text: (point) => point.effort.toUpperCase(),
              color: "model",
              key: (point) => `${point.config}-effort`,
              dy: -7,
              fontSize: getResponsiveChartLabelFontSize(width, 6, 9),
            }),
          ),
          focusedInteractionMark,
          whenFocused(
            text(labelPoints, {
              id: "focused-model-labels",
              x: "xValue",
              y: "score",
              z: "model",
              text: "model",
              color: "model",
              key: (point) => `${point.config}-focused-model`,
              dy: -18,
              fontSize: getResponsiveChartLabelFontSize(width, 8, 12),
              fontWeight: 600,
            }),
            { match: "series" },
          ),
          whenFocused(
            text(labelPoints, {
              id: "focused-effort-labels",
              x: "xValue",
              y: "score",
              z: "model",
              text: (point) => point.effort.toUpperCase(),
              color: "model",
              key: (point) => `${point.config}-focused-effort`,
              dy: -7,
              fontSize: getResponsiveChartLabelFontSize(width, 6, 9),
            }),
            { match: "series" },
          ),
          ...(hoveredLevelLabel === null ? [] : [hoveredLevelLabel]),
          projection,
        ],
        scales: {
          x: {
            scale: scaleLinear().domain([0, xAxisMaximum]),
            reverse: true,
            grid: true,
            axis: {
              line: false,
              ticks: {
                values:
                  width < 560
                    ? xAxisTicks.filter((_, index) => index % 2 === 0)
                    : xAxisTicks,
                format: formatXAxisTick,
              },
              label: xAxisLabel,
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
              label: yAxisLabel,
            },
          },
        },
        color: {
          domain: series.map((item) => item.model),
          range: series.map((item) =>
            activeModel !== null && activeModel !== item.model
              ? getMutedChartColor(item.color)
              : item.color,
          ),
        },
        theme: {
          foreground: "var(--muted-foreground)",
          muted: "var(--muted-foreground)",
        },
        margin: { top: 56, right: 76, bottom: 52, left: 56 },
      }),
    });
  }, [
    activeModel,
    formatXAxisTick,
    formatXAxisValue,
    series,
    showAllPointLabels,
    showModelLines,
    xAxisLabel,
    xAxisMaximum,
    xAxisTicks,
    yAxisLabel,
  ]);

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3
            className="text-lg leading-tight font-semibold tracking-tight"
            id={headingId}
          >
            {heading}
          </h3>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-6">
            {metricDescription}
          </p>
        </div>
        <BenchmarkChangelog changelog={changelog} />
      </div>

      <div className="bg-card relative min-w-0 overflow-hidden rounded-md border">
        <div className="text-muted-foreground pointer-events-none absolute top-4 right-5 z-10 text-xs italic">
          most efficient ←
        </div>
        {series.length === 0 ? (
          <div className="text-muted-foreground flex h-110 items-center justify-center px-6 text-center text-sm">
            {emptyMessage}
          </div>
        ) : (
          <ModelChartContextMenu
            availableConfigs={availableConfigs}
            onAddConfig={onAddConfig}
            onAddModel={onAddModel}
            onRemoveConfig={onRemoveConfig}
            onRemoveModel={onRemoveModel}
          >
            <Chart
              ariaDescription={chartAriaDescription}
              ariaLabel={chartAriaLabel}
              className="w-full **:data-ts-focus-layer:pointer-events-none [&_path]:pointer-events-none [&_text]:pointer-events-none"
              definition={definition}
              height={680}
              initialWidth={960}
              onFocusChange={handleFocusChange}
              renderSvg={renderSvg}
            />
          </ModelChartContextMenu>
        )}
      </div>
    </section>
  );
};
