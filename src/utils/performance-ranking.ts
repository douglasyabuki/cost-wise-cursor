import type { PerformanceRankingMode } from "@/types-and-constants/performance-ranking";

type PerformanceRankingRow = { config: string; model: string };
type PerformanceRankingModelGroup<TRow extends PerformanceRankingRow> = {
  model: string;
  rows: readonly TRow[];
  bestRow: TRow;
};
const SCORE_TICK_STEP = 20;
const MINIMUM_SCORE_AXIS_MAXIMUM = 80;

/**
 * Groups ranking rows by model and orders the groups without mutating the input.
 * @param rows - Available benchmark configurations.
 * @param getBestRow - Selects one representative from each nonempty model group.
 * @param compareGroups - Comparator for ordering model groups.
 * @returns Model groups containing their original rows and selected representative.
 */
export const groupRowsByModel = <TRow extends PerformanceRankingRow>(
  rows: readonly TRow[],
  getBestRow: (rows: readonly TRow[]) => TRow,
  compareGroups: (
    first: PerformanceRankingModelGroup<TRow>,
    second: PerformanceRankingModelGroup<TRow>,
  ) => number,
): PerformanceRankingModelGroup<TRow>[] => {
  const rowsByModel = new Map<string, TRow[]>();

  rows.forEach((row) => {
    const modelRows = rowsByModel.get(row.model) ?? [];
    modelRows.push(row);
    rowsByModel.set(row.model, modelRows);
  });

  return [...rowsByModel.entries()]
    .map(([model, modelRows]) => ({
      model,
      rows: modelRows,
      bestRow: getBestRow(modelRows),
    }))
    .sort(compareGroups);
};

/**
 * Selects representative or all configurations and sorts a new array.
 * @param groups - Prepared model groups.
 * @param mode - Whether to show each model's best configuration or all configurations.
 * @param compareRows - Comparator for the displayed configurations.
 * @returns Ordered visible rows, preserving the input groups.
 */
export const getVisibleRankingRows = <TRow extends PerformanceRankingRow>(
  groups: readonly PerformanceRankingModelGroup<TRow>[],
  mode: PerformanceRankingMode,
  compareRows: (first: TRow, second: TRow) => number,
): TRow[] =>
  groups
    .flatMap((group) => (mode === "best" ? [group.bestRow] : group.rows))
    .sort(compareRows);

/**
 * Computes a ranking axis ceiling in percentage points, bounded from 80 to 100.
 * @param rows - Visible configurations.
 * @param getScore - Reads a finite fractional score or confidence upper bound.
 * @returns Axis maximum rounded up to a 20-point interval; empty rows yield 80.
 */
export const getScoreAxisMaximum = <TRow>(
  rows: readonly TRow[],
  getScore: (row: TRow) => number,
): number => {
  const highestScore = Math.max(0, ...rows.map((row) => getScore(row) * 100));

  return Math.min(
    100,
    Math.max(
      MINIMUM_SCORE_AXIS_MAXIMUM,
      Math.ceil(highestScore / SCORE_TICK_STEP) * SCORE_TICK_STEP,
    ),
  );
};

/**
 * Creates percentage ticks from zero through the last 20-point interval.
 * @param maximum - Nonnegative axis maximum in percentage points.
 * @returns Ascending percentage tick values.
 * @example createScoreTicks(80) // [0, 20, 40, 60, 80]
 */
export const createScoreTicks = (maximum: number): number[] =>
  Array.from(
    { length: Math.floor(maximum / SCORE_TICK_STEP) + 1 },
    (_, index) => index * SCORE_TICK_STEP,
  );
