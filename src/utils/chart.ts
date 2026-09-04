/**
 * Rendered SVG coordinates supplied to a custom Recharts scatter line.
 * Missing or non-finite coordinates are ignored during hit testing.
 */
export interface ScatterLinePoint {
  cx?: number | null;
  cy?: number | null;
  x?: number | null;
  y?: number | null;
}

/**
 * Formats a dollar value for a compact cost-axis tick.
 *
 * @param value - Cost value in US dollars.
 * @returns Dollar value with decimals only when the tick is fractional.
 */
export const formatCostAxisTick = (value: number): string =>
  `$${Number.isInteger(value) ? value : value.toFixed(1)}`;

/**
 * Formats a chart percentage value with two decimal places.
 *
 * @param value - Percentage-point value.
 * @returns Percentage with two decimal places.
 */
export const formatChartPercentage = (value: number): string =>
  `${value.toFixed(2)}%`;

/**
 * Pointer position in viewport pixels and the SVG element receiving the event.
 */
interface LinePointerEvent {
  clientX: number;
  clientY: number;
  currentTarget: SVGGraphicsElement;
}

/**
 * Finds the configuration nearest to the pointer on a model's rendered line.
 * Compares viewport pixels so SVG transforms and different axis units do not
 * distort the distance. Equal distances retain the first point in series order.
 *
 * @param event - Mouse position and the line's SVG group.
 * @param points - Rendered line points supplied by Recharts.
 * @param configurations - Configurations in the same order as the line points.
 * @param fallbackConfig - Selection when geometry is unavailable; callers also
 * use this configuration for keyboard interaction without a pointer position.
 * @returns Nearest configuration, or the supplied fallback.
 */
export const getNearestLineConfig = (
  event: LinePointerEvent,
  points: readonly ScatterLinePoint[] | undefined,
  configurations: readonly { config: string }[],
  fallbackConfig: string,
): string => {
  const transform = event.currentTarget.getScreenCTM();

  if (!transform) return fallbackConfig;

  let nearestConfig = fallbackConfig;
  let nearestDistance = Number.POSITIVE_INFINITY;

  points?.forEach((point, index) => {
    const x = point.x ?? point.cx;
    const y = point.y ?? point.cy;
    const config = configurations[index]?.config;

    if (
      typeof x !== "number" ||
      typeof y !== "number" ||
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      config === undefined
    ) {
      return;
    }

    const screenX = transform.a * x + transform.c * y + transform.e;
    const screenY = transform.b * x + transform.d * y + transform.f;
    const distance =
      (screenX - event.clientX) ** 2 + (screenY - event.clientY) ** 2;

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestConfig = config;
    }
  });

  return nearestConfig;
};
