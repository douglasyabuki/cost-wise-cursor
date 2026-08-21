import { queryOptions } from "@tanstack/react-query";

import type { DeepSweLeaderboard } from "@/types-and-constants/deep-swe";
import { request } from "@/utils/api";
import { parseDeepSweLeaderboard } from "@/utils/deep-swe-datacurve";

const DEEP_SWE_QUERY_ROOT = ["deep-swe"] as const;
const DEEP_SWE_LEADERBOARD_URL =
  "/deep-swe/artifacts/v1/leaderboard-live.json";

/**
 * Parses and validates a DeepSWE leaderboard response.
 *
 * @param response - Successful JSON response.
 * @returns Parsed leaderboard data.
 * @throws When the response structure is invalid.
 */
const parseLeaderboardResponse = async (
  response: Response,
): Promise<DeepSweLeaderboard> => {
  return parseDeepSweLeaderboard(await response.json());
};

/**
 * Query keys for DeepSWE data.
 */
export const deepSweQueryKeys = {
  all: DEEP_SWE_QUERY_ROOT,

  /**
   * Returns the live leaderboard query key.
   *
   * @returns Stable TanStack Query key.
   */
  leaderboard: () => [...DEEP_SWE_QUERY_ROOT, "leaderboard"] as const,
} as const;

/**
 * TanStack Query configurations for DeepSWE data.
 */
export const DeepSweService = {
  /**
   * Returns the live leaderboard query configuration.
   *
   * @returns TanStack Query options for the leaderboard.
   */
  getLeaderboard: () =>
    queryOptions({
      queryKey: deepSweQueryKeys.leaderboard(),
      queryFn: ({ signal }) =>
        request<DeepSweLeaderboard>(DEEP_SWE_LEADERBOARD_URL, {
          signal,
          headers: {
            Accept: "application/json",
          },
          parse: parseLeaderboardResponse,
        }),
      staleTime: 15 * 60 * 1_000,
      gcTime: 24 * 60 * 60 * 1_000,
      retry: 2,
    }),
} as const;
