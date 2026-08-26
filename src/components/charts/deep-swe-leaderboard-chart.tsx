import { ChevronDown } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { CursorModelPrice } from "@/types-and-constants/cursor";
import type {
  DeepSweLeaderboard,
  DeepSweLeaderboardRow,
  DeepSweVersion,
  LeaderboardMetric,
} from "@/types-and-constants/deep-swe";
import { matchLeaderboardRows } from "@/utils/cursor-model-match";
import { formatLongDate } from "@/utils/date";

interface DeepSweLeaderboardChartProps {
  cursorModelPrices?: readonly CursorModelPrice[];
  leaderboard: DeepSweLeaderboard;
  version: DeepSweVersion;
  onVersionChange: (version: DeepSweVersion) => void;
}

interface DeepSweLeaderboardChartContentProps extends DeepSweLeaderboardChartProps {
  metric: LeaderboardMetric;
  onMetricChange: (metric: LeaderboardMetric) => void;
}

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

interface ScatterLinePoint {
  cx?: number;
  cy?: number;
  x?: number;
  y?: number;
}

interface ScatterLineProps {
  points?: ScatterLinePoint[];
}

interface EfficiencyDotProps extends ScatterShapeProps {
  activeConfig: string | null;
  activeModel: string | null;
  color: string;
  metric: LeaderboardMetric;
  pinnedConfig: string | null;
  onHover: (config: string) => void;
  onLeave: () => void;
  onPin: (config: string) => void;
}

