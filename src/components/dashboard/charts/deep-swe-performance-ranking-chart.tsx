import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { type ReactElement, useCallback, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
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
type SortDirection = false | "asc" | "desc";

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

interface SortableHeaderProps {
  align?: "left" | "right";
  column: {
    getIsSorted: () => SortDirection;
    getNextSortingOrder: () => SortDirection;
    toggleSorting: (descending?: boolean) => void;
  };
  label: string;
}

interface ScoreBarProps {
  axisMaximum: number;
  row: DeepSweLeaderboardRow;
}

interface ScoreAxisProps {
  maximum: number;
  ticks: readonly number[];
}

const RANKING_MODE_OPTIONS = [
  { label: "Best", value: "best" },
  { label: "All effort levels", value: "all" },
] as const satisfies readonly ToggleFilterOption<RankingMode>[];

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
const tableFeaturesConfig = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
});
const columnHelper = createColumnHelper<
  typeof tableFeaturesConfig,
  DeepSweLeaderboardRow
>();

/**
 * Returns a sortable rank for a reasoning-effort label.
 *
 * @param effort - Reasoning-effort label.
 * @returns Numeric rank, with higher values representing higher effort.
 */
const getReasoningEffortRank = (effort: string): number =>
  REASONING_EFFORT_RANK[effort.toLowerCase()] ?? -1;

/** Chooses the highest available reasoning-effort configuration for a model. */
const getBestEffortRow = (
  rows: readonly DeepSweLeaderboardRow[],
): DeepSweLeaderboardRow =>
  rows.reduce((bestRow, row) => {
    const effortDifference =
      getReasoningEffortRank(getReasoningEffort(row)) -
      getReasoningEffortRank(getReasoningEffort(bestRow));

    if (effortDifference > 0) return row;
    if (effortDifference === 0 && row.pass_at_1 > bestRow.pass_at_1) {
      return row;
    }

    return bestRow;
  });

/** Groups leaderboard rows by model and orders them by their default score. */
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

/** Orders configurations by Pass@1 with stable model and effort tie-breakers. */
const compareByPerformance = (
  first: DeepSweLeaderboardRow,
  second: DeepSweLeaderboardRow,
): number =>
  second.pass_at_1 - first.pass_at_1 ||
  compareModelNames(first.model, second.model) ||
  getReasoningEffortRank(getReasoningEffort(second)) -
    getReasoningEffortRank(getReasoningEffort(first));

/** Calculates the shared score-axis maximum for visible rows. */
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

/** Creates evenly spaced percentage ticks for the score footer. */
const createScoreTicks = (maximum: number): number[] =>
  Array.from(
    { length: Math.floor(maximum / SCORE_TICK_STEP) + 1 },
    (_, index) => index * SCORE_TICK_STEP,
  );

/** Converts a fractional score into a clamped percentage of the shared axis. */
const getAxisPosition = (value: number, axisMaximum: number): number =>
  Math.min(100, Math.max(0, (value * 100 * 100) / axisMaximum));

/** Returns the semantic aria-sort value for a TanStack sorting direction. */
const getAriaSort = (
  direction: SortDirection,
): "ascending" | "descending" | "none" => {
  if (direction === "asc") return "ascending";
  if (direction === "desc") return "descending";
  return "none";
};

/** Renders the retained Best/All ranking-detail control. */
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

/** Renders a two-state sortable table header. */
const SortableHeader = ({
  align = "left",
  column,
  label,
}: SortableHeaderProps): ReactElement => {
  const direction = column.getIsSorted();
  const nextDirection = column.getNextSortingOrder();
  const SortIcon =
    direction === "asc"
      ? ArrowUp
      : direction === "desc"
        ? ArrowDown
        : ChevronsUpDown;

  return (
    <Button
      aria-label={`Sort ${label} ${nextDirection === "desc" ? "descending" : "ascending"}`}
      className={cn("h-8 px-2", align === "right" && "ml-auto")}
      onClick={() => column.toggleSorting()}
      size="sm"
      type="button"
      variant="ghost"
    >
      {label}
      <SortIcon data-icon="inline-end" />
    </Button>
  );
};

