import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { type ReactElement, useCallback, useMemo, useState } from "react";

import { ScoreAxis } from "@/components/dashboard/charts/score-axis";
import { ScoreBar } from "@/components/dashboard/charts/score-bar";
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
import type {
  FrontierCodeLeaderboardRow,
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

type SortDirection = false | "asc" | "desc";

/** Public properties for the FrontierCode performance ranking. */
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

interface SortableHeaderProps {
  align?: "left" | "right";
  column: {
    getIsSorted: () => SortDirection;
    getNextSortingOrder: () => SortDirection;
    toggleSorting: (descending?: boolean) => void;
  };
  label: string;
}

const RANKING_MODE_OPTIONS = [
  { label: "Best", value: "best" },
  { label: "All effort levels", value: "all" },
] as const satisfies readonly ToggleFilterOption<FrontierCodeRankingMode>[];
const SCORE_TICK_STEP = 20;
const MINIMUM_SCORE_AXIS_MAXIMUM = 80;
const tableFeaturesConfig = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
});
const columnHelper = createColumnHelper<
  typeof tableFeaturesConfig,
  FrontierCodeLeaderboardRow
>();

/** Groups rows by model and selects the highest-scoring configuration. */
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

/** Orders rows by score with deterministic model and effort tie-breakers. */
const compareByScore = (
  first: FrontierCodeLeaderboardRow,
  second: FrontierCodeLeaderboardRow,
): number =>
  second.score - first.score ||
  compareFrontierCodeModelNames(first.model, second.model) ||
  getFrontierCodeReasoningEffortOrder(second.reasoning_effort) -
    getFrontierCodeReasoningEffortOrder(first.reasoning_effort);

/** Calculates a readable score-axis maximum. */
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

/** Creates evenly spaced score-axis ticks. */
const createScoreTicks = (maximum: number): number[] =>
  Array.from(
    { length: Math.floor(maximum / SCORE_TICK_STEP) + 1 },
    (_, index) => index * SCORE_TICK_STEP,
  );

/** Converts a fractional score to a percentage position within the axis. */
const getAxisPosition = (value: number, axisMaximum: number): number =>
  Math.min(100, Math.max(0, (value * 100 * 100) / axisMaximum));

/** Returns the semantic aria-sort value for a sorting direction. */
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

/**
 * Renders the FrontierCode performance ranking as a sortable semantic table.
 *
 * @param props - Filtered rows and optional configuration-selection callback.
 * @returns Interactive FrontierCode ranking table.
 */
export const FrontierCodePerformanceRankingChart = ({
  onConfigSelect,
  rows,
}: FrontierCodePerformanceRankingChartProps): ReactElement => {
  const modelGroups = useMemo(() => groupRowsByModel(rows), [rows]);
  const [rankingMode, setRankingMode] =
    useState<FrontierCodeRankingMode>("best");
  const [selectedConfig, setSelectedConfig] = useState<string | null>(null);
  const visibleRows = useMemo(
    () =>
      modelGroups
        .flatMap((group) =>
          rankingMode === "best" ? [group.bestRow] : group.rows,
        )
        .sort(compareByScore),
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
            compareFrontierCodeModelNames(
              first.original.model,
              second.original.model,
            ) ||
            getFrontierCodeReasoningEffortOrder(
              first.original.reasoning_effort,
            ) -
              getFrontierCodeReasoningEffortOrder(
                second.original.reasoning_effort,
              ),
          cell: ({ row }) => {
            const item = row.original;
            return (
              <Button
                aria-label={`Select ${item.model}, ${item.reasoning_effort} effort`}
                aria-pressed={activeSelectedConfig === item.config}
                className="h-auto max-w-64 justify-start px-2 py-1 text-left"
                onClick={() => handleConfigSelect(item.config)}
                title={`${item.model} · ${item.reasoning_effort}`}
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
                  {item.reasoning_effort.toUpperCase()}
                </Badge>
              </Button>
            );
          },
        }),
        columnHelper.accessor("score", {
          header: ({ column }) => (
            <SortableHeader column={column} label="FrontierCode score" />
          ),
          sortDescFirst: true,
          cell: ({ row }) => (
            <div className="flex min-w-64 items-center gap-3">
              <ScoreBar
                color={getModelColor(row.original.model)}
                scorePosition={getAxisPosition(
                  row.original.score,
                  scoreAxisMaximum,
                )}
              />
              <span className="w-14 text-right font-medium tabular-nums">
                {formatFrontierCodeScore(row.original.score)}
              </span>
            </div>
          ),
        }),
        columnHelper.accessor("pass_rate", {
          id: "passRate",
          header: ({ column }) => (
            <SortableHeader align="right" column={column} label="Pass rate" />
          ),
          sortDescFirst: true,
          cell: ({ row }) => (
            <span className="block text-right tabular-nums">
              {formatFrontierCodePassRate(row.original.pass_rate)}
            </span>
          ),
        }),
        columnHelper.accessor(
          (row) =>
            row.cost !== null && Number.isFinite(row.cost)
              ? row.cost
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
                {formatFrontierCodeCost(row.original.cost)}
              </span>
            ),
          },
        ),
        columnHelper.accessor(
          (row) => getFrontierCodeCostEfficiency(row) ?? undefined,
          {
            id: "efficiency",
            header: ({ column }) => (
              <SortableHeader
                align="right"
                column={column}
                label="Cost efficiency"
              />
            ),
            sortDescFirst: true,
            sortUndefined: "last",
            cell: ({ row }) => (
              <span className="block text-right tabular-nums">
                {formatFrontierCodeCostEfficiency(
                  getFrontierCodeCostEfficiency(row.original),
                )}
              </span>
            ),
          },
        ),
        columnHelper.accessor("harness", {
          header: ({ column }) => (
            <SortableHeader align="right" column={column} label="Harness" />
          ),
          sortDescFirst: false,
          cell: ({ row }) => (
            <span className="block max-w-40 truncate text-right">
              {row.original.harness}
            </span>
          ),
        }),
        columnHelper.accessor(
          (row) =>
            row.flagged_rate !== null && Number.isFinite(row.flagged_rate)
              ? row.flagged_rate
              : undefined,
          {
            id: "flagged",
            header: ({ column }) => (
              <SortableHeader align="right" column={column} label="Flagged" />
            ),
            sortDescFirst: true,
            sortUndefined: "last",
            cell: ({ row }) => (
              <span className="block text-right tabular-nums">
                {row.original.flagged_rate === null
                  ? "—"
                  : formatFrontierCodePassRate(row.original.flagged_rate)}
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

  const handleRankingModeChange = (nextMode: FrontierCodeRankingMode): void => {
    setRankingMode(nextMode);
    setSelectedConfig(null);
    onConfigSelect?.(null);
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
        <ToggleFilter
          label="Ranking detail"
          onChange={handleRankingModeChange}
          options={RANKING_MODE_OPTIONS}
          value={rankingMode}
        />
      </div>

      <div className="border-border bg-card rounded-md border">
        <Table className="min-w-300">
          <TableCaption className="sr-only">
            FrontierCode configurations. Activate a column header to change the
            sort.
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
                    <div className="w-14" />
                  </div>
                </TableCell>
                <TableCell colSpan={5} />
              </TableRow>
            </TableFooter>
          ) : null}
        </Table>
      </div>
    </section>
  );
};
