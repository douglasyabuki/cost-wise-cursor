import { queryOptions } from "@tanstack/react-query";

import type {
  FrontierCodeChangelog,
  FrontierCodeLeaderboard,
} from "@/types-and-constants/frontier-code";
import { request } from "@/utils/api";
import {
  parseFrontierCodeChangelog,
  parseFrontierCodeLeaderboard,
} from "@/utils/frontier-code";

const FRONTIER_CODE_QUERY_ROOT = ["frontier-code"] as const;
const FRONTIER_CODE_LEADERBOARD_URL =
  "/frontier-code/data/frontiercode-leaderboard/data.json";
const FRONTIER_CODE_PAGE_URL = "/frontier-code/frontiercode";

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
 * Parses a successful FrontierCode changelog response.
 *
 * @param response - Successful HTML response.
 * @returns Complete FrontierCode changelog history.
 */
const parseChangelogResponse = async (
  response: Response,
): Promise<FrontierCodeChangelog> =>
  parseFrontierCodeChangelog(await response.text());

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

  /**
   * Returns the stable query key for the complete changelog.
   *
   * @returns Stable TanStack Query key.
   */
  changelog: () => [...FRONTIER_CODE_QUERY_ROOT, "changelog"] as const,
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

  /**
   * Returns the query configuration for the complete FrontierCode changelog.
   *
   * @returns TanStack Query options for the changelog.
   */
  getChangelog: () =>
    queryOptions({
      queryKey: frontierCodeQueryKeys.changelog(),
      queryFn: ({ signal }) =>
        request<FrontierCodeChangelog>(FRONTIER_CODE_PAGE_URL, {
          signal,
          headers: {
            Accept: "text/html",
          },
          parse: parseChangelogResponse,
        }),
      staleTime: 60 * 60 * 1_000,
      gcTime: 24 * 60 * 60 * 1_000,
      retry: 2,
    }),
} as const;
