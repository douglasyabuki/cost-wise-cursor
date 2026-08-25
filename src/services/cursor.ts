import { queryOptions } from "@tanstack/react-query";

import type { CursorModelPrice } from "@/types-and-constants/cursor";
import { request } from "@/utils/api";
import { parseCursorModelPrices } from "@/utils/cursor-model-prices";

const CURSOR_QUERY_ROOT = ["cursor"] as const;
const CURSOR_MODEL_PRICES_URL = "/cursor-docs/docs/models-and-pricing.md";

/**
 * Parses Cursor's model-pricing Markdown response.
 *
 * @param response - Successful HTTP response containing Markdown.
 * @returns Cursor model prices extracted from the Markdown table.
 */
const parseModelPricesResponse = async (
  response: Response,
): Promise<CursorModelPrice[]> => {
  const markdown = await response.text();

  return parseCursorModelPrices(markdown);
};

/**
 * Query keys used by Cursor-related TanStack Query operations.
 */
export const cursorQueryKeys = {
  all: CURSOR_QUERY_ROOT,

  /**
   * Returns the query key for Cursor model prices.
   *
   * @returns Stable TanStack Query key.
   */
  modelPrices: () => [...CURSOR_QUERY_ROOT, "model-prices"] as const,
} as const;

/**
 * Provides TanStack Query configurations for Cursor data.
 */
export const CursorService = {
  /**
   * Returns the query configuration for Cursor model prices.
   *
   * TanStack Query passes its AbortSignal to the request function,
   * allowing requests to be cancelled when the query becomes obsolete
   * or when `queryClient.cancelQueries()` is called.
   *
   * @returns TanStack Query options for Cursor model prices.
   */
  getModelPrices: () =>
    queryOptions({
      queryKey: cursorQueryKeys.modelPrices(),

      queryFn: ({ signal }) =>
        request<CursorModelPrice[]>(CURSOR_MODEL_PRICES_URL, {
          signal,
          parse: parseModelPricesResponse,
        }),

      // Cursor pricing is unlikely to change frequently.
      staleTime: 60 * 60 * 1_000,

      // Keep unused cached data for 24 hours.
      gcTime: 24 * 60 * 60 * 1_000,

      retry: 2,
    }),
} as const;
