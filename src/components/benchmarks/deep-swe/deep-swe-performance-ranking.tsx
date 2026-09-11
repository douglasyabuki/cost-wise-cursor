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
import type { DeepSweLeaderboardRow } from "@/types-and-constants/deep-swe";
import type { PerformanceRankingMode } from "@/types-and-constants/performance-ranking";
import { getScoreAxisPosition } from "@/utils/chart";
import {
  compareModelNames,
  formatCompactNumber,
  formatConfidence,
  formatCost,
  formatCostEfficiency,
  formatScore,
  getConfidenceBounds,
  getCostEfficiency,
  getReasoningEffort,
} from "@/utils/deep-swe";
import { getModelColor } from "@/utils/model-colors";
import {
  createScoreTicks,
  getScoreAxisMaximum,
  getVisibleRankingRows,
  groupRowsByModel,
} from "@/utils/performance-ranking";

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

const columnHelper =
  createPerformanceRankingColumnHelper<DeepSweLeaderboardRow>();

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

/** Orders configurations by Pass@1 with stable model and effort tie-breakers. */
const compareByPerformance = (
  first: DeepSweLeaderboardRow,
  second: DeepSweLeaderboardRow,
): number =>
  second.pass_at_1 - first.pass_at_1 ||
  compareModelNames(first.model, second.model) ||
  getReasoningEffortRank(getReasoningEffort(second)) -
    getReasoningEffortRank(getReasoningEffort(first));

/** Orders model groups by their best DeepSWE score. */
const compareGroupsByPerformance = (
  first: { bestRow: DeepSweLeaderboardRow; model: string },
  second: { bestRow: DeepSweLeaderboardRow; model: string },
): number =>
  second.bestRow.pass_at_1 - first.bestRow.pass_at_1 ||
  compareModelNames(first.model, second.model);

/** Reads the DeepSWE score or its confidence upper bound for the axis. */
const getDeepSweAxisScore = (row: DeepSweLeaderboardRow): number =>
  Math.max(row.pass_at_1, getConfidenceBounds(row).upper);

/**
 * Properties for the DeepSWE performance ranking.
 *
 * @property rows - Filtered DeepSWE configurations to display.
 * @property onConfigSelect - Optional callback when a configuration is selected or cleared.
 */
interface DeepSwePerformanceRankingProps {
  rows: readonly DeepSweLeaderboardRow[];
  onConfigSelect?: (config: string | null) => void;
}

/**
 * Renders the DeepSWE performance ranking as a sortable semantic table.
 *
 * @param props - Filtered rows and optional configuration-selection callback.
 * @returns Interactive DeepSWE ranking table.
 */
export const DeepSwePerformanceRanking = ({
  onConfigSelect,
  rows,
}: DeepSwePerformanceRankingProps): ReactElement => {
  const modelGroups = useMemo(
    () => groupRowsByModel(rows, getBestEffortRow, compareGroupsByPerformance),
    [rows],
  );
  const [rankingMode, setRankingMode] =
    useState<PerformanceRankingMode>("best");
  const [selectedConfig, setSelectedConfig] = useState<string | null>(null);
  const visibleRows = useMemo(
    () => getVisibleRankingRows(modelGroups, rankingMode, compareByPerformance),
    [modelGroups, rankingMode],
  );
  const activeSelectedConfig =
    selectedConfig !== null &&
    visibleRows.some((row) => row.config === selectedConfig)
      ? selectedConfig
      : null;
  const scoreAxisMaximum = getScoreAxisMaximum(
    visibleRows,
    getDeepSweAxisScore,
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
          cell: ({ row }) => {
            const confidenceBounds = getConfidenceBounds(row.original);
            return (
              <div className="flex min-w-64 items-center gap-3">
                <ScoreBar
                  color={getModelColor(row.original.model)}
                  confidenceBounds={confidenceBounds}
                  confidenceEnd={getScoreAxisPosition(
                    confidenceBounds.upper,
                    scoreAxisMaximum,
                  )}
                  confidenceStart={getScoreAxisPosition(
                    confidenceBounds.lower,
                    scoreAxisMaximum,
                  )}
                  scorePosition={getScoreAxisPosition(
                    row.original.pass_at_1,
                    scoreAxisMaximum,
                  )}
                />
                <div className="w-16 text-right tabular-nums">
                  <div className="font-medium">
                    {formatScore(row.original.pass_at_1)}
                  </div>
                  <div className="text-muted-foreground text-[10px]">
                    {formatConfidence(row.original)}
                  </div>
                </div>
              </div>
            );
          },
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

  return (
    <section
      aria-labelledby="deep-swe-model-ranking-title"
      className="flex flex-col gap-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3
          className="text-lg leading-tight font-semibold tracking-tight"
          id="deep-swe-model-ranking-title"
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
        ariaLabelledBy="deep-swe-model-ranking-title"
        caption="DeepSWE configurations. Activate a column header to change the sort."
        columns={columns}
        data={visibleRows}
        emptyMessage="No configurations are selected."
        getRowId={(row) => row.config}
        scoreAxisMaximum={scoreAxisMaximum}
        scoreTicks={scoreTicks}
        scoreValueWidthClassName="w-16"
        tableClassName="min-w-5xl"
      />
    </section>
  );
};
