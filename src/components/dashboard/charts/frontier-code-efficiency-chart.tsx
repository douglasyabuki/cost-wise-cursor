import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  CartesianGrid,
  LabelList,
  ReferenceLine,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import { type ChartConfig, ChartContainer } from "@/components/ui/chart";
import type { FrontierCodeLeaderboardRow } from "@/types-and-constants/frontier-code";
import { getNearestLineConfig, type ScatterLinePoint } from "@/utils/chart";
import { getModelColor } from "@/utils/deep-swe";
import {
  formatFrontierCodeCost,
  getFrontierCodeReasoningEffortOrder,
} from "@/utils/frontier-code";

/**
 * Public properties for the FrontierCode score-versus-cost chart.
 */
export interface FrontierCodeComparisonChartProps {
  rows: readonly FrontierCodeLeaderboardRow[];
}

interface ChartPoint {
  config: string;
  model: string;
  effort: string;
  isLabelAnchor: boolean;
  label: string;
  cost: number;
  score: number;
}

interface ChartSeries {
  model: string;
  color: string;
  labelConfig: string;
  points: ChartPoint[];
}

interface ScatterShapeProps {
  cx?: number;
  cy?: number;
  payload?: ChartPoint;
}

interface ScatterLineProps {
  points?: ScatterLinePoint[];
}

interface ComparisonDotProps extends ScatterShapeProps {
  activeConfig: string | null;
  activeModel: string | null;
  color: string;
  pinnedConfig: string | null;
  onHover: (config: string) => void;
  onLeave: () => void;
  onPin: (config: string) => void;
}

interface ComparisonLineProps extends ScatterLineProps {
  activeModel: string | null;
  color: string;
  configurations: readonly ChartPoint[];
  fallbackConfig: string;
  model: string;
  onHover: (config: string) => void;
  onLeave: () => void;
  onPin: (config: string) => void;
}

interface LabelContentProps {
  index?: number;
  payload?: ChartPoint;
  viewBox?: {
    height?: number;
    width?: number;
    x?: number;
    y?: number;
  };
  x?: number;
  y?: number;
}

interface ComparisonLabelProps extends LabelContentProps {
  activeModel: string | null;
  color: string;
  model: string;
  onHover: (config: string) => void;
  onLeave: () => void;
  onPin: (config: string) => void;
}

const COST_AXIS_PADDING_RATIO = 1.04;
const COST_AXIS_TARGET_TICK_COUNT = 6;
const SCORE_AXIS_MINIMUM_MAX = 80;
const SCORE_TICK_STEP = 10;

