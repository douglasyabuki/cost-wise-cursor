import type { CursorModelPrice } from "@/types-and-constants/cursor";

import {
  findSectionEnd,
  findTableStart,
  markdownText,
  normalizeHeader,
  parseModelCell,
  parseNullablePrice,
  parsePrice,
  splitTableRow,
} from "./markdown";

/**
 * Extracts the model-pricing table from Cursor's Markdown document.
 *
 * The parser locates the `### Model pricing` section, validates the
 * expected columns, converts prices to numbers, and returns structured
 * model-pricing records.
 *
 * @param markdown - Cursor's complete models-and-pricing Markdown.
 * @returns The parsed model-pricing records.
 * @throws {Error} If the pricing section, table, columns, rows, or price
 * values do not match the expected format.
 */
export const parseCursorModelPrices = (
  markdown: string,
): CursorModelPrice[] => {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");

  const sectionStart = lines.findIndex((line) =>
    /^###\s+Model pricing\s*$/i.test(line.trim()),
  );

  if (sectionStart === -1) {
    throw new Error('Missing "Model pricing" section');
  }

  const sectionEnd = findSectionEnd(lines, sectionStart);

  const tableStart = findTableStart(lines, sectionStart + 1, sectionEnd);

  if (tableStart === -1) {
    throw new Error('Missing "Model pricing" table');
  }

  const headers = splitTableRow(lines[tableStart]).map(normalizeHeader);

  const columnIndex = new Map(headers.map((header, index) => [header, index]));

  const requiredColumns = [
    "model",
    "provider",
    "input",
    "cache write",
    "cache read",
    "output",
    "notes",
  ];

  for (const column of requiredColumns) {
    if (!columnIndex.has(column)) {
      throw new Error(`Missing pricing column: ${column}`);
    }
  }

  const results: CursorModelPrice[] = [];

  // Skip the table header and separator rows.
  for (let index = tableStart + 2; index < sectionEnd; index++) {
    const line = lines[index];

    if (!line.trim()) break;

    const cells = splitTableRow(line);

    if (cells.length !== headers.length) {
      throw new Error(`Unexpected column count on Markdown line ${index + 1}`);
    }

    /**
     * Returns the current row's value for a named table column.
     *
     * @param column - The normalized column name.
     * @returns The trimmed Markdown cell value.
     * @throws {Error} If the requested column does not exist.
     */
    const cell = (column: string): string => {
      const position = columnIndex.get(column);

      if (position === undefined) {
        throw new Error(`Unknown column: ${column}`);
      }

      return cells[position].trim();
    };

    const model = parseModelCell(cell("model"));

    results.push({
      model: model.name,
      modelUrl: model.url,
      provider: markdownText(cell("provider")),
      inputPerMillion: parsePrice(cell("input"), index),
      cacheWritePerMillion: parseNullablePrice(cell("cache write"), index),
      cacheReadPerMillion: parseNullablePrice(cell("cache read"), index),
      outputPerMillion: parsePrice(cell("output"), index),
      notes: markdownText(cell("notes")) || null,
    });
  }

  if (!results.length) {
    throw new Error("The pricing table contains no models");
  }

  return results;
};
