import type {
  CursorModelPrice,
  CursorUsagePool,
} from "@/types-and-constants/cursor";

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

interface PricingSection {
  fallbackProvider?: string;
  heading: RegExp;
  label: string;
  usagePool: CursorUsagePool;
}

const PRICING_SECTIONS: readonly PricingSection[] = [
  {
    heading: /^##\s+Cursor Models\s*$/i,
    label: "Cursor Models",
    usagePool: "cursor-models",
    fallbackProvider: "Cursor",
  },
  {
    heading: /^###\s+Model pricing\s*$/i,
    label: "Other Models",
    usagePool: "other-models",
  },
];

const MAX_MODE_ONLY_NOTE_PATTERN = /^requires max mode\b/i;

/**
 * Determines whether the base model requires legacy Cursor Max Mode.
 *
 * Only clauses beginning with "Requires Max Mode" are considered. This avoids
 * marking a base model when the note only says its Fast variant requires it.
 *
 * @param notes - Semicolon-separated model notes.
 * @returns Whether the base model requires Max Mode on legacy plans.
 */
const parseRequiresLegacyMaxMode = (
  notes: string | null | undefined,
): boolean =>
  (notes ?? "")
    .split(";")
    .some((note) => MAX_MODE_ONLY_NOTE_PATTERN.test(note.trim()));

/**
 * Returns a Markdown table cell by its normalized column name.
 *
 * @param cells - Values from the current table row.
 * @param columnIndex - Mapping between column names and positions.
 * @param column - Column to read.
 * @returns The trimmed Markdown cell value.
 * @throws {Error} If the requested column does not exist.
 */
const getCell = (
  cells: readonly string[],
  columnIndex: ReadonlyMap<string, number>,
  column: string,
): string => {
  const position = columnIndex.get(column);

  if (position === undefined) {
    throw new Error(`Unknown pricing column: ${column}`);
  }

  return cells[position].trim();
};

/**
 * Resolves the column containing the model name.
 *
 * Cursor's tables may call this column either "Model" or "Name".
 *
 * @param columnIndex - Mapping between column names and positions.
 * @param sectionLabel - Section name used in error messages.
 * @returns The normalized model column name.
 * @throws {Error} If neither model column exists.
 */
const getModelColumn = (
  columnIndex: ReadonlyMap<string, number>,
  sectionLabel: string,
): string => {
  if (columnIndex.has("model")) {
    return "model";
  }

  if (columnIndex.has("name")) {
    return "name";
  }

  throw new Error(
    `Missing "Model" or "Name" pricing column in ${sectionLabel}`,
  );
};

/**
 * Parses one Cursor model-pricing table.
 *
 * @param lines - Cursor Markdown split into lines.
 * @param section - Pricing-section definition.
 * @returns Models parsed from the section.
 * @throws {Error} If the section or its table has an unexpected structure.
 */
const parsePricingSection = (
  lines: readonly string[],
  section: PricingSection,
): CursorModelPrice[] => {
  const sectionStart = lines.findIndex((line) =>
    section.heading.test(line.trim()),
  );

  if (sectionStart === -1) {
    throw new Error(`Missing "${section.label}" section`);
  }

  const sectionEnd = findSectionEnd(lines, sectionStart);
  const tableStart = findTableStart(lines, sectionStart + 1, sectionEnd);

  if (tableStart === -1) {
    throw new Error(`Missing "${section.label}" pricing table`);
  }

  const headers = splitTableRow(lines[tableStart]).map(normalizeHeader);

  const columnIndex = new Map(headers.map((header, index) => [header, index]));

  const modelColumn = getModelColumn(columnIndex, section.label);

  const requiredColumns = ["input", "cache write", "cache read", "output"];

  for (const column of requiredColumns) {
    if (!columnIndex.has(column)) {
      throw new Error(`Missing pricing column "${column}" in ${section.label}`);
    }
  }

  const hasProviderColumn = columnIndex.has("provider");
  const hasNotesColumn = columnIndex.has("notes");

  if (!hasProviderColumn && !section.fallbackProvider) {
    throw new Error(`Missing pricing column "provider" in ${section.label}`);
  }

  const results: CursorModelPrice[] = [];

  // Skip the table header and separator rows.
  for (let index = tableStart + 2; index < sectionEnd; index++) {
    const line = lines[index];

    if (!line.trim()) {
      break;
    }

    const cells = splitTableRow(line);

    if (cells.length !== headers.length) {
      throw new Error(`Unexpected column count on Markdown line ${index + 1}`);
    }

    const model = parseModelCell(getCell(cells, columnIndex, modelColumn));

    const notes = hasNotesColumn
      ? markdownText(getCell(cells, columnIndex, "notes")) || null
      : null;

    const providerFromTable = hasProviderColumn
      ? markdownText(getCell(cells, columnIndex, "provider"))
      : "";

    const provider = providerFromTable || section.fallbackProvider;

    if (!provider) {
      throw new Error(`Missing provider on Markdown line ${index + 1}`);
    }

    results.push({
      model: model.name,
      modelUrl: model.url,
      provider,
      usagePool: section.usagePool,
      inputPerMillion: parsePrice(getCell(cells, columnIndex, "input"), index),
      cacheWritePerMillion: parseNullablePrice(
        getCell(cells, columnIndex, "cache write"),
        index,
      ),
      cacheReadPerMillion: parseNullablePrice(
        getCell(cells, columnIndex, "cache read"),
        index,
      ),
      outputPerMillion: parsePrice(
        getCell(cells, columnIndex, "output"),
        index,
      ),
      requiresLegacyMaxMode: parseRequiresLegacyMaxMode(notes),
      notes,
    });
  }

  if (!results.length) {
    throw new Error(`The "${section.label}" pricing table contains no models`);
  }

  return results;
};

/**
 * Extracts all model-pricing tables from Cursor's Markdown document.
 *
 * The parser reads both the Cursor Models and Other Models tables, validates
 * their expected columns, and converts their prices into structured records.
 *
 * @param markdown - Cursor's complete models-and-pricing Markdown.
 * @returns Models from both Cursor pricing pools.
 * @throws {Error} If a pricing section, table, column, row, or price does not
 * match the expected format.
 */
export const parseCursorModelPrices = (
  markdown: string,
): CursorModelPrice[] => {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");

  const results = PRICING_SECTIONS.flatMap((section) =>
    parsePricingSection(lines, section),
  );

  if (!results.length) {
    throw new Error("The pricing tables contain no models");
  }

  return results;
};
