import type { ReactElement } from "react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

/** A labeled value for a benchmark toggle filter. */
export interface BenchmarkToggleFilterOption<T extends string> {
  label: string;
  value: T;
}

/** Controlled selection, accessible group label, and available options; no implicit default. */
export interface BenchmarkToggleFilterProps<T extends string> {
  label: string;
  options: readonly BenchmarkToggleFilterOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

/**
 * Renders a controlled single-selection filter with keyboard navigation.
 * @param props - Accessible label, options, current value, and change callback.
 * @returns Connected small toggle buttons; clearing the selection is ignored.
 */
export const BenchmarkToggleFilter = <T extends string>({
  label,
  options,
  value,
  onChange,
}: BenchmarkToggleFilterProps<T>): ReactElement => (
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
