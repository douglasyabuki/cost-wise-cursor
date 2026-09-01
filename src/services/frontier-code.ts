import { queryOptions } from "@tanstack/react-query";

import type { FrontierCodeLeaderboard } from "@/types-and-constants/frontier-code";
import { request } from "@/utils/api";
import { parseFrontierCodeLeaderboard } from "@/utils/frontier-code";

const FRONTIER_CODE_QUERY_ROOT = ["frontier-code"] as const;
const FRONTIER_CODE_LEADERBOARD_URL =
  "/frontier-code/data/frontiercode-leaderboard/data.json";

/**
 * Parses a successful FrontierCode response as unknown before validation.
 *
 * @param response - Successful JSON response.
 * @returns Validated FrontierCode leaderboard data.
 */
const parseLeaderboardResponse = async (
  response: Response,
): Promise<FrontierCodeLeaderboard> =>
  parseFrontierCodeLeaderboard((await response.json()) as unknown);

/**
 * Query keys used by FrontierCode TanStack Query operations.
 */
export const frontierCodeQueryKeys = {
  all: FRONTIER_CODE_QUERY_ROOT,

  /**
   * Returns the stable query key for the complete leaderboard document.
   *
   * @returns Stable TanStack Query key.
   */
  leaderboard: () => [...FRONTIER_CODE_QUERY_ROOT, "leaderboard"] as const,
} as const;

/**
 * Provides TanStack Query configuration for the FrontierCode data document.
 */
export const FrontierCodeService = {
  /**
   * Returns the query configuration for the complete FrontierCode document.
   *
   * The document contains both versions. Version and subset selection happens
   * locally after this one request has been parsed.
   *
   * @returns TanStack Query options for FrontierCode data.
   */
  getLeaderboard: () =>
    queryOptions({
      queryKey: frontierCodeQueryKeys.leaderboard(),
      queryFn: ({ signal }) =>
        request<FrontierCodeLeaderboard>(FRONTIER_CODE_LEADERBOARD_URL, {
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
