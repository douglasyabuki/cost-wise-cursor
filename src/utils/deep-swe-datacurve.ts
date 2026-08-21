import type {
  DeepSweLeaderboard,
  DeepSweLeaderboardRow,
} from "@/types-and-constants/deep-swe";

/**
 * Checks whether a value is a non-null object.
 *
 * @param value - Value to inspect.
 * @returns Whether the value is an object record.
 */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/**
 * Checks the minimum expected structure of a leaderboard row.
 *
 * @param value - Value to inspect.
 * @returns Whether the value resembles a leaderboard row.
 */
const isLeaderboardRow = (value: unknown): value is DeepSweLeaderboardRow =>
  isRecord(value) &&
  typeof value.model === "string" &&
  typeof value.harness === "string" &&
  (typeof value.reasoning_effort === "string" ||
    value.reasoning_effort === null) &&
  typeof value.config === "string" &&
  typeof value.source === "string" &&
  typeof value.pass_at_1 === "number" &&
  typeof value.n_attempted === "number";

/**
 * Parses and validates a DeepSWE leaderboard payload.
 *
 * @param value - Decoded JSON payload returned by DeepSWE.
 * @returns Parsed leaderboard data.
 * @throws {Error} When the payload structure is invalid.
 */
export const parseDeepSweLeaderboard = (value: unknown): DeepSweLeaderboard => {
  if (
    !isRecord(value) ||
    typeof value.scope !== "string" ||
    typeof value.unit !== "string" ||
    typeof value.generated_at !== "string" ||
    typeof value.n_tasks_in_set !== "number" ||
    !Array.isArray(value.rows) ||
    !value.rows.every(isLeaderboardRow)
  ) {
    throw new Error("DeepSWE returned an invalid leaderboard response");
  }

  return value as unknown as DeepSweLeaderboard;
};
