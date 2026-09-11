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

type PerformanceRankingTableRow = RowData & { config: string };

type PerformanceRankingTableProps<TRow extends PerformanceRankingTableRow> = {
  /** ID of the heading that labels the table's containing section. */
  ariaLabelledBy: string;
  /** Complete benchmark-specific column definitions. */
  columns: TableOptions<
    typeof performanceRankingTableFeatures,
    TRow
  >["columns"];
  /** Visible rows in their pre-table-sort order. */
  data: TRow[];
  /** Screen-reader-only description of the table. */
  caption: string;
  /** Message rendered when no configurations are visible. */
  emptyMessage: string;
  /** Stable configuration identifier used for TanStack row IDs. */
  getRowId: (row: TRow) => string;
  /** Active configuration, used to apply the selected row state. */
  activeSelectedConfig: string | null;
  /** Score-axis maximum in percentage points. */
  scoreAxisMaximum: number;
  /** Percentage tick values rendered below the score column. */
  scoreTicks: readonly number[];
  /** Width class for the score value beside the bar. */
  scoreValueWidthClassName: string;
  /** Minimum width class for the benchmark's table columns. */
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