interface EfficiencyLineProps extends ScatterLineProps {
  activeModel: string | null;
  color: string;
  hoverConfig: string;
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

interface ConfigModelGroup {
  model: string;
  rows: DeepSweLeaderboardRow[];
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

interface ConfigFilterProps {
  cursorMatchedCount: number;
  cursorMaxMatchedCount: number;
  models: ConfigModelGroup[];
  selectedConfigs: ReadonlySet<string>;
  totalCount: number;
  onSelectCursorModels: () => void;
  onSelectCursorModelsWithMax: () => void;
  onToggleModel: (configs: readonly string[]) => void;
  onToggleLevels: (
    configs: readonly string[],
    selectedConfigs: ReadonlySet<string>,
  ) => void;
  onShowAll: () => void;
  onHideAll: () => void;
}

const VERSION_OPTIONS = [
  { label: "v1.1", value: "v1.1" },
  { label: "v1", value: "v1" },
] as const satisfies readonly ToggleFilterOption<DeepSweVersion>[];

const METRIC_OPTIONS = [
  { label: "Cost", value: "cost" },
  { label: "Output tokens", value: "outputTokens" },
  { label: "Agent steps", value: "agentSteps" },
] as const satisfies readonly ToggleFilterOption<LeaderboardMetric>[];

const REASONING_EFFORT_ORDER = [
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
  "default",
] as const;

const PREFERRED_LABEL_EFFORTS: Readonly<Record<string, string>> = {
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

const PROVIDER_COLORS = {
  anthropic: ["#f97316", "#fb923c", "#ea580c"],
  openai: ["#22c55e", "#4ade80", "#16a34a"],
  google: ["#60a5fa", "#38bdf8", "#2563eb"],
  xai: ["#94a3b8", "#cbd5e1", "#64748b"],
  zhipu: ["#06b6d4", "#22d3ee", "#0891b2"],
  moonshot: ["#f43f5e", "#fb7185", "#e11d48"],
  alibaba: ["#14b8a6", "#2dd4bf", "#0f766e"],
  deepseek: ["#a855f7", "#c084fc", "#7e22ce"],
  meta: ["#3b82f6", "#60a5fa", "#1d4ed8"],
  other: ["#a3a3a3", "#d4d4d4", "#737373"],
} as const;

type ModelProvider = keyof typeof PROVIDER_COLORS;

const chartConfig = {
  score: {
    label: "DeepSWE score",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

const compactNumberFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const modelNameCollator = new Intl.Collator("en-US", {
  numeric: true,
  sensitivity: "base",
});

/**
 * Returns the selected metric from a leaderboard row.
 *
 * @param row - Leaderboard configuration.
 * @param metric - Selected efficiency metric.
 * @returns Metric value or null when unavailable.
 */
const getMetricValue = (
  row: DeepSweLeaderboardRow,
  metric: LeaderboardMetric,
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
 * Returns the axis label for a metric.
 *
 * @param metric - Selected efficiency metric.
 * @returns Human-readable axis label.
 */
const getMetricAxisLabel = (metric: LeaderboardMetric): string => {
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
 * Formats a metric for an axis tick.
 *
 * @param metric - Selected metric.
 * @param value - Numeric metric value.
 * @returns Compact axis value.
 */
const formatMetricTick = (metric: LeaderboardMetric, value: number): string => {
  switch (metric) {
    case "cost":
      return `$${Number.isInteger(value) ? value : value.toFixed(1)}`;

    case "outputTokens":
      return compactNumberFormatter.format(value);

    case "agentSteps":
      return Math.round(value).toString();
  }
};

/**
 * Formats a metric for a tooltip.
 *
 * @param metric - Selected metric.
 * @param value - Numeric metric value.
 * @returns Detailed metric value.
 */
const formatMetricValue = (
  metric: LeaderboardMetric,
  value: number,
): string => {
  switch (metric) {
    case "cost":
      return `$${value.toFixed(2)}`;

    case "outputTokens":
      return `${compactNumberFormatter.format(value)} tokens`;

    case "agentSteps":
      return `${Math.round(value)} steps`;
  }
};

/**
 * Returns the provider family for a model identifier.
 *
 * @param model - DeepSWE model identifier.
 * @returns Provider family key.
 */
const getModelProvider = (model: string): ModelProvider => {
  const normalizedModel = model.toLowerCase();

  if (normalizedModel.startsWith("claude")) {
    return "anthropic";
  }

  if (normalizedModel.startsWith("gpt")) {
    return "openai";
  }

  if (normalizedModel.startsWith("gemini")) {
    return "google";
  }

  if (normalizedModel.startsWith("grok")) {
    return "xai";
  }

  if (normalizedModel.startsWith("glm")) {
    return "zhipu";
  }

  if (normalizedModel.startsWith("kimi")) {
    return "moonshot";
  }

  if (normalizedModel.startsWith("qwen")) {
    return "alibaba";
  }

  if (normalizedModel.startsWith("deepseek")) {
    return "deepseek";
  }

  if (normalizedModel.startsWith("muse")) {
    return "meta";
  }

  return "other";
};

/**
 * Returns a stable palette index for a model identifier.
 *
 * @param model - DeepSWE model identifier.
 * @param paletteSize - Number of available provider shades.
 * @returns Stable zero-based palette index.
 */
const getModelPaletteIndex = (model: string, paletteSize: number): number => {
  let hash = 0;

  for (const character of model) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }

  return hash % paletteSize;
};

/**
 * Returns a stable provider shade for a model.
 *
 * @param model - DeepSWE model identifier.
 * @returns Provider-family color with a stable per-model variant.
 */
const getModelColor = (model: string): string => {
  const palette = PROVIDER_COLORS[getModelProvider(model)];
  const paletteIndex = getModelPaletteIndex(model, palette.length);

  return palette[paletteIndex] ?? palette[0];
};

/**
 * Returns the display label for a row's reasoning effort.
 *
 * @param row - Leaderboard configuration.
 * @returns Reasoning effort label.
 */
const getReasoningEffort = (row: DeepSweLeaderboardRow): string =>
  row.reasoning_effort ?? "default";

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
 * Returns the display and connection order for a reasoning effort.
 *
 * @param effort - Reasoning effort label.
 * @returns Stable numeric effort order.
 */
const getReasoningEffortOrder = (effort: string): number => {
  const index = REASONING_EFFORT_ORDER.indexOf(
    effort.toLowerCase() as (typeof REASONING_EFFORT_ORDER)[number],
  );

  return index === -1 ? REASONING_EFFORT_ORDER.length : index;
};

/**
 * Groups leaderboard configurations by model and orders their levels.
 *
 * @param rows - Available leaderboard configurations.
 * @returns Model groups with their reasoning levels.
 */
const groupRowsByModel = (
  rows: DeepSweLeaderboardRow[],
): ConfigModelGroup[] => {
  const groupedRows = new Map<string, DeepSweLeaderboardRow[]>();

  rows.forEach((row) => {
    const modelRows = groupedRows.get(row.model) ?? [];

    modelRows.push(row);
    groupedRows.set(row.model, modelRows);
  });

  return [...groupedRows.entries()]
    .map(([model, modelRows]) => ({
      model,
      rows: [...modelRows].sort((first, second) => {
        const firstEffort = getReasoningEffort(first);
        const secondEffort = getReasoningEffort(second);
        const firstOrder = getReasoningEffortOrder(firstEffort);
        const secondOrder = getReasoningEffortOrder(secondEffort);

        if (firstOrder !== secondOrder) {
          return firstOrder - secondOrder;
        }

        return firstEffort.localeCompare(secondEffort);
      }),
    }))
    .sort((first, second) => {
      const firstScore = Math.max(...first.rows.map((row) => row.pass_at_1));
      const secondScore = Math.max(...second.rows.map((row) => row.pass_at_1));

      return secondScore - firstScore;
    });
};

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
  rows: DeepSweLeaderboardRow[],
  metric: LeaderboardMetric,
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
      effort: row.reasoning_effort ?? "default",
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
const getScoreMaximum = (series: ChartSeries[]): number => {
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
const getMetricAxis = (series: ChartSeries[]): MetricAxis => {
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
  series: ChartSeries[],
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
  hoverConfig,
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

  return (
    <g
      aria-label={`Inspect ${model}`}
      onBlur={onLeave}
      onClick={(event: ReactMouseEvent<SVGGElement>) => {
        event.stopPropagation();
        onPin(hoverConfig);
      }}
      onFocus={() => onHover(hoverConfig)}
      onKeyDown={(event: ReactKeyboardEvent<SVGGElement>) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onPin(hoverConfig);
        }
      }}
      onMouseEnter={() => onHover(hoverConfig)}
      onMouseLeave={onLeave}
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
 * Renders a single-selection toggle filter.
 *
 * @param props - Toggle filter properties.
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
        key={option.value}
        value={option.value}
        className="min-w-10"
      >
        {option.label}
      </ToggleGroupItem>
    ))}
  </ToggleGroup>
);

/**
 * Renders the configuration selector.
 *
 * @param props - Configuration filter properties.
 * @returns Configuration dropdown.
 */
const ConfigFilter = ({
  cursorMatchedCount,
  cursorMaxMatchedCount,
  models,
  selectedConfigs,
  totalCount,
  onSelectCursorModels,
  onSelectCursorModelsWithMax,
  onToggleModel,
  onToggleLevels,
  onShowAll,
  onHideAll,
}: ConfigFilterProps): ReactElement => (
  <DropdownMenu>
    <DropdownMenuTrigger render={<Button variant="outline" />}>
      Configs{" "}
      <span className="text-muted-foreground">
        ({selectedConfigs.size}/{totalCount})
      </span>
      <ChevronDown aria-hidden data-icon="inline-end" />
    </DropdownMenuTrigger>

    <DropdownMenuContent align="end" className="w-80">
      <DropdownMenuGroup>
        <DropdownMenuLabel>Filter configurations</DropdownMenuLabel>
        <DropdownMenuItem onClick={onShowAll}>Select all</DropdownMenuItem>
        <DropdownMenuItem onClick={onHideAll}>Clear</DropdownMenuItem>
      </DropdownMenuGroup>

      <DropdownMenuSeparator />

      <DropdownMenuGroup>
        <DropdownMenuLabel>Cursor</DropdownMenuLabel>

        <div className="grid gap-2 px-2 pb-2">
          <Button
            aria-label={`Select ${cursorMatchedCount} Cursor models that do not require Max Mode`}
            disabled={cursorMatchedCount === 0}
            onClick={onSelectCursorModels}
            size="sm"
            type="button"
            variant="outline"
          >
            Cursor models
          </Button>

          <Button
            aria-label={`Select Cursor models, including ${cursorMaxMatchedCount} that require Max Mode`}
            disabled={cursorMaxMatchedCount === 0}
            onClick={onSelectCursorModelsWithMax}
            size="sm"
            type="button"
            variant="outline"
          >
            Cursor models{" "}
            <span className="text-muted-foreground">[legacy MAX included]</span>
          </Button>
        </div>
      </DropdownMenuGroup>

      <DropdownMenuSeparator />

      <DropdownMenuGroup className="flex max-h-80 flex-col gap-1 overflow-y-auto">
        <DropdownMenuLabel>Models</DropdownMenuLabel>
        {models.map((modelGroup) => {
          const configIds = modelGroup.rows.map((row) => row.config);
          const selectedLevelIds = configIds.filter((config) =>
            selectedConfigs.has(config),
          );
          const selectedLevelCount = selectedLevelIds.length;
          const totalLevelCount = modelGroup.rows.length;

          return (
            <DropdownMenuItem
              closeOnClick={false}
              className="focus:text-foreground focus:**:text-foreground data-highlighted:text-foreground data-highlighted:**:text-foreground flex-col items-stretch gap-2 p-2 focus:bg-transparent data-highlighted:bg-transparent"
              key={modelGroup.model}
            >
              <div className="flex min-w-0 items-center gap-2">
                <Checkbox
                  aria-label={`Select all ${modelGroup.model} levels`}
                  checked={selectedLevelCount === totalLevelCount}
                  indeterminate={
                    selectedLevelCount > 0 &&
                    selectedLevelCount < totalLevelCount
                  }
                  onCheckedChange={() => onToggleModel(configIds)}
                />

                <span className="min-w-0 flex-1 truncate font-medium">
                  {modelGroup.model}
                </span>

                <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                  {selectedLevelCount}/{totalLevelCount}
                </span>
              </div>

              <ToggleGroup
                aria-label={`${modelGroup.model} reasoning levels`}
                className="ml-6 max-w-full flex-wrap"
                onValueChange={(values) =>
                  onToggleLevels(configIds, new Set(values))
                }
                size="sm"
                spacing={0}
                value={selectedLevelIds}
                multiple
                variant="outline"
              >
                {modelGroup.rows.map((row) => {
                  const effort = getReasoningEffort(row);

                  return (
                    <ToggleGroupItem
                      aria-label={`${modelGroup.model} ${effort} reasoning level`}
                      key={row.config}
                      pressed={selectedLevelIds.includes(row.config)}
                      size="sm"
                      title={[
                        effort.toUpperCase(),
                        row.mean_cost_usd === null
                          ? null
                          : formatMetricValue("cost", row.mean_cost_usd),
                        `${(row.pass_at_1 * 100).toFixed(0)}%`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                      value={row.config}
                    >
                      {effort}
                    </ToggleGroupItem>
                  );
                })}
              </ToggleGroup>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuGroup>
    </DropdownMenuContent>
  </DropdownMenu>
);

/**
 * Renders the stateful DeepSWE efficiency leaderboard content.
 *
 * @param props - Leaderboard chart properties and selected metric.
 * @returns Filterable connected scatter chart.
 */
const DeepSweLeaderboardChartContent = ({
  leaderboard,
  metric,
  version,
  onMetricChange,
  onVersionChange,
  cursorModelPrices,
}: DeepSweLeaderboardChartContentProps): ReactElement => {
  const matchedRows = useMemo(
    () =>
      matchLeaderboardRows(
        leaderboard.rows,
        cursorModelPrices ?? [],
        (cursorModel) => cursorModel.model,
      ),
    [leaderboard.rows, cursorModelPrices],
  );

  const cursorFilterConfigs = useMemo(() => {
    const cursorConfigs = new Set<string>();
    const cursorMaxIncludedConfigs = new Set<string>();
    const cursorModels = new Set<string>();
    const cursorMaxModels = new Set<string>();

    matchedRows.forEach((row) => {
      if (row.cursorMatch === null) {
        return;
      }

      cursorMaxIncludedConfigs.add(row.config);

      if (row.cursorMatch.cursorModel.requiresLegacyMaxMode) {
        cursorMaxModels.add(row.model);
        return;
      }

      cursorConfigs.add(row.config);
      cursorModels.add(row.model);
    });

    return {
      cursorConfigs,
      cursorMatchedCount: cursorModels.size,
      cursorMaxIncludedConfigs,
      cursorMaxMatchedCount: cursorMaxModels.size,
    };
  }, [matchedRows]);

  const [excludedConfigs, setExcludedConfigs] = useState<Set<string>>(
    () => new Set(),
  );
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

  const selectedConfigs = useMemo(
    () =>
      new Set(
        matchedRows
          .filter((row) => !excludedConfigs.has(row.config))
          .map((row) => row.config),
      ),
    [matchedRows, excludedConfigs],
  );

  const configModels = useMemo(
    () =>
      [...groupRowsByModel(matchedRows)].sort((first, second) =>
        modelNameCollator.compare(first.model, second.model),
      ),
    [matchedRows],
  );

  const visibleRows = useMemo(
    () => matchedRows.filter((row) => selectedConfigs.has(row.config)),
    [matchedRows, selectedConfigs],
  );

  const series = useMemo(
    () => createChartSeries(visibleRows, metric),
    [visibleRows, metric],
  );

  const lastJobDate = formatLongDate(leaderboard.latest_job?.finished_at);
  const scoreMaximum = getScoreMaximum(series);
  const scoreTicks = createScoreTicks(scoreMaximum);
  const metricAxis = getMetricAxis(series);
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

  /**
   * Selects or hides every level belonging to a model.
   *
   * @param configs - Configuration identifiers belonging to the model.
   */
  const handleModelToggle = (configs: readonly string[]): void => {
    const shouldShowAll = configs.some(
      (config) => !selectedConfigs.has(config),
    );
    const nextSelectedConfigs = new Set(selectedConfigs);

    configs.forEach((config) => {
      if (shouldShowAll) {
        nextSelectedConfigs.add(config);
      } else {
        nextSelectedConfigs.delete(config);
      }
    });

    if (pinnedConfig !== null && !nextSelectedConfigs.has(pinnedConfig)) {
      setPinnedConfig(null);
    }

    setExcludedConfigs((current) => {
      const next = new Set(current);

      configs.forEach((config) => {
        if (shouldShowAll) {
          next.delete(config);
        } else {
          next.add(config);
        }
      });

      return next;
    });
  };

  /**
   * Applies a model's selected reasoning levels.
   *
   * @param configs - Configuration identifiers belonging to the model.
   * @param nextSelectedConfigs - Configuration identifiers selected in the group.
   */
  const handleLevelsToggle = (
    configs: readonly string[],
    nextSelectedConfigs: ReadonlySet<string>,
  ): void => {
    const nextVisibleConfigs = new Set(selectedConfigs);

    configs.forEach((config) => {
      if (nextSelectedConfigs.has(config)) {
        nextVisibleConfigs.add(config);
      } else {
        nextVisibleConfigs.delete(config);
      }
    });

    if (pinnedConfig !== null && !nextVisibleConfigs.has(pinnedConfig)) {
      setPinnedConfig(null);
    }

    setExcludedConfigs((current) => {
      const next = new Set(current);

      configs.forEach((config) => {
        if (nextSelectedConfigs.has(config)) {
          next.delete(config);
        } else {
          next.add(config);
        }
      });

      return next;
    });
  };

  /**
   * Selects every currently available configuration.
   */
  const handleShowAll = (): void => {
    setExcludedConfigs((current) => {
      const next = new Set(current);

      matchedRows.forEach((row) => {
        next.delete(row.config);
      });

      return next;
    });
  };

  /**
   * Hides every currently available configuration.
   */
  const handleHideAll = (): void => {
    setPinnedConfig(null);

    setExcludedConfigs((current) => {
      const next = new Set(current);

      matchedRows.forEach((row) => {
        next.add(row.config);
      });

      return next;
    });
  };

  /**
   * Replaces the current configuration selection with an exact set.
   *
   * @param configs - Configuration identifiers to keep visible.
   */
  const handleSelectConfigs = (configs: ReadonlySet<string>): void => {
    setHoveredConfig(null);
    setPinnedConfig(null);
    setExcludedConfigs(
      new Set(
        matchedRows
          .filter((row) => !configs.has(row.config))
          .map((row) => row.config),
      ),
    );
  };

  /**
   * Selects matched Cursor models that do not require Max Mode.
   */
  const handleSelectCursorModels = (): void => {
    handleSelectConfigs(cursorFilterConfigs.cursorConfigs);
  };

  /**
   * Selects every matched Cursor model, including Max Mode models.
   */
  const handleSelectCursorModelsWithMax = (): void => {
    handleSelectConfigs(cursorFilterConfigs.cursorMaxIncludedConfigs);
  };

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
   * Changes the horizontal-axis metric and clears selections that are no
   * longer represented by the new metric.
   *
   * @param nextMetric - Metric to display.
   */
  const handleMetricChange = (nextMetric: LeaderboardMetric): void => {
    const nextSeries = createChartSeries(visibleRows, nextMetric);

    if (
      pinnedConfig !== null &&
      findChartPoint(nextSeries, pinnedConfig) === null
    ) {
      setPinnedConfig(null);
    }

    if (
      hoveredConfig !== null &&
      findChartPoint(nextSeries, hoveredConfig) === null
    ) {
      setHoveredConfig(null);
    }

    onMetricChange(nextMetric);
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
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <ToggleFilter
          label="Benchmark version"
          onChange={onVersionChange}
          options={VERSION_OPTIONS}
          value={version}
        />

        <ToggleFilter
          label="Efficiency metric"
          onChange={handleMetricChange}
          options={METRIC_OPTIONS}
          value={metric}
        />

        <span className="hidden flex-1 items-center justify-end gap-1 text-sm md:flex">
          <span className="hidden lg:block">Last job executed on</span>
          {lastJobDate}
        </span>

        <div className="ml-auto flex items-center gap-2">
          {pinnedPoint ? (
            <Button onClick={handleClearPin} size="sm" variant="ghost">
              Clear pinned
            </Button>
          ) : null}

          <ConfigFilter
            cursorMatchedCount={cursorFilterConfigs.cursorMatchedCount}
            cursorMaxMatchedCount={cursorFilterConfigs.cursorMaxMatchedCount}
            onHideAll={handleHideAll}
            onSelectCursorModels={handleSelectCursorModels}
            onSelectCursorModelsWithMax={handleSelectCursorModelsWithMax}
            onToggleLevels={handleLevelsToggle}
            onToggleModel={handleModelToggle}
            onShowAll={handleShowAll}
            models={configModels}
            selectedConfigs={selectedConfigs}
            totalCount={matchedRows.length}
          />
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
                      hoverConfig={item.labelConfig}
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
                      pinnedConfig={pinnedConfig}
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
 * Renders the DeepSWE efficiency leaderboard.
 *
 * The stateful chart content is keyed by benchmark version so version changes
 * reset filters and chart selections without synchronously updating state in
 * an effect. The selected metric remains preserved across versions.
 *
 * @param props - Leaderboard chart properties.
 * @returns Filterable connected scatter chart.
 */
export const DeepSweLeaderboardChart = ({
  leaderboard,
  version,
  onVersionChange,
  cursorModelPrices,
}: DeepSweLeaderboardChartProps): ReactElement => {
  const [metric, setMetric] = useState<LeaderboardMetric>("cost");

  return (
    <DeepSweLeaderboardChartContent
      key={version}
      cursorModelPrices={cursorModelPrices}
      leaderboard={leaderboard}
      metric={metric}
      onMetricChange={setMetric}
      onVersionChange={onVersionChange}
      version={version}
    />
  );
};