const chartConfig = {
  score: {
    label: "FrontierCode score",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

/**
 * Converts rows into connected model series for the score/cost chart.
 *
 * @param rows - Visible FrontierCode configurations.
 * @returns Series with one connected path per model.
 */
const createChartSeries = (
  rows: readonly FrontierCodeLeaderboardRow[],
): ChartSeries[] => {
  const groupedPoints = new Map<string, ChartPoint[]>();

  rows.forEach((row) => {
    const cost = row.cost;

    if (!Number.isFinite(cost) || cost <= 0 || !Number.isFinite(row.score)) {
      return;
    }

    const points = groupedPoints.get(row.model) ?? [];

    points.push({
      config: row.config,
      model: row.model,
      effort: row.reasoning_effort,
      isLabelAnchor: false,
      label: "",
      cost,
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
        labelConfig: labelPoint?.config ?? "",
        points: points.map((point) => ({
          ...point,
          isLabelAnchor: point.config === labelPoint?.config,
          label: point.config === labelPoint?.config ? point.model : "",
        })),
      };
    })
    .filter((series) => series.points.length > 0)
    .sort((first, second) => {
      const firstScore = Math.max(...first.points.map((point) => point.score));
      const secondScore = Math.max(
        ...second.points.map((point) => point.score),
      );

      return secondScore - firstScore;
    });
};

/**
 * Calculates the vertical score-axis maximum.
 *
 * @param series - Visible chart series.
 * @returns Rounded percentage maximum.
 */
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

/**
 * Creates evenly spaced score-axis ticks.
 *
 * @param maximum - Score-axis maximum.
 * @returns Percentage tick values.
 */
const createScoreTicks = (maximum: number): number[] =>
  Array.from(
    { length: maximum / SCORE_TICK_STEP + 1 },
    (_, index) => index * SCORE_TICK_STEP,
  );

/**
 * Returns a readable 2/5/10-based tick step.
 *
 * @param maximum - Positive axis maximum.
 * @returns Tick step.
 */
const getNiceTickStep = (maximum: number): number => {
  if (maximum <= 0) return 1;

  const rawStep = maximum / COST_AXIS_TARGET_TICK_COUNT;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalizedStep = rawStep / magnitude;

  if (normalizedStep >= 5) return 10 * magnitude;
  if (normalizedStep >= 2) return 5 * magnitude;
  return 2 * magnitude;
};

/**
 * Calculates a padded cost axis.
 *
 * @param series - Visible chart series.
 * @returns Axis maximum and readable ticks.
 */
const getCostAxis = (
  series: readonly ChartSeries[],
): { maximum: number; ticks: number[] } => {
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
 * Finds a chart point by configuration id.
 *
 * @param series - Visible chart series.
 * @param config - Configuration id.
 * @returns Matching point or null.
 */
const findChartPoint = (
  series: readonly ChartSeries[],
  config: string | null,
): ChartPoint | null => {
  if (config === null) return null;

  for (const item of series) {
    const point = item.points.find((candidate) => candidate.config === config);

    if (point) return point;
  }

  return null;
};

/**
 * Returns focus treatment for marks belonging to another model.
 *
 * @param model - Mark model name.
 * @param activeModel - Focused model name.
 * @returns Opacity and grayscale styles.
 */
const getModelFocusStyle = (
  model: string,
  activeModel: string | null,
): CSSProperties => ({
  opacity: activeModel !== null && activeModel !== model ? 0.55 : 1,
  filter:
    activeModel !== null && activeModel !== model ? "grayscale(1)" : "none",
  transition: "opacity 150ms ease, filter 150ms ease",
});

/**
 * Renders a keyboard-accessible score/cost point.
 *
 * @param props - Point geometry and interaction state.
 * @returns Interactive SVG point.
 */
const ComparisonDot = ({
  activeConfig,
  activeModel,
  color,
  cx,
  cy,
  onHover,
  onLeave,
  onPin,
  payload,
  pinnedConfig,
}: ComparisonDotProps): ReactElement => {
  if (cx === undefined || cy === undefined || payload === undefined) {
    return <g />;
  }

  const isActive = activeConfig === payload.config;
  const isPinned = pinnedConfig === payload.config;
  const accessibleLabel = `${payload.model}, ${payload.effort} effort, ${Math.round(payload.score)}% FrontierCode score, ${formatFrontierCodeCost(payload.cost)} benchmark cost`;

  return (
    <g
      aria-label={accessibleLabel}
      aria-pressed={isPinned}
      onBlur={onLeave}
      onClick={(event: ReactMouseEvent<SVGGElement>) => {
        event.stopPropagation();
        onPin(payload.config);
      }}
      onFocus={() => onHover(payload.config)}
      onKeyDown={(event: ReactKeyboardEvent<SVGGElement>) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onPin(payload.config);
        }
      }}
      onMouseEnter={() => onHover(payload.config)}
      onMouseLeave={onLeave}
      role="button"
      style={{
        ...getModelFocusStyle(payload.model, activeModel),
        cursor: "pointer",
        outline: "none",
      }}
      tabIndex={0}
    >
      <title>{accessibleLabel}</title>
      <circle cx={cx} cy={cy} fill="transparent" r={14} />
      <circle
        cx={cx}
        cy={cy}
        fill={
          payload.isLabelAnchor
            ? color
            : `color-mix(in oklab, ${color} 84%, var(--card))`
        }
        r={isActive ? 6 : 4}
        stroke={isActive ? "var(--background)" : "none"}
        strokeWidth={isActive ? 2 : 0}
      />

      {isActive && !payload.isLabelAnchor ? (
        <text
          fill={color}
          fontSize={10}
          fontWeight={500}
          pointerEvents="none"
          style={{
            fontFamily: "var(--font-mono)",
            letterSpacing: "0.08em",
            paintOrder: "stroke",
            stroke: "var(--background)",
            strokeLinejoin: "round",
            strokeWidth: 3,
          }}
          textAnchor="start"
          x={cx + 11}
          y={cy + 4}
        >
          {payload.effort.toUpperCase()}
        </text>
      ) : null}
    </g>
  );
};

/**
 * Renders a keyboard-accessible connected model path.
 *
 * @param props - Path geometry and interaction state.
 * @returns Interactive SVG path group.
 */
const ComparisonLine = ({
  activeModel,
  color,
  configurations,
  fallbackConfig,
  model,
  onHover,
  onLeave,
  onPin,
  points,
}: ComparisonLineProps): ReactElement => {
  const path = (points ?? []).reduce<string>((result, point) => {
    const pointX = point.x ?? point.cx;
    const pointY = point.y ?? point.cy;

    if (!Number.isFinite(pointX) || !Number.isFinite(pointY)) return result;

    return `${result}${result ? " L" : "M"} ${pointX} ${pointY}`;
  }, "");

  if (!path) return <g />;

  /**
   * Updates the focused configuration as the pointer moves along the line.
   */
  const handleLineHover = (event: ReactMouseEvent<SVGGElement>): void => {
    onHover(
      getNearestLineConfig(event, points, configurations, fallbackConfig),
    );
  };

  return (
    <g
      aria-label={`Inspect ${model}`}
      onBlur={onLeave}
      onClick={(event: ReactMouseEvent<SVGGElement>) => {
        event.stopPropagation();
        onPin(
          event.detail === 0
            ? fallbackConfig
            : getNearestLineConfig(
                event,
                points,
                configurations,
                fallbackConfig,
              ),
        );
      }}
      onFocus={() => onHover(fallbackConfig)}
      onKeyDown={(event: ReactKeyboardEvent<SVGGElement>) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onPin(fallbackConfig);
        }
      }}
      onMouseEnter={handleLineHover}
      onMouseLeave={onLeave}
      onMouseMove={handleLineHover}
      role="button"
      style={{ cursor: "pointer", outline: "none" }}
      tabIndex={0}
    >
      <path
        d={path}
        fill="none"
        pointerEvents="stroke"
        stroke="transparent"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={12}
      />
      <path
        d={path}
        fill="none"
        pointerEvents="none"
        stroke={`color-mix(in oklab, ${color} 84%, var(--card))`}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2.5}
        style={getModelFocusStyle(model, activeModel)}
      />
    </g>
  );
};

