const CHART_LABEL_REFERENCE_WIDTH = 1_200;

interface ChartPointTitleTarget<TDatum> {
  datum: TDatum;
  key: string;
}

/**
 * Adds native SVG titles to chart points after the chart renderer mounts them.
 *
 * @param svg - Mounted SVG chart surface.
 * @param points - Rendered chart points and their stable scene keys.
 * @param getTitle - Creates the title text for each point datum.
 * @returns Nothing; the SVG point nodes are updated in place.
 * @example
 * setChartPointTitles(svg, scene.points, (point) => `${point.model} · ${point.effort}`);
 */
export const setChartPointTitles = <TDatum>(
  svg: SVGSVGElement,
  points: readonly ChartPointTitleTarget<TDatum>[],
  getTitle: (datum: TDatum) => string,
): void => {
  const nodesByKey = new Map<string, SVGElement>();

  svg.querySelectorAll<SVGElement>("[data-ts-key]").forEach((node) => {
    const key = node.dataset.tsKey;

    if (key !== undefined) {
      nodesByKey.set(key, node);
    }
  });

  points.forEach((point) => {
    const node =
      nodesByKey.get(point.key) ?? nodesByKey.get(`${point.key}:dot`);

    if (node === undefined) {
      return;
    }

    const title =
      Array.from(node.children).find((child) => child.localName === "title") ??
      svg.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "title");

    if (title.parentElement === null) {
      node.prepend(title);
    }

    title.textContent = getTitle(point.datum);
  });
};

/**
 * Scales a chart label against its measured surface width.
 *
 * The maximum preserves the desktop size, while the minimum keeps labels
 * readable on genuinely narrow screens and at high browser zoom levels.
 *
 * @param width - Measured chart-surface width in CSS pixels.
 * @param minimumSize - Smallest permitted font size in CSS pixels.
 * @param maximumSize - Font size used at the reference width and above.
 * @returns A responsive font size between the supplied limits.
 */
export const getResponsiveChartLabelFontSize = (
  width: number,
  minimumSize: number,
  maximumSize: number,
): number =>
  Math.min(
    maximumSize,
    Math.max(minimumSize, (width / CHART_LABEL_REFERENCE_WIDTH) * maximumSize),
  );

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
