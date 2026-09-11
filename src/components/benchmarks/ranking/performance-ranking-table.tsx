import type { RowData, TableOptions } from "@tanstack/react-table";
import { useTable } from "@tanstack/react-table";
import { type ReactElement } from "react";

import { performanceRankingTableFeatures } from "@/components/benchmarks/ranking/performance-ranking-table-config";
import { ScoreAxis } from "@/components/benchmarks/ranking/score-axis";
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

/** A ranking-table row with the stable configuration id required for selection. */
type PerformanceRankingTableRow = RowData & { config: string };

/**
 * Properties for the shared sortable performance-ranking table.
 *
 * @property ariaLabelledBy - ID of the heading that labels the table's containing section.
 * @property columns - Complete benchmark-specific column definitions.
 * @property data - Visible rows in their pre-table-sort order.
 * @property caption - Screen-reader-only description of the table.
 * @property emptyMessage - Message rendered when no configurations are visible.
 * @property getRowId - Returns the stable configuration identifier for a row.
 * @property activeSelectedConfig - Active configuration used to apply selected-row state.
 * @property scoreAxisMaximum - Score-axis maximum in percentage points.
 * @property scoreTicks - Percentage tick values rendered below the score column.
 * @property scoreValueWidthClassName - Width class for the score value beside the bar.
 * @property tableClassName - Minimum-width class for the benchmark table columns.
 */
type PerformanceRankingTableProps<TRow extends PerformanceRankingTableRow> = {
  ariaLabelledBy: string;
  columns: TableOptions<
    typeof performanceRankingTableFeatures,
    TRow
  >["columns"];
  data: TRow[];
  caption: string;
  emptyMessage: string;
  getRowId: (row: TRow) => string;
  activeSelectedConfig: string | null;
  scoreAxisMaximum: number;
  scoreTicks: readonly number[];
  scoreValueWidthClassName: string;
  tableClassName: string;
};

/** Returns the semantic aria-sort value for a TanStack sorting direction. */
const getAriaSort = (
  direction: false | "asc" | "desc",
): "ascending" | "descending" | "none" => {
  if (direction === "asc") return "ascending";
  if (direction === "desc") return "descending";
  return "none";
};

/**
 * Renders the shared sortable table, empty state, and score-axis footer.
 *
 * @param props - Table data, columns, selection state, and axis configuration.
 * @returns A semantic sortable ranking table.
 */
export const PerformanceRankingTable = <
  TRow extends PerformanceRankingTableRow,
>({
  activeSelectedConfig,
  ariaLabelledBy,
  caption,
  columns,
  data,
  emptyMessage,
  getRowId,
  scoreAxisMaximum,
  scoreTicks,
  scoreValueWidthClassName,
  tableClassName,
}: PerformanceRankingTableProps<TRow>): ReactElement => {
  const table = useTable({
    columns,
    data,
    enableMultiSort: false,
    enableSortingRemoval: false,
    features: performanceRankingTableFeatures,
    getRowId: (row) => getRowId(row),
    initialState: { sorting: [{ id: "score", desc: true }] },
  });
  const tableRows = table.getRowModel().rows;

  return (
    <div className="border-border bg-card rounded-md border">
      <Table aria-labelledby={ariaLabelledBy} className={tableClassName}>
        <TableCaption className="sr-only">{caption}</TableCaption>
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
          {tableRows.length === 0 ? (
            <TableRow>
              <TableCell
                className="text-muted-foreground h-36 text-center"
                colSpan={columns.length}
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            tableRows.map((row) => (
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
        {tableRows.length > 0 ? (
          <TableFooter>
            <TableRow>
              <TableCell />
              <TableCell>
                <div className="flex min-w-64 gap-3">
                  <ScoreAxis maximum={scoreAxisMaximum} ticks={scoreTicks} />
                  <div className={scoreValueWidthClassName} />
                </div>
              </TableCell>
              <TableCell colSpan={Math.max(0, columns.length - 2)} />
            </TableRow>
          </TableFooter>
        ) : null}
      </Table>
    </div>
  );
};
