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
import type {
  DeepSweLeaderboard,
  DeepSweLeaderboardRow,
  DeepSweReasoningEffort,
  DeepSweVersion,
  EfficiencyMetric,
} from "@/types-and-constants/deep-swe";
import { getNearestLineConfig, type ScatterLinePoint } from "@/utils/chart";
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
  label: string;
  score: number;
  metricValue: number;
}

interface ChartSeries {
  model: string;
  color: string;
  labelConfig: string;
  points: ChartPoint[];
}

interface MetricAxis {
  maximum: number;
  ticks: number[];
}

interface ScatterShapeProps {
  cx?: number;
  cy?: number;
  payload?: ChartPoint;
}

interface ScatterLineProps {
  points?: ScatterLinePoint[];
}

interface EfficiencyDotProps extends ScatterShapeProps {
  activeConfig: string | null;
  activeModel: string | null;
  color: string;
  metric: EfficiencyMetric;
  pinnedConfig: string | null;
  onHover: (config: string) => void;
  onLeave: () => void;
  onPin: (config: string) => void;
}

interface EfficiencyLineProps extends ScatterLineProps {
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

interface EfficiencyLabelProps extends LabelContentProps {
  activeModel: string | null;
  color: string;
  model: string;
  onHover: (config: string) => void;
  onLeave: () => void;
  onPin: (config: string) => void;
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

const chartConfig = {
  score: {
    label: "DeepSWE score",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

/**
 * Normalizes a model identifier for stable configuration lookups.
 *
 * @param model - Model identifier or display name.
 * @returns Lowercase dash-delimited identifier.
 */
const normalizeModelIdentifier = (model: string): string =>
  model
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/**
 * Converts leaderboard rows into model chart series.
 *
 * Each series connects the different reasoning-effort configurations
 * belonging to the same model.
 *
 * @param rows - Visible leaderboard configurations.
 * @param metric - Selected efficiency metric.
 * @returns Chart series grouped by model.
 */
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
      metricValue <= 0
    ) {
      return;
    }

    const points = groupedPoints.get(row.model) ?? [];

    points.push({
      config: row.config,
      model: row.model,
      effort: getReasoningEffort(row),
      isLabelAnchor: false,
      label: "",
      score: row.pass_at_1 * 100,
      metricValue,
    });

    groupedPoints.set(row.model, points);
  });

  return [...groupedPoints.entries()]
    .map(([model, unsortedPoints]) => {
      const points = [...unsortedPoints].sort((first, second) => {
        const effortDifference =
          getReasoningEffortOrder(first.effort) -
          getReasoningEffortOrder(second.effort);

        return effortDifference || first.metricValue - second.metricValue;
      });
      const preferredEffort =
        PREFERRED_LABEL_EFFORTS[normalizeModelIdentifier(model)];
      const labelPoint =
        points.find(
          (point) => point.effort.toLowerCase() === preferredEffort,
        ) ?? points[points.length - 1];

      return {
        model,
        color: getModelColor(model),
        labelConfig: labelPoint.config,
        points: points.map((point) => ({
          ...point,
          isLabelAnchor: point.config === labelPoint.config,
          label: point.config === labelPoint.config ? point.model : "",
        })),
      };
    })
    .sort((first, second) => {
      const firstScore = Math.max(...first.points.map((point) => point.score));

      const secondScore = Math.max(
        ...second.points.map((point) => point.score),
      );

      return secondScore - firstScore;
    });
};

/**
 * Calculates the maximum score shown by the vertical axis.
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
 * Creates score ticks from zero through the score-domain maximum.
 *
 * @param maximum - Score-domain maximum.
 * @returns Percentage tick values.
 */
const createScoreTicks = (maximum: number): number[] =>
  Array.from(
    { length: maximum / SCORE_TICK_STEP + 1 },
    (_, index) => index * SCORE_TICK_STEP,
  );

/**
 * Calculates a readable tick interval for a positive numeric domain.
 *
 * @param maximum - Padded axis maximum.
 * @param targetTickCount - Approximate number of tick intervals.
 * @returns A 2/5/10-based tick step.
 */
const getNiceTickStep = (maximum: number, targetTickCount: number): number => {
  if (maximum <= 0) {
    return 1;
  }

  const rawStep = maximum / targetTickCount;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalizedStep = rawStep / magnitude;

  if (normalizedStep >= 5) {
    return 10 * magnitude;
  }

  if (normalizedStep >= 2) {
    return 5 * magnitude;
  }

  return 2 * magnitude;
};

