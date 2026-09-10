import { defineChart, dot, lineY, text, whenFocused } from "@tanstack/charts";
import { focusGuideX } from "@tanstack/charts/focus/guide";
import { decorative } from "@tanstack/charts/mark/decorative";
import { Chart } from "@tanstack/charts/react";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { type ReactElement, useCallback, useMemo, useState } from "react";

import type { FrontierCodeLeaderboardRow } from "@/types-and-constants/frontier-code";
import {
  createChartPointSvgRenderer,
  formatChartPercentage,
  formatCostAxisTick,
  getMutedChartColor,
  getResponsiveChartLabelFontSize,
} from "@/utils/chart";
import { getModelColor } from "@/utils/deep-swe";
import {
  formatFrontierCodeCost,
  getFrontierCodeReasoningEffortOrder,
} from "@/utils/frontier-code";

import { ModelChartContextMenu } from "./model-chart-context-menu";

/** Public properties for the FrontierCode score-versus-cost chart. */
export interface FrontierCodeComparisonChartProps {
  /** All matched configurations available for the active benchmark selection. */
  availableRows: readonly FrontierCodeLeaderboardRow[];
  /** Adds one model configuration to the selected configs. */
  onAddConfig: (config: string) => void;
  /** Adds every configuration for one model to the selected configs. */
  onAddModel: (model: string) => void;
  /** Removes one model configuration from the selected configs. */
  onRemoveConfig: (config: string) => void;
  /** Removes every configuration for one model from the selected configs. */
  onRemoveModel: (model: string) => void;
  rows: readonly FrontierCodeLeaderboardRow[];
  /** Whether every visible point should display its model and effort labels. */
  showAllPointLabels: boolean;
  /** Whether connected model lines should be rendered. */
  showModelLines: boolean;
}

interface ChartPoint {
  config: string;
  model: string;
  effort: string;
  isLabelAnchor: boolean;
  cost: number;
  score: number;
}

interface ChartSeries {
  model: string;
  color: string;
  points: ChartPoint[];
}

interface CostAxis {
  maximum: number;
  ticks: number[];
}

const COST_AXIS_PADDING_RATIO = 1.04;
const COST_AXIS_TARGET_TICK_COUNT = 6;
const SCORE_AXIS_MINIMUM_MAX = 80;
const SCORE_TICK_STEP = 10;

/** Converts valid rows into connected model series. */
const createChartSeries = (
  rows: readonly FrontierCodeLeaderboardRow[],
): ChartSeries[] => {
  const groupedPoints = new Map<string, ChartPoint[]>();

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
      cost: row.cost,
      score: row.score * 100,
    });
    groupedPoints.set(row.model, points);
  });

  return [...groupedPoints.entries()]
    .map(([model, unsortedPoints]) => {
      const points = [...unsortedPoints].sort(
        (first, second) =>
          getFrontierCodeReasoningEffortOrder(first.effort) -
            getFrontierCodeReasoningEffortOrder(second.effort) ||
          first.cost - second.cost,
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

/** Creates evenly spaced score-axis ticks. */
const createScoreTicks = (maximum: number): number[] =>
  Array.from(
    { length: maximum / SCORE_TICK_STEP + 1 },
    (_, index) => index * SCORE_TICK_STEP,
  );

/** Returns a readable 2/5/10-based tick interval. */
const getNiceTickStep = (maximum: number): number => {
  if (maximum <= 0) return 1;
  const rawStep = maximum / COST_AXIS_TARGET_TICK_COUNT;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalizedStep = rawStep / magnitude;
  if (normalizedStep >= 5) return 10 * magnitude;
  if (normalizedStep >= 2) return 5 * magnitude;
  return 2 * magnitude;
};

/** Calculates the padded benchmark-cost axis. */
const getCostAxis = (series: readonly ChartSeries[]): CostAxis => {
  const highestCost = Math.max(
    0,
    ...series.flatMap((item) => item.points.map((point) => point.cost)),
  );
  const maximum = highestCost > 0 ? highestCost * COST_AXIS_PADDING_RATIO : 1;
  const step = getNiceTickStep(maximum);
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
export const FrontierCodeComparisonChart = ({
  availableRows,
  onAddConfig,
  onAddModel,
  onRemoveConfig,
  onRemoveModel,
  rows,
  showAllPointLabels,
  showModelLines,
}: FrontierCodeComparisonChartProps): ReactElement => {
  const [activeModel, setActiveModel] = useState<string | null>(null);
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
  const handleFocusChange = useCallback(
    (point: { datum: ChartPoint } | null): void => {
      setActiveModel(point?.datum.model ?? null);
    },
    [],
  );
  const renderSvg = useMemo(
    () =>
      createChartPointSvgRenderer<ChartPoint>(
        (point) =>
          `${point.model} · ${point.effort} effort · ${formatChartPercentage(point.score)} score · ${formatFrontierCodeCost(point.cost)} benchmark cost`,
        (point) => ({
          config: point.config,
          level: point.effort,
          model: point.model,
        }),
      ),
    [],
  );
  const definition = useMemo(() => {
    const points = series.flatMap((item) => item.points);
    const labelPoints = points.filter(
      (point) => showAllPointLabels || point.isLabelAnchor,
    );
    const scoreMaximum = getScoreMaximum(series);
    const scoreTicks = createScoreTicks(scoreMaximum);
    const costAxis = getCostAxis(series);
    const hoveredLevelPoints = points.filter(
      (point) => !showAllPointLabels && !point.isLabelAnchor,
    );
    const interactionMark = showModelLines
      ? lineY(points, {
          id: "configurations",
          x: "cost",
          y: "score",
          z: "model",
          color: "model",
          key: "config",
          points: true,
          strokeWidth: 2.5,
        })
      : dot(points, {
          id: "configurations",
          x: "cost",
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
            x: "cost",
            y: "score",
            z: "model",
            color: "model",
            key: "config",
            points: true,
            strokeWidth: 2.5,
          })
        : dot(points, {
            id: "focused-configurations",
            x: "cost",
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
              x: "cost",
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
      x: "cost",
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
        format: (_value, { point }) => formatFrontierCodeCost(point.datum.cost),
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
              x: "cost",
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
              x: "cost",
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
              x: "cost",
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
              x: "cost",
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
            scale: scaleLinear().domain([0, costAxis.maximum]),
            reverse: true,
            grid: true,
            axis: {
              line: false,
              ticks: {
                values:
                  width < 560
                    ? costAxis.ticks.filter((_, index) => index % 2 === 0)
                    : costAxis.ticks,
                format: formatCostAxisTick,
              },
              label: "Benchmark cost",
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
              label: "Frontier score",
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
  }, [activeModel, series, showAllPointLabels, showModelLines]);

  return (
    <section
      aria-labelledby="frontier-code-comparison-title"
      className="flex flex-col gap-3"
    >
      <div className="min-w-0">
        <h3
          className="text-lg leading-tight font-semibold tracking-tight"
          id="frontier-code-comparison-title"
        >
          Score versus benchmark cost
        </h3>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-6">
          Higher scores and lower costs indicate stronger value.
        </p>
      </div>

      <div className="bg-card relative min-w-0 overflow-hidden rounded-md border">
        <div className="text-muted-foreground pointer-events-none absolute top-4 right-5 z-10 text-xs italic">
          most efficient ↗
        </div>
        {series.length === 0 ? (
          <div className="text-muted-foreground flex h-110 items-center justify-center px-6 text-center text-sm">
            No data is available for the selected configurations.
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
              ariaDescription="Higher scores and lower benchmark costs indicate stronger value."
              ariaLabel="FrontierCode score by benchmark cost"
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