/**
 * Renders a model label anchored to one configuration.
 *
 * @param props - Label geometry and interaction state.
 * @returns Interactive SVG label or null.
 */
const ComparisonLabel = ({
  activeModel,
  color,
  model,
  onHover,
  onLeave,
  onPin,
  payload,
  viewBox,
  x,
  y,
}: ComparisonLabelProps): ReactElement | null => {
  const anchorX =
    x ??
    (viewBox?.x === undefined
      ? undefined
      : viewBox.x + (viewBox.width ?? 0) / 2);
  const anchorY =
    y ??
    (viewBox?.y === undefined
      ? undefined
      : viewBox.y + (viewBox.height ?? 0) / 2);

  if (
    payload === undefined ||
    !payload.isLabelAnchor ||
    anchorX === undefined ||
    anchorY === undefined
  ) {
    return null;
  }

  return (
    <g
      aria-label={`Inspect ${model} ${payload.effort} configuration`}
      onBlur={onLeave}
      onClick={(event: ReactMouseEvent<SVGGElement>) => {
        event.stopPropagation();
        onPin(payload.config);
      }}
      onFocus={() => onHover(payload.config)}
      onKeyDown={(event: ReactKeyboardEvent<SVGGElement>) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onPin(payload.config);
        }
      }}
      onMouseEnter={() => onHover(payload.config)}
      onMouseLeave={onLeave}
      role="button"
      style={{
        ...getModelFocusStyle(model, activeModel),
        cursor: "pointer",
        outline: "none",
      }}
      tabIndex={0}
      transform={`translate(${anchorX} ${anchorY - 18})`}
    >
      <text
        fill={color}
        fontSize={12}
        fontWeight={600}
        style={{
          paintOrder: "stroke",
          stroke: "var(--background)",
          strokeLinejoin: "round",
          strokeWidth: 3.5,
        }}
        textAnchor="middle"
      >
        {model}
      </text>
      <text
        fill={color}
        fontSize={9}
        opacity={0.65}
        style={{
          fontFamily: "var(--font-mono)",
          letterSpacing: "0.08em",
          paintOrder: "stroke",
          stroke: "var(--background)",
          strokeLinejoin: "round",
          strokeWidth: 3,
        }}
        textAnchor="middle"
        y={10}
      >
        {payload.effort.toUpperCase()}
      </text>
    </g>
  );
};

