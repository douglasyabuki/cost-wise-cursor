import { keepPreviousData, queryOptions } from "@tanstack/react-query";

import type {
  DeepSweLeaderboard,
  DeepSweVersion,
} from "@/types-and-constants/deep-swe";
import { request } from "@/utils/api";
import { parseDeepSweLeaderboard } from "@/utils/deep-swe-datacurve";

const DEFAULT_DEEP_SWE_VERSION: DeepSweVersion = "v1";

const DEEP_SWE_QUERY_ROOT = ["deep-swe"] as const;

const DEEP_SWE_LEADERBOARD_URLS = {
  "v1.1": "/deep-swe/artifacts/v1.1/leaderboard-live.json",
  v1: "/deep-swe/artifacts/v1/leaderboard-live.json",
} as const satisfies Record<DeepSweVersion, string>;

/**
 * Parses and validates a DeepSWE leaderboard response.
 *
 * @param response - Successful JSON response.
 * @returns Parsed leaderboard data.
 * @throws When the response structure is invalid.
 */
const parseLeaderboardResponse = async (
  response: Response,
): Promise<DeepSweLeaderboard> =>
  parseDeepSweLeaderboard(await response.json());

/**
 * Fetches a DeepSWE leaderboard.
 *
 * @param version - DeepSWE benchmark version.
 * @param signal - Request cancellation signal.
 * @returns Parsed leaderboard data.
 */
const fetchLeaderboard = (
  version: DeepSweVersion,
  signal?: AbortSignal,
): Promise<DeepSweLeaderboard> =>
  request<DeepSweLeaderboard>(DEEP_SWE_LEADERBOARD_URLS[version], {
    signal,
    headers: {
      Accept: "application/json",
    },
    parse: parseLeaderboardResponse,
  });

/**
 * Query keys for DeepSWE data.
 */
export const deepSweQueryKeys = {
  all: DEEP_SWE_QUERY_ROOT,

  /**
   * Returns the leaderboard query key for a version.
   *
   * @param version - DeepSWE benchmark version.
   * @returns Stable TanStack Query key.
   */
  leaderboard: (version: DeepSweVersion = DEFAULT_DEEP_SWE_VERSION) =>
    [...DEEP_SWE_QUERY_ROOT, "leaderboard", version] as const,
} as const;

/**
 * TanStack Query configurations for DeepSWE data.
 */
export const DeepSweService = {
  /**
   * Returns the leaderboard query configuration.
   *
   * @param version - DeepSWE benchmark version.
   * @returns TanStack Query options for the leaderboard.
   */
  getLeaderboard: (version: DeepSweVersion = DEFAULT_DEEP_SWE_VERSION) =>
    queryOptions({
      queryKey: deepSweQueryKeys.leaderboard(version),

      queryFn: ({ signal }) => fetchLeaderboard(version, signal),

      // Preserve the previous chart while changing versions.
      placeholderData: keepPreviousData,

      staleTime: 15 * 60 * 1_000,
      gcTime: 24 * 60 * 60 * 1_000,
      retry: 2,
    }),
} as const;
