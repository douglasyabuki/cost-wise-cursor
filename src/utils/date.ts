type Timestamp = string | number | Date | null | undefined;

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

  const date =
    timestamp instanceof Date
      ? new Date(timestamp.getTime())
      : typeof timestamp === "number"
        ? new Date(timestamp)
        : new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
};