/**
 * Renders the stateful FrontierCode score-versus-cost chart.
 *
 * @param props - Visible FrontierCode rows.
 * @returns Interactive connected scatter chart.
 */
const FrontierCodeComparisonChartContent = ({
  rows,
}: FrontierCodeComparisonChartProps): ReactElement => {
  const [hoveredConfig, setHoveredConfig] = useState<string | null>(null);
  const [pinnedConfig, setPinnedConfig] = useState<string | null>(null);
  const series = useMemo(() => createChartSeries(rows), [rows]);
  const scoreMaximum = getScoreMaximum(series);
  const scoreTicks = createScoreTicks(scoreMaximum);
  const costAxis = getCostAxis(series);
  const hoveredPoint = findChartPoint(series, hoveredConfig);
  const pinnedPoint = findChartPoint(series, pinnedConfig);
  const activePoint = pinnedPoint
    ? hoveredPoint?.model === pinnedPoint.model
      ? hoveredPoint
      : pinnedPoint
    : hoveredPoint;
  const activeModel = activePoint?.model ?? null;
  const activeColor = activePoint
    ? getModelColor(activePoint.model)
    : undefined;
  const orderedSeries = activeModel
    ? [...series].sort(
        (first, second) =>
          Number(first.model === activeModel) -
          Number(second.model === activeModel),
      )
    : series;

  useEffect(() => {
    if (pinnedConfig === null) return undefined;

    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        setHoveredConfig(null);
        setPinnedConfig(null);
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => window.removeEventListener("keydown", handleEscape);
  }, [pinnedConfig]);

  /**
   * Focuses a chart configuration.
   *
   * @param config - Configuration identifier.
   */
  const handlePointHover = (config: string): void => setHoveredConfig(config);

  /**
   * Clears temporary chart focus.
   */
  const handlePointLeave = (): void => setHoveredConfig(null);

  /**
   * Toggles persistent focus for a chart configuration.
   *
   * @param config - Configuration identifier.
   */
  const handlePointPin = (config: string): void => {
    setHoveredConfig(null);
    setPinnedConfig((current) => (current === config ? null : config));
  };

  /**
   * Clears chart pinning.
   */
  const handleClearPin = (): void => {
    setHoveredConfig(null);
    setPinnedConfig(null);
  };

  return (
    <section
      aria-labelledby="frontier-code-comparison-title"
      className="flex flex-col gap-3"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
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

        {pinnedPoint ? (
          <Button onClick={handleClearPin} size="sm" variant="ghost">
            Clear pinned
          </Button>
        ) : null}
      </div>

      <div className="bg-card relative rounded-md border">
        <div className="text-muted-foreground pointer-events-none absolute top-4 right-5 z-10 text-xs italic">
          most efficient ↗
        </div>

        {series.length === 0 ? (
          <div className="text-muted-foreground flex h-110 items-center justify-center px-6 text-center text-sm">
            No data is available for the selected configurations.
          </div>
        ) : (
          <ChartContainer
            className="aspect-auto h-[clamp(440px,62vw,680px)] w-full"
            config={chartConfig}
          >
            <ScatterChart
              accessibilityLayer
              margin={{ top: 56, right: 76, bottom: 52, left: 20 }}
              onClick={handleClearPin}
              onMouseLeave={handlePointLeave}
            >
              <CartesianGrid
                horizontal
                vertical
                stroke="var(--foreground)"
                strokeOpacity={0.2}
                strokeWidth={1}
              />

              <XAxis
                axisLine={false}
                dataKey="cost"
                domain={[0, costAxis.maximum]}
                interval="preserveStartEnd"
                label={{
                  value: "Benchmark cost",
                  position: "insideBottom",
                  offset: -30,
                }}
                reversed
                ticks={costAxis.ticks}
                tickFormatter={(value: number) => formatFrontierCodeCost(value)}
                tickLine={false}
                type="number"
              />

              <YAxis
                axisLine={false}
                dataKey="score"
                domain={[0, scoreMaximum]}
                label={{
                  value: "Frontier score",
                  angle: 0,
                  position: "top",
                  offset: 22,
                }}
                ticks={scoreTicks}
                tickFormatter={(value: number) => `${value}%`}
                tickLine={false}
                type="number"
              />

              <ZAxis range={[48, 48]} />

              {activePoint && activeColor ? (
                <>
                  <ReferenceLine
                    ifOverflow="visible"
                    label={{
                      fill: activeColor,
                      fontSize: 12,
                      fontWeight: 600,
                      position: "bottom",
                      value: formatFrontierCodeCost(activePoint.cost),
                    }}
                    stroke={activeColor}
                    strokeDasharray="4 4"
                    strokeOpacity={0.8}
                    x={activePoint.cost}
                  />
                  <ReferenceLine
                    ifOverflow="visible"
                    label={{
                      fill: activeColor,
                      fontSize: 12,
                      fontWeight: 600,
                      position: "left",
                      value: `${Math.round(activePoint.score)}%`,
                    }}
                    stroke={activeColor}
                    strokeDasharray="4 4"
                    strokeOpacity={0.8}
                    y={activePoint.score}
                  />
                </>
              ) : null}

              {orderedSeries.map((item) => (
                <Scatter
                  data={item.points}
                  fill={item.color}
                  isAnimationActive={false}
                  key={item.model}
                  line={
                    <ComparisonLine
                      activeModel={activeModel}
                      color={item.color}
                      configurations={item.points}
                      fallbackConfig={item.labelConfig}
                      model={item.model}
                      onHover={handlePointHover}
                      onLeave={handlePointLeave}
                      onPin={handlePointPin}
                    />
                  }
                  lineType="joint"
                  name={item.model}
                  shape={(shapeProps: unknown) => (
                    <ComparisonDot
                      {...(shapeProps as ScatterShapeProps)}
                      activeConfig={activePoint?.config ?? null}
                      activeModel={activeModel}
                      color={item.color}
                      onHover={handlePointHover}
                      onLeave={handlePointLeave}
                      onPin={handlePointPin}
                      pinnedConfig={pinnedPoint?.config ?? null}
                    />
                  )}
                >
                  <LabelList
                    content={(labelProps: unknown) => {
                      const resolvedProps = labelProps as LabelContentProps;
                      const labelPoint =
                        resolvedProps.index === undefined
                          ? undefined
                          : item.points[resolvedProps.index];

                      return (
                        <ComparisonLabel
                          {...resolvedProps}
                          activeModel={activeModel}
                          color={item.color}
                          model={item.model}
                          onHover={handlePointHover}
                          onLeave={handlePointLeave}
                          onPin={handlePointPin}
                          payload={labelPoint}
                        />
                      );
                    }}
                    dataKey="label"
                    position="top"
                  />
                </Scatter>
              ))}
            </ScatterChart>
          </ChartContainer>
        )}

        <p aria-live="polite" className="sr-only">
          {pinnedPoint
            ? `${pinnedPoint.model} ${pinnedPoint.effort} configuration pinned.`
            : ""}
        </p>
      </div>
    </section>
  );
};

/**
 * Renders the FrontierCode score-versus-cost chart.
 *
 * The chart maps score to the vertical axis and benchmark cost to the
 * horizontal axis, with the most efficient configurations toward the upper
 * right of the chart.
 *
 * @param props - Visible FrontierCode rows.
 * @returns Interactive FrontierCode comparison visualization.
 */
export const FrontierCodeComparisonChart = ({
  rows,
}: FrontierCodeComparisonChartProps): ReactElement => (
  <FrontierCodeComparisonChartContent rows={rows} />
);
