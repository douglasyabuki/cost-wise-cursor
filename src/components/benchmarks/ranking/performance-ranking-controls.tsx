import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { type ReactElement } from "react";

import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import type { PerformanceRankingMode } from "@/types-and-constants/performance-ranking";

/** Shared Best/All options for performance-ranking tables. */
const PERFORMANCE_RANKING_MODE_OPTIONS = [
  { label: "Best", value: "best" },
  { label: "All effort levels", value: "all" },
] as const satisfies readonly {
  label: string;
  value: PerformanceRankingMode;
}[];

interface RankingModeToggleProps {
  /** Accessible label for the toggle group. */
  label: string;
  /** Current Best/All mode. */
  value: PerformanceRankingMode;
  /** Called when the user chooses another mode. */
  onChange: (value: PerformanceRankingMode) => void;
}

/**
 * Renders the shared Best/All ranking-detail control.
 *
 * @param props - Accessible label, current mode, and change callback.
 * @returns A keyboard-accessible single-select toggle group.
 */
export const RankingModeToggle = ({
  label,
  onChange,
  value,
}: RankingModeToggleProps): ReactElement => (
  <ToggleGroup
    aria-label={label}
    className="bg-background"
    onValueChange={(values) => {
      const [nextValue] = values;
      if (nextValue !== undefined)
        onChange(nextValue as PerformanceRankingMode);
    }}
    size="sm"
    spacing={0}
    value={[value]}
    variant="outline"
  >
    {PERFORMANCE_RANKING_MODE_OPTIONS.map((option) => (
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

/** Column methods required by the shared sortable header. */
interface SortableHeaderColumn {
  getIsSorted: () => false | "asc" | "desc";
  getNextSortingOrder: () => false | "asc" | "desc";
  toggleSorting: (descending?: boolean) => void;
}

/** Public properties for a sortable performance-ranking header. */
interface SortableHeaderProps {
  /** Header alignment, which controls the button placement. */
  align?: "left" | "right";
  /** TanStack column sorting API. */
  column: SortableHeaderColumn;
  /** Human-readable column name used in the label and announcement. */
  label: string;
}

/**
 * Renders a sortable table header with an accessible sort announcement.
 *
 * @param props - Column sorting API, label, and optional alignment.
 * @returns A button that advances the column's sort direction.
 */
export const SortableHeader = ({
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
