import { type ReactElement, useCallback, useMemo, useState } from "react";

import {
  RankingModeToggle,
  SortableHeader,
} from "@/components/benchmarks/ranking/performance-ranking-controls";
import { PerformanceRankingTable } from "@/components/benchmarks/ranking/performance-ranking-table";
import { createPerformanceRankingColumnHelper } from "@/components/benchmarks/ranking/performance-ranking-table-config";
import { ScoreBar } from "@/components/benchmarks/ranking/score-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { FrontierCodeLeaderboardRow } from "@/types-and-constants/frontier-code";
import type { PerformanceRankingMode } from "@/types-and-constants/performance-ranking";
import { getScoreAxisPosition } from "@/utils/chart";
import {
  compareFrontierCodeModelNames,
  formatFrontierCodeCost,
  formatFrontierCodeCostEfficiency,
  formatFrontierCodePassRate,
  formatFrontierCodeScore,
  getFrontierCodeCostEfficiency,
  getFrontierCodeReasoningEffortOrder,
} from "@/utils/frontier-code";
import { getModelColor } from "@/utils/model-colors";
import {
  createScoreTicks,
  getScoreAxisMaximum,
  getVisibleRankingRows,
  groupRowsByModel,
} from "@/utils/performance-ranking";

const columnHelper =
  createPerformanceRankingColumnHelper<FrontierCodeLeaderboardRow>();

/** Groups FrontierCode rows by their highest-scoring configuration. */
const getBestScoreRow = (
  rows: readonly FrontierCodeLeaderboardRow[],
): FrontierCodeLeaderboardRow =>
  rows.reduce((bestRow, row) =>
    row.score > bestRow.score ||
    (row.score === bestRow.score &&
      getFrontierCodeReasoningEffortOrder(row.reasoning_effort) >
        getFrontierCodeReasoningEffortOrder(bestRow.reasoning_effort))
      ? row
      : bestRow,
  );

/** Orders FrontierCode configurations by score and stable tie-breakers. */
const compareByScore = (
  first: FrontierCodeLeaderboardRow,
  second: FrontierCodeLeaderboardRow,
): number =>
  second.score - first.score ||
  compareFrontierCodeModelNames(first.model, second.model) ||
  getFrontierCodeReasoningEffortOrder(second.reasoning_effort) -
    getFrontierCodeReasoningEffortOrder(first.reasoning_effort);

/** Orders model groups by their best FrontierCode score. */
const compareGroupsByScore = (
  first: { bestRow: FrontierCodeLeaderboardRow; model: string },
  second: { bestRow: FrontierCodeLeaderboardRow; model: string },
): number =>
  second.bestRow.score - first.bestRow.score ||
  compareFrontierCodeModelNames(first.model, second.model);

/** Reads the fractional FrontierCode score for the shared axis. */
const getFrontierCodeAxisScore = (row: FrontierCodeLeaderboardRow): number =>
  row.score;

/** Properties for the FrontierCode performance ranking. */
interface FrontierCodePerformanceRankingProps {
  /** Filtered FrontierCode configurations to display. */
  rows: readonly FrontierCodeLeaderboardRow[];
  /** Called when the user selects or clears a configuration. */
  onConfigSelect?: (config: string | null) => void;
}

/**
 * Renders the FrontierCode performance ranking as a sortable semantic table.
 *
 * @param props - Filtered rows and optional configuration-selection callback.
 * @returns Interactive FrontierCode ranking table.
 */
export const FrontierCodePerformanceRanking = ({
  onConfigSelect,
  rows,
}: FrontierCodePerformanceRankingProps): ReactElement => {
  const modelGroups = useMemo(
    () => groupRowsByModel(rows, getBestScoreRow, compareGroupsByScore),
    [rows],
  );
  const [rankingMode, setRankingMode] =
    useState<PerformanceRankingMode>("best");
  const [selectedConfig, setSelectedConfig] = useState<string | null>(null);
  const visibleRows = useMemo(
    () => getVisibleRankingRows(modelGroups, rankingMode, compareByScore),
    [modelGroups, rankingMode],
  );
  const activeSelectedConfig =
    selectedConfig !== null &&
    visibleRows.some((row) => row.config === selectedConfig)
      ? selectedConfig
      : null;
  const scoreAxisMaximum = getScoreAxisMaximum(
    visibleRows,
    getFrontierCodeAxisScore,
  );
  const scoreTicks = createScoreTicks(scoreAxisMaximum);

  const handleConfigSelect = useCallback(
    (config: string): void => {
      const nextConfig = activeSelectedConfig === config ? null : config;
      setSelectedConfig(nextConfig);
      onConfigSelect?.(nextConfig);
    },
    [activeSelectedConfig, onConfigSelect],
  );

  const handleRankingModeChange = (mode: PerformanceRankingMode): void => {
    setRankingMode(mode);
    setSelectedConfig(null);
    onConfigSelect?.(null);
  };

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
                scorePosition={getScoreAxisPosition(
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
        <RankingModeToggle
          label="Ranking detail"
          onChange={handleRankingModeChange}
          value={rankingMode}
        />
      </div>

      <PerformanceRankingTable
        activeSelectedConfig={activeSelectedConfig}
        ariaLabelledBy="frontier-code-model-ranking-title"
        caption="FrontierCode configurations. Activate a column header to change the sort."
        columns={columns}
        data={visibleRows}
        emptyMessage="No configurations are selected."
        getRowId={(row) => row.config}
        scoreAxisMaximum={scoreAxisMaximum}
        scoreTicks={scoreTicks}
        scoreValueWidthClassName="w-14"
        tableClassName="min-w-300"
      />
    </section>
  );
};
