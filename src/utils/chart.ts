import { type ChartSvgRenderer, renderChartSvg } from "@tanstack/charts";

const CHART_LABEL_REFERENCE_WIDTH = 1_200;
const HEX_COLOR_PATTERN = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i;

interface ChartPointContextMetadata {
  config: string;
  level: string;
  model: string;
}

/** Escapes text before inserting it into serialized SVG markup. */
const escapeSvgText = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

/**
 * Desaturates a hexadecimal chart color and reduces its opacity.
 *
 * @param color - Six-digit hexadecimal source color.
 * @param opacity - Resulting opacity, defaulting to the chart focus treatment.
 * @returns A grayscale CSS color, or a neutral fallback for unsupported input.
 * @example
 * getMutedChartColor("#22c55e") // "rgb(155 155 155 / 55%)"
 */
export const getMutedChartColor = (color: string, opacity = 0.55): string => {
  const match = HEX_COLOR_PATTERN.exec(color);

  if (match === null) {
    return `rgb(128 128 128 / ${opacity * 100}%)`;
  }

  const red = Number.parseInt(match[1] ?? "0", 16);
  const green = Number.parseInt(match[2] ?? "0", 16);
  const blue = Number.parseInt(match[3] ?? "0", 16);
  const gray = Math.round(red * 0.2126 + green * 0.7152 + blue * 0.0722);

  return `rgb(${gray} ${gray} ${gray} / ${opacity * 100}%)`;
};

/**
 * Creates an SVG renderer whose point titles and menu targets survive focus redraws.
 * @param getTitle - Returns the native hover title for a point.
 * @param getMetadata - Returns the point's configuration, model, and level.
 * @returns A renderer for the Chart renderSvg prop, including static rendering.
 */
export const createChartPointSvgRenderer =
  <TDatum>(
    getTitle: (datum: TDatum) => string,
    getMetadata: (datum: TDatum) => ChartPointContextMetadata,
  ): ChartSvgRenderer<TDatum, number, number> =>
  (scene, options) => {
    const pointsByKey = new Map(
      scene.points.flatMap((point) => [
        [escapeSvgText(point.key), point] as const,
        [escapeSvgText(`${point.key}:dot`), point] as const,
      ]),
    );

    // Serialize metadata on every paint: post-render DOM edits are removed by
    // TanStack's SVG reconciliation when pointer or keyboard focus changes.
    return renderChartSvg(scene, options).replace(
      /<circle\b([^>]*?)\s*\/>/g,
      (markup: string, attributes: string) => {
        const key = /data-ts-key="([^"]*)"/.exec(attributes)?.[1];
        const point = key === undefined ? undefined : pointsByKey.get(key);
        if (point === undefined) return markup;

        const metadata = getMetadata(point.datum);
        return `<circle${attributes} data-model-context-config="${escapeSvgText(metadata.config)}" data-model-context-level="${escapeSvgText(metadata.level)}" data-model-context-model="${escapeSvgText(metadata.model)}"><title>${escapeSvgText(getTitle(point.datum))}</title></circle>`;
      },
    );
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
