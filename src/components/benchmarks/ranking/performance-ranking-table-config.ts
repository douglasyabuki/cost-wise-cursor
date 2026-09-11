import type { RowData } from "@tanstack/react-table";
import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  tableFeatures,
} from "@tanstack/react-table";

/** TanStack features shared by the performance-ranking tables. */
export const performanceRankingTableFeatures = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
});

/**
 * Creates a column helper bound to the shared performance-ranking features.
 *
 * @param TRow - Row type used by the benchmark-specific columns.
 * @returns A TanStack column helper with the shared feature registry.
 */
export const createPerformanceRankingColumnHelper = <TRow extends RowData>() =>
  createColumnHelper<typeof performanceRankingTableFeatures, TRow>();
