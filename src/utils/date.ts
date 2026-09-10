type Timestamp = string | number | Date | null | undefined;

const CALENDAR_DATE_PATTERN =
  /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),\s+(\d{4})$/i;
const CALENDAR_MONTHS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
] as const;

/**
 * Parses a source calendar date without interpreting it as a UTC timestamp.
 *
 * @param value - Date value to parse.
 * @returns A local-calendar Date, or `null` when the value is invalid.
 */
const parseDate = (
  value: Exclude<Timestamp, null | undefined | "">,
): Date | null => {
  if (typeof value === "string") {
    const calendarMatch = value.trim().match(CALENDAR_DATE_PATTERN);

    if (calendarMatch) {
      const month = CALENDAR_MONTHS.indexOf(
        calendarMatch[1].toLowerCase() as (typeof CALENDAR_MONTHS)[number],
      );
      const day = Number(calendarMatch[2]);
      const year = Number(calendarMatch[3]);
      const date = new Date(year, month, day);

      if (
        month === -1 ||
        date.getFullYear() !== year ||
        date.getMonth() !== month ||
        date.getDate() !== day
      ) {
        return null;
      }

      return date;
    }
  }

  const date =
    value instanceof Date ? new Date(value.getTime()) : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * Formats a timestamp as a long English date.
 *
 * @param timestamp - Date value to format.
 * @returns A date such as "August 25, 2026", or `null` when invalid.
 */
export const formatLongDate = (timestamp: Timestamp): string | null => {
  if (timestamp == null || timestamp === "") {
    return null;
  }

  const date = parseDate(timestamp);

  if (!date) return null;

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
};
