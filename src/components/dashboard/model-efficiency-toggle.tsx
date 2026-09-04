import { ChartColumn, ChartColumnIncreasing } from "lucide-react";

import { Toggle } from "@/components/ui/toggle";

/**
 * Public properties for the model-efficiency view toggle.
 */
export interface ModelEfficiencyToggleProps {
  hiddenConfigurationCount: number;
  showMoreEfficientOnly: boolean;
  modelCount: number;
  onShowMoreEfficientOnlyChange: (showMoreEfficientOnly: boolean) => void;
}

/**
 * Switches between showing all selected models and only more efficient models.
 *
 * The control leaves manual configuration selection unchanged. The More
 * efficient models view hides outperformed configurations from charts and
 * rankings.
 *
 * @param props - Toggle state, selected-model count, and change handler.
 * @returns A keyboard-accessible model-efficiency toggle and status.
 */
export const ModelEfficiencyToggle = ({
  hiddenConfigurationCount,
  modelCount,
  onShowMoreEfficientOnlyChange,
  showMoreEfficientOnly,
}: ModelEfficiencyToggleProps) => {
  const canShowMoreEfficientOnly = modelCount > 1;
  const status = showMoreEfficientOnly
    ? hiddenConfigurationCount === 0
      ? "No outperformed configurations found."
      : `${hiddenConfigurationCount} outperformed configuration${hiddenConfigurationCount === 1 ? " is" : "s are"} hidden from the charts.`
    : "";
  const viewLabel = showMoreEfficientOnly
    ? "More efficient models"
    : "All models";
  const viewDescription = showMoreEfficientOnly
    ? "Show all selected configurations"
    : "Show only more efficient models based on cost and score";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Toggle
        aria-label={viewLabel}
        disabled={!showMoreEfficientOnly && !canShowMoreEfficientOnly}
        onPressedChange={onShowMoreEfficientOnlyChange}
        pressed={showMoreEfficientOnly}
        size="sm"
        title={viewDescription}
        variant="default"
      >
        {showMoreEfficientOnly ? (
          <ChartColumnIncreasing aria-hidden data-icon="inline-start" />
        ) : (
          <ChartColumn aria-hidden data-icon="inline-start" />
        )}
        {viewLabel}
      </Toggle>

      {showMoreEfficientOnly && (
        <span aria-live="polite" className="sr-only" role="status">
          {status}
        </span>
      )}
    </div>
  );
};