/** Renders a score bar with its confidence-interval whisker. */
const ScoreBar = ({ axisMaximum, row }: ScoreBarProps): ReactElement => {
  const confidenceBounds = getConfidenceBounds(row);
  const scorePosition = getAxisPosition(row.pass_at_1, axisMaximum);
  const confidenceStart = getAxisPosition(confidenceBounds.lower, axisMaximum);
  const confidenceEnd = getAxisPosition(confidenceBounds.upper, axisMaximum);
  const color = getModelColor(row.model);

  return (
    <div aria-hidden="true" className="relative h-5 min-w-36 flex-1">
      <div className="bg-muted/50 absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-sm" />
      <div
        className="absolute top-1/2 left-0 h-2 -translate-y-1/2 rounded-sm transition-[width] duration-200"
        style={{ backgroundColor: color, width: `${scorePosition}%` }}
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
        style={{ backgroundColor: color, left: `${scorePosition}%` }}
      />
    </div>
  );
};

/** Renders the percentage guide beneath the score column. */
const ScoreAxis = ({ maximum, ticks }: ScoreAxisProps): ReactElement => (
  <div className="relative h-5 min-w-36 flex-1">
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
);

/**
 * Renders the DeepSWE performance ranking as a sortable semantic table.
 *
 * The table starts sorted by Pass@1 descending and keeps one active sort
 * column. Every header remains available through horizontal mobile scrolling.
 *
 * @param props - Filtered rows and optional configuration-selection callback.
 * @returns Interactive DeepSWE ranking table.
 */