/**
 * Calculates the padded metric domain and its readable tick values.
 *
 * @param series - Visible chart series.
 * @returns Reversed X-axis maximum and ticks.
 */
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

/**
 * Finds a configuration point among visible chart series.
 *
 * @param series - Visible chart series.
 * @param config - Configuration identifier.
 * @returns Matching point or null.
 */
const findChartPoint = (
  series: readonly ChartSeries[],
  config: string | null,
): ChartPoint | null => {
  if (config === null) {
    return null;
  }

  for (const item of series) {
    const point = item.points.find((candidate) => candidate.config === config);

    if (point) {
      return point;
    }
  }

  return null;
};

/**
 * Returns the focus treatment for a chart mark.
 *
 * @param model - Mark model identifier.
 * @param activeModel - Currently focused model identifier.
 * @returns Animated opacity and saturation styles.
 */
const getModelFocusStyle = (
  model: string,
  activeModel: string | null,
): CSSProperties => {
  const isMuted = activeModel !== null && activeModel !== model;

  return {
    opacity: isMuted ? 0.55 : 1,
    filter: isMuted ? "grayscale(1)" : "none",
    transition: "opacity 150ms ease, filter 150ms ease",
  };
};

/**
 * Renders a chart point with a generous hit target and keyboard interaction.
 *
 * @param props - Recharts point geometry and interaction state.
 * @returns Interactive SVG point.
 */
const EfficiencyDot = ({
  activeConfig,
  activeModel,
  color,
  cx,
  cy,
  metric,
  onHover,
  onLeave,
  onPin,
  payload,
  pinnedConfig,
}: EfficiencyDotProps): ReactElement => {
  if (cx === undefined || cy === undefined || payload === undefined) {
    return <g />;
  }

  const isActive = activeConfig === payload.config;
  const isPinned = pinnedConfig === payload.config;
  const pointColor = payload.isLabelAnchor
    ? color
    : `color-mix(in oklab, ${color} 84%, var(--card))`;
  const accessibleLabel = `${payload.model}, ${payload.effort} effort, ${Math.round(payload.score)}% score, ${formatMetricValue(metric, payload.metricValue)}`;

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
        fill={pointColor}
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
 * Renders a connected series with a wide invisible pointer target.
 *
 * @param props - Recharts line geometry and model interaction state.
 * @returns Interactive SVG series line.
 */
const EfficiencyLine = ({
  activeModel,
  color,
  configurations,
  fallbackConfig,
  model,
  onHover,
  onLeave,
  onPin,
  points,
}: EfficiencyLineProps): ReactElement => {
  const path = (points ?? []).reduce<string>((result, point) => {
    const pointX = point.x ?? point.cx;
    const pointY = point.y ?? point.cy;

    if (!Number.isFinite(pointX) || !Number.isFinite(pointY)) {
      return result;
    }

    return `${result}${result ? " L" : "M"} ${pointX} ${pointY}`;
  }, "");

  if (!path) {
    return <g />;
  }

  const lineColor = `color-mix(in oklab, ${color} 84%, var(--card))`;

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
        stroke={lineColor}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2.5}
        style={getModelFocusStyle(model, activeModel)}
      />
    </g>
  );
};

/**
 * Renders a model name and its chosen reasoning-effort anchor.
 *
 * @param props - Recharts label geometry and model interaction state.
 * @returns Interactive two-line SVG label.
 */
