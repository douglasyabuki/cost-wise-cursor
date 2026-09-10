import { type ReactElement } from "react";

/** Public properties for the shared score-axis guide. */
export interface ScoreAxisProps {
  /** Maximum percentage represented by the axis. */
  maximum: number;
  /** Percentage tick values rendered along the axis. */
  ticks: readonly number[];
}

/**
 * Renders the percentage guide beneath a score bar.
 *
 * @param props - Axis maximum and percentage tick values.
 * @returns A positioned percentage axis guide.
 */
export const ScoreAxis = ({ maximum, ticks }: ScoreAxisProps): ReactElement => (
  <div className="relative h-5 min-w-36 flex-1">
    {ticks.map((tick) => {
      const position = (tick / maximum) * 100;
      const transform =
        tick === 0
          ? "translateX(0)"
          : tick === maximum
            ? "translateX(-100%)"
            : "translateX(-50%)";

      return (
        <span
          className="text-muted-foreground absolute top-0 text-[10px] tabular-nums"
          key={tick}
          style={{ left: `${position}%`, transform }}
        >
          {tick}%
        </span>
      );
    })}
  </div>
);
