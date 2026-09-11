import { type ReactElement } from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * A score bar's fractional lower and upper confidence bounds.
 *
 * @property lower - Lower fractional score bound.
 * @property upper - Upper fractional score bound.
 */
export interface ScoreBarConfidenceBounds {
  lower: number;
  upper: number;
}

/**
 * Properties for the reusable score bar.
 *
 * @property color - Color used for the score fill and marker.
 * @property confidenceBounds - Optional fractional bounds displayed in the marker tooltip.
 * @property confidenceStart - Optional lower percentage position for the interval whisker.
 * @property confidenceEnd - Optional upper percentage position for the interval whisker.
 * @property scorePosition - Percentage position of the score along the bar.
 */
export interface ScoreBarProps {
  color: string;
  confidenceBounds?: ScoreBarConfidenceBounds;
  confidenceStart?: number;
  confidenceEnd?: number;
  scorePosition: number;
}

/** Clamps a percentage position to the visible score-bar range. */
const clampPosition = (position: number): number =>
  Math.min(100, Math.max(0, position));

/** Formats a fractional score as a percentage for the confidence tooltip. */
const formatPercentage = (value: number): string =>
  `${(value * 100).toFixed(1)}%`;

/**
 * Renders a score bar with an optional confidence-interval whisker.
 *
 * @param props - Bar color, score position, and optional confidence bounds.
 * @returns A score bar whose marker exposes confidence bounds on hover and focus.
 */
export const ScoreBar = ({
  color,
  confidenceBounds,
  confidenceEnd,
  confidenceStart,
  scorePosition,
}: ScoreBarProps): ReactElement => {
  const clampedScorePosition = clampPosition(scorePosition);
  const hasConfidenceBounds = confidenceBounds !== undefined;
  const hasConfidenceWhisker =
    confidenceStart !== undefined && confidenceEnd !== undefined;
  const clampedConfidenceStart =
    confidenceStart === undefined ? 0 : clampPosition(confidenceStart);
  const clampedConfidenceEnd =
    confidenceEnd === undefined ? 0 : clampPosition(confidenceEnd);
  const confidenceLabel = hasConfidenceBounds
    ? `${formatPercentage(confidenceBounds.lower)} – ${formatPercentage(confidenceBounds.upper)}`
    : undefined;
  const markerClassName =
    "border-card absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2";
  const markerStyle = {
    backgroundColor: color,
    left: `${clampedScorePosition}%`,
  };

  return (
    <div
      aria-hidden={hasConfidenceBounds ? undefined : true}
      className="relative h-5 min-w-36 flex-1"
    >
      <div className="bg-muted/50 absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-sm" />
      <div
        className="absolute top-1/2 left-0 h-2 -translate-y-1/2 rounded-sm transition-[width] duration-200"
        style={{
          backgroundColor: color,
          width: `${clampedScorePosition}%`,
        }}
      />
      {hasConfidenceWhisker ? (
        <div
          className="bg-foreground/80 absolute top-1/2 h-px -translate-y-1/2"
          style={{
            left: `${clampedConfidenceStart}%`,
            width: `${Math.max(0, clampedConfidenceEnd - clampedConfidenceStart)}%`,
          }}
        >
          <span className="bg-foreground/80 absolute top-1/2 left-0 h-2 w-px -translate-y-1/2" />
          <span className="bg-foreground/80 absolute top-1/2 right-0 h-2 w-px -translate-y-1/2" />
        </div>
      ) : null}
      {hasConfidenceBounds ? (
        <Tooltip>
          <TooltipTrigger
            aria-label={confidenceLabel}
            className={cn(
              markerClassName,
              "focus-visible:outline-ring m-0 appearance-none bg-transparent p-0 focus-visible:outline-2 focus-visible:outline-offset-2",
            )}
            style={markerStyle}
            type="button"
          />
          <TooltipContent>{confidenceLabel}</TooltipContent>
        </Tooltip>
      ) : (
        <span className={markerClassName} style={markerStyle} />
      )}
    </div>
  );
};