export const DeepSwePerformanceRankingChart = ({
  onConfigSelect,
  rows,
}: DeepSwePerformanceRankingChartProps): ReactElement => {
  const modelGroups = useMemo(() => groupRowsByModel(rows), [rows]);
  const [rankingMode, setRankingMode] = useState<RankingMode>("best");
  const [selectedConfig, setSelectedConfig] = useState<string | null>(null);
  const visibleRows = useMemo(
    () =>
      modelGroups
        .flatMap((group) =>
          rankingMode === "best" ? [group.bestRow] : group.rows,
        )
        .sort(compareByPerformance),
    [modelGroups, rankingMode],
  );
  const activeSelectedConfig =
    selectedConfig !== null &&
    visibleRows.some((row) => row.config === selectedConfig)
      ? selectedConfig
      : null;
  const scoreAxisMaximum = getScoreAxisMaximum(visibleRows);
  const scoreTicks = createScoreTicks(scoreAxisMaximum);

  const handleConfigSelect = useCallback(
    (config: string): void => {
      const nextConfig = activeSelectedConfig === config ? null : config;
      setSelectedConfig(nextConfig);
      onConfigSelect?.(nextConfig);
    },
    [activeSelectedConfig, onConfigSelect],
  );

  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor("model", {
          header: ({ column }) => (
            <SortableHeader column={column} label="Model" />
          ),
          sortDescFirst: false,
          sortFn: (first, second) =>
            compareModelNames(first.original.model, second.original.model) ||
            getReasoningEffortRank(getReasoningEffort(first.original)) -
              getReasoningEffortRank(getReasoningEffort(second.original)),
          cell: ({ row }) => {
            const item = row.original;
            const effort = getReasoningEffort(item);

            return (
              <Button
                aria-label={`Select ${item.model}, ${effort} effort`}
                aria-pressed={activeSelectedConfig === item.config}
                className="h-auto max-w-64 justify-start px-2 py-1 text-left"
                onClick={() => handleConfigSelect(item.config)}
                title={`${item.model} · ${effort}`}
                type="button"
                variant="ghost"
              >
                <span
                  aria-hidden="true"
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: getModelColor(item.model) }}
                />
                <span className="truncate font-medium">{item.model}</span>
                <Badge
                  className="shrink-0 font-mono text-[10px]"
                  variant="outline"
                >
                  {effort.toUpperCase()}
                </Badge>
              </Button>
            );
          },
        }),
        columnHelper.accessor("pass_at_1", {
          id: "score",
          header: ({ column }) => (
            <SortableHeader column={column} label="Pass@1" />
          ),
          sortDescFirst: true,
          cell: ({ row }) => (
            <div className="flex min-w-64 items-center gap-3">
              <ScoreBar axisMaximum={scoreAxisMaximum} row={row.original} />
              <div className="w-16 text-right tabular-nums">
                <div className="font-medium">
                  {formatScore(row.original.pass_at_1)}
                </div>
                <div className="text-muted-foreground text-[10px]">
                  {formatConfidence(row.original)}
                </div>
              </div>
            </div>
          ),
        }),
        columnHelper.accessor(
          (row) =>
            row.mean_cost_usd !== null && Number.isFinite(row.mean_cost_usd)
              ? row.mean_cost_usd
              : undefined,
          {
            id: "cost",
            header: ({ column }) => (
              <SortableHeader align="right" column={column} label="Avg cost" />
            ),
            sortDescFirst: true,
            sortUndefined: "last",
            cell: ({ row }) => (
              <span className="block text-right tabular-nums">
                {formatCost(row.original.mean_cost_usd)}
              </span>
            ),
          },
        ),
        columnHelper.accessor((row) => getCostEfficiency(row) ?? undefined, {
          id: "efficiency",
          header: ({ column }) => (
            <SortableHeader align="right" column={column} label="Efficiency" />
          ),
          sortDescFirst: true,
          sortUndefined: "last",
          cell: ({ row }) => (
            <span className="block text-right tabular-nums">
              {formatCostEfficiency(getCostEfficiency(row.original))}
            </span>
          ),
        }),
        columnHelper.accessor(
          (row) =>
            row.mean_output_tokens !== null &&
            Number.isFinite(row.mean_output_tokens)
              ? row.mean_output_tokens
              : undefined,
          {
            id: "outputTokens",
            header: ({ column }) => (
              <SortableHeader align="right" column={column} label="Out tok" />
            ),
            sortDescFirst: true,
            sortUndefined: "last",
            cell: ({ row }) => (
              <span className="block text-right tabular-nums">
                {formatCompactNumber(row.original.mean_output_tokens)}
              </span>
            ),
          },
        ),
        columnHelper.accessor(
          (row) =>
            row.mean_agent_steps !== null &&
            Number.isFinite(row.mean_agent_steps)
              ? row.mean_agent_steps
              : undefined,
          {
            id: "steps",
            header: ({ column }) => (
              <SortableHeader align="right" column={column} label="Steps" />
            ),
            sortDescFirst: true,
            sortUndefined: "last",
            cell: ({ row }) => (
              <span className="block text-right tabular-nums">
                {formatCompactNumber(row.original.mean_agent_steps)}
              </span>
            ),
          },
        ),
      ]),
    [activeSelectedConfig, handleConfigSelect, scoreAxisMaximum],
  );

  const table = useTable({
    columns,
    data: visibleRows,
    enableMultiSort: false,
    enableSortingRemoval: false,
    features: tableFeaturesConfig,
    getRowId: (row) => row.config,
    initialState: { sorting: [{ id: "score", desc: true }] },
  });

  const handleRankingModeChange = (nextMode: RankingMode): void => {
    setRankingMode(nextMode);
    setSelectedConfig(null);
    onConfigSelect?.(null);
  };

  return (
    <section
      aria-labelledby="model-ranking-title"
      className="flex flex-col gap-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3
          className="text-lg leading-tight font-semibold tracking-tight"
          id="model-ranking-title"
        >
          Model ranking
        </h3>
        <ToggleFilter
          label="Ranking detail"
          onChange={handleRankingModeChange}
          options={RANKING_MODE_OPTIONS}
          value={rankingMode}
        />
      </div>

      <div className="border-border bg-card rounded-md border">
        <Table className="min-w-5xl">
          <TableCaption className="sr-only">
            DeepSWE configurations. Activate a column header to change the sort.
          </TableCaption>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    aria-sort={getAriaSort(header.column.getIsSorted())}
                    key={header.id}
                  >
                    {header.isPlaceholder ? null : (
                      <table.FlexRender header={header} />
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  className="text-muted-foreground h-36 text-center"
                  colSpan={columns.length}
                >
                  No configurations are selected.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  data-state={
                    activeSelectedConfig === row.original.config
                      ? "selected"
                      : undefined
                  }
                  key={row.id}
                >
                  {row.getAllCells().map((cell) => (
                    <TableCell key={cell.id}>
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
          {table.getRowModel().rows.length > 0 ? (
            <TableFooter>
              <TableRow>
                <TableCell />
                <TableCell>
                  <div className="flex min-w-64 gap-3">
                    <ScoreAxis maximum={scoreAxisMaximum} ticks={scoreTicks} />
                    <div className="w-16" />
                  </div>
                </TableCell>
                <TableCell colSpan={4} />
              </TableRow>
            </TableFooter>
          ) : null}
        </Table>
      </div>
    </section>
  );
};