const EfficiencyLabel = ({
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
}: EfficiencyLabelProps): ReactElement | null => {
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
 * Renders the stateful DeepSWE efficiency-chart content.
 *
 * @param props - Filtered rows, metric state, and leaderboard metadata.
 * @returns Interactive connected scatter chart.
 */
const DeepSweEfficiencyChartContent = ({
  leaderboard,
  metric,
  rows,
}: DeepSweEfficiencyChartContentProps): ReactElement => {
  const [hoveredConfig, setHoveredConfig] = useState<string | null>(null);
  const [pinnedConfig, setPinnedConfig] = useState<string | null>(null);

  useEffect(() => {
    if (pinnedConfig !== null) {
      const handleEscape = (event: KeyboardEvent): void => {
        if (event.key === "Escape") {
          setHoveredConfig(null);
          setPinnedConfig(null);
        }
      };

      window.addEventListener("keydown", handleEscape);

      return () => window.removeEventListener("keydown", handleEscape);
    }

    return undefined;
  }, [pinnedConfig]);

  const series = useMemo(() => createChartSeries(rows, metric), [metric, rows]);

  const lastJobDate = formatLongDate(
    leaderboard.latest_job?.finished_at ?? leaderboard.generated_at,
  );
  const scoreMaximum = getScoreMaximum(series);
  const scoreTicks = createScoreTicks(scoreMaximum);
  const metricAxis = getMetricAxis(series);
  const hoveredPoint = findChartPoint(series, hoveredConfig);
  const pinnedPoint = findChartPoint(series, pinnedConfig);
  const visiblePinnedConfig = pinnedPoint?.config ?? null;
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

  /**
   * Focuses an exact chart configuration.
   *
   * @param config - Configuration identifier.
   */
  const handlePointHover = (config: string): void => {
    setHoveredConfig(config);
  };

  /**
   * Clears transient chart focus while preserving a pin.
   */
  const handlePointLeave = (): void => {
    setHoveredConfig(null);
  };

  /**
   * Toggles a persistent chart configuration selection.
   *
   * @param config - Configuration identifier.
   */
  const handlePointPin = (config: string): void => {
    setHoveredConfig(null);
    setPinnedConfig((current) => (current === config ? null : config));
  };

  /**
   * Clears the persistent chart selection.
   */
  const handleClearPin = (): void => {
    setHoveredConfig(null);
    setPinnedConfig(null);
  };

  /**
   * Formats the selected metric for the horizontal axis.
   *
   * @param value - Axis value.
   * @returns Formatted tick.
   */
  const formatXAxisTick = (value: number): string =>
    formatMetricTick(metric, value);

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

        <div className="flex flex-wrap items-center gap-3">
          {lastJobDate && (
            <span className="text-muted-foreground hidden items-center gap-1 text-sm md:flex">
              <span className="hidden lg:block">Last job executed on</span>
              {lastJobDate}
            </span>
          )}

          {pinnedPoint ? (
            <Button onClick={handleClearPin} size="sm" variant="ghost">
              Clear pinned
            </Button>
          ) : null}
        </div>
      </div>

      <div className="bg-card relative rounded-md border">
        <div className="text-muted-foreground pointer-events-none absolute top-4 right-5 z-10 text-xs italic">
          most efficient ↗
        </div>

        {series.length === 0 ? (
          <div className="text-muted-foreground flex h-110 items-center justify-center px-6 text-center text-sm">
            No data is available for the selected configurations and metric.
          </div>
        ) : (
          <ChartContainer
            className="aspect-auto h-[clamp(440px,62vw,680px)] w-full"
            config={chartConfig}
          >
            <ScatterChart
              accessibilityLayer
              margin={{
                top: 56,
                right: 76,
                bottom: 52,
                left: 20,
              }}
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
                dataKey="metricValue"
                domain={[0, metricAxis.maximum]}
                interval="preserveStartEnd"
                label={{
                  value: getMetricAxisLabel(metric),
                  position: "insideBottom",
                  offset: -30,
                }}
                reversed
                ticks={metricAxis.ticks}
                tickFormatter={formatXAxisTick}
                tickLine={false}
                type="number"
              />

              <YAxis
                axisLine={false}
                dataKey="score"
                domain={[0, scoreMaximum]}
                label={{
                  value: "DeepSWE score",
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
                      value: formatMetricTick(metric, activePoint.metricValue),
                    }}
                    stroke={activeColor}
                    strokeDasharray="4 4"
                    strokeOpacity={0.8}
                    x={activePoint.metricValue}
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
                    <EfficiencyLine
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
                    <EfficiencyDot
                      {...(shapeProps as ScatterShapeProps)}
                      activeConfig={activePoint?.config ?? null}
                      activeModel={activeModel}
                      color={item.color}
                      metric={metric}
                      onHover={handlePointHover}
                      onLeave={handlePointLeave}
                      onPin={handlePointPin}
                      pinnedConfig={visiblePinnedConfig}
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
                        <EfficiencyLabel
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
 * Renders the DeepSWE efficiency chart.
 *
 * The stateful content is keyed by benchmark version and metric so changes
 * reset chart focus. The parent dashboard owns configuration filtering and
 * metric selection.
 *
 * @param props - Filtered leaderboard rows, metadata, and benchmark version.
 * @returns Interactive connected scatter chart.
 */
export const DeepSweEfficiencyChart = ({
  leaderboard,
  metric,
  rows,
  version,
}: DeepSweEfficiencyChartProps): ReactElement => {
  return (
    <DeepSweEfficiencyChartContent
      key={`${version}-${metric}`}
      leaderboard={leaderboard}
      metric={metric}
      rows={rows}
    />
  );
};
