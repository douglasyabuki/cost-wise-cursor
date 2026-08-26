/**
 * Finds the end of a Markdown section.
 *
 * The section ends when another heading of level one through three is
 * encountered. If no later heading exists, the document's end is used.
 *
 * @param lines - The Markdown document split into lines.
 * @param sectionStart - The line index containing the section heading.
 * @returns The exclusive line index at which the section ends.
 */
export const findSectionEnd = (
  lines: readonly string[],
  sectionStart: number,
): number => {
  for (let index = sectionStart + 1; index < lines.length; index++) {
    const match = lines[index].trim().match(/^(#{1,3})\s+/);

    if (match) return index;
  }

  return lines.length;
};

/**
 * Locates the first valid GitHub-style Markdown table within a range.
 *
 * A valid table starts with a header row followed by a separator row
 * whose cells contain at least three hyphens and optional alignment
 * colons.
 *
 * @param lines - The Markdown document split into lines.
 * @param start - The inclusive starting line index.
 * @param end - The exclusive ending line index.
 * @returns The table-header line index, or `-1` when no table is found.
 */
export const findTableStart = (
  lines: readonly string[],
  start: number,
  end: number,
): number => {
  for (let index = start; index + 1 < end; index++) {
    const header = splitTableRow(lines[index]);
    const separator = splitTableRow(lines[index + 1]);

    if (
      header.length > 0 &&
      separator.length === header.length &&
      separator.every((cell) => /^:?-{3,}:?$/.test(cell.trim()))
    ) {
      return index;
    }
  }

  return -1;
};

/**
 * Splits a GitHub-style Markdown table row into individual cells.
 *
 * Leading and trailing table delimiters are ignored. Escaped pipe
 * characters, such as `\|`, remain part of their containing cell.
 *
 * @param line - A single Markdown table line.
 * @returns The trimmed table cells, or an empty array if the line does
 * not contain a table delimiter.
 */
export const splitTableRow = (line: string): string[] => {
  const row = line.trim();

  if (!row.includes("|")) return [];

  const start = row.startsWith("|") ? 1 : 0;

  const end =
    row.endsWith("|") && !isEscaped(row, row.length - 1)
      ? row.length - 1
      : row.length;

  const cells: string[] = [];
  let current = "";

  for (let index = start; index < end; index++) {
    const character = row[index];

    if (character === "|" && isEscaped(row, index)) {
      // Remove the escape slash already appended to the cell.
      current = current.slice(0, -1) + "|";
      continue;
    }

    if (character === "|") {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  cells.push(current.trim());

  return cells;
};

/**
 * Determines whether a character is escaped by an odd number of
 * consecutive backslashes.
 *
 * @param value - The complete string containing the character.
 * @param position - The character's zero-based position.
 * @returns `true` when the character is escaped.
 */
export const isEscaped = (value: string, position: number): boolean => {
  let backslashes = 0;

  for (let index = position - 1; index >= 0 && value[index] === "\\"; index--) {
    backslashes++;
  }

  return backslashes % 2 === 1;
};

/**
 * Extracts a model name and optional URL from a Markdown table cell.
 *
 * Cells containing a complete Markdown link return the link's label
 * and destination. Plain-text cells return a `null` URL.
 *
 * @param value - The raw Markdown model cell.
 * @returns The normalized model name and optional model URL.
 */
export const parseModelCell = (
  value: string,
): {
  name: string;
  url: string | null;
} => {
  const link = value.match(/^\[([^\]]+)]\(([^)]+)\)$/);

  if (!link) {
    return {
      name: markdownText(value),
      url: null,
    };
  }

  return {
    name: markdownText(link[1]),
    url: link[2],
  };
};

/**
 * Converts the limited inline Markdown used by Cursor's pricing table
 * into plain text.
 *
 * The conversion handles images, links, inline code, bold text, and
 * escaped Markdown punctuation. It is intentionally not a complete
 * general-purpose Markdown parser.
 *
 * @param value - The inline Markdown value.
 * @returns The normalized plain-text representation.
 */
export const markdownText = (value: string): string => {
  return value
    .replace(/!\[([^\]]*)]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\\([\\`*_[\]{}()#+\-.!|])/g, "$1")
    .trim();
};

/**
 * Normalizes a Markdown table header for case-insensitive lookup.
 *
 * @param value - The raw Markdown header cell.
 * @returns A lowercase, whitespace-normalized header name.
 */
export const normalizeHeader = (value: string): string => {
  return markdownText(value).toLowerCase().replace(/\s+/g, " ");
};

/**
 * Parses a price that may be unavailable.
 *
 * Empty strings and hyphens are converted to `null`. All other values
 * are parsed as dollar prices.
 *
 * @param value - The raw price cell.
 * @param line - The zero-based Markdown line index used in errors.
 * @returns The numeric price or `null` when unavailable.
 * @throws {Error} If a non-empty price has an unexpected format.
 */
export const parseNullablePrice = (
  value: string,
  line: number,
): number | null => {
  if (value === "-" || value === "") return null;
  return parsePrice(value, line);
};

/**
 * Parses a dollar-denominated price from a Markdown table cell.
 *
 * Supported values include `$2`, `$0.25`, and comma-separated values
 * such as `$1,000`.
 *
 * @param value - The raw price cell.
 * @param line - The zero-based Markdown line index used in errors.
 * @returns The numeric price.
 * @throws {Error} If the value is not a supported dollar price.
 */
export const parsePrice = (value: string, line: number): number => {
  const normalized = value.replaceAll(",", "");
  const match = normalized.match(/^\$(\d+(?:\.\d+)?)$/);

  if (!match) {
    throw new Error(`Unexpected price "${value}" on Markdown line ${line + 1}`);
  }

  return Number(match[1]);
};
