import type { DeepSweLeaderboardRow } from "@/types-and-constants/deep-swe";

export type ModelMatchStrategy = "exact" | "alias" | "token-order";

/**
 * Describes a successful match between a DeepSWE model and a Cursor model.
 */
export interface CursorModelMatch<T> {
  cursorModel: T;
  cursorName: string;
  deepSweName: string;
  strategy: ModelMatchStrategy;
}

/**
 * DeepSWE row enriched with its corresponding Cursor model.
 */
export type MatchedLeaderboardRow<T> = DeepSweLeaderboardRow & {
  cursorMatch: CursorModelMatch<T> | null;
};

interface CursorModelCandidate<T> {
  cursorModel: T;
  cursorName: string;
  normalizedName: string;
  signature: string;
}

/**
 * Explicit mappings for models whose names differ semantically.
 *
 * Keys use the DeepSWE format. Values use the normalized Cursor format.
 */
const CURSOR_NAME_BY_DEEP_SWE_NAME: Readonly<Record<string, string>> = {
  "gemini-3-1-pro-preview": "gemini-3-1-pro",
};

/**
 * Converts a model name into a lowercase, hyphen-separated identifier.
 *
 * @param modelName - Model name from DeepSWE or Cursor.
 * @returns Normalized model name.
 *
 * @example
 * normalizeModelName("GPT-5.6 Sol");
 * // "gpt-5-6-sol"
 */
export const normalizeModelName = (modelName: string): string => {
  return modelName
    .normalize("NFKD")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

/**
 * Creates a model signature that preserves version order but ignores the
 * position of descriptive words.
 *
 * This allows "Claude 4.6 Sonnet" to match "claude-sonnet-4-6" without
 * treating versions such as 4.6 and 6.4 as equivalent.
 *
 * @param normalizedName - Normalized model name.
 * @returns Model identity signature.
 */
const createModelSignature = (normalizedName: string): string => {
  const tokens = normalizedName.split("-").filter(Boolean);

  const versionTokens = tokens.filter((token) => /^\d+$/.test(token));

  const identityTokens = tokens.filter((token) => !/^\d+$/.test(token)).sort();

  return `${identityTokens.join("|")}::${versionTokens.join(".")}`;
};

/**
 * Creates a complete Cursor model match from a candidate.
 *
 * @param candidate - Matched Cursor model candidate.
 * @param deepSweName - Original DeepSWE model name.
 * @param strategy - Strategy used to find the match.
 * @returns Complete Cursor model match.
 */
const createCursorModelMatch = <T>(
  candidate: CursorModelCandidate<T>,
  deepSweName: string,
  strategy: ModelMatchStrategy,
): CursorModelMatch<T> => {
  return {
    cursorModel: candidate.cursorModel,
    cursorName: candidate.cursorName,
    deepSweName,
    strategy,
  };
};

/**
 * Finds the corresponding Cursor model for a DeepSWE model name.
 *
 * Matching order:
 * 1. Exact normalized name
 * 2. Explicit alias
 * 3. Same identity tokens and version, with different token order
 *
 * @param deepSweName - Canonical DeepSWE model name.
 * @param cursorModels - Cursor model records.
 * @param getCursorName - Returns the name from a Cursor model record.
 * @returns The matched Cursor model and strategy, or `null`.
 */
export const matchCursorModel = <T>(
  deepSweName: string,
  cursorModels: readonly T[],
  getCursorName: (model: T) => string,
): CursorModelMatch<T> | null => {
  const normalizedDeepSweName = normalizeModelName(deepSweName);

  if (!normalizedDeepSweName) {
    return null;
  }

  const candidates: CursorModelCandidate<T>[] = cursorModels.map(
    (cursorModel) => {
      const cursorName = getCursorName(cursorModel);
      const normalizedName = normalizeModelName(cursorName);

      return {
        cursorModel,
        cursorName,
        normalizedName,
        signature: createModelSignature(normalizedName),
      };
    },
  );

  const exactMatch = candidates.find(
    ({ normalizedName }) => normalizedName === normalizedDeepSweName,
  );

  if (exactMatch) {
    return createCursorModelMatch(exactMatch, deepSweName, "exact");
  }

  const alias = CURSOR_NAME_BY_DEEP_SWE_NAME[normalizedDeepSweName];

  if (alias) {
    const aliasMatch = candidates.find(
      ({ normalizedName }) => normalizedName === alias,
    );

    if (aliasMatch) {
      return createCursorModelMatch(aliasMatch, deepSweName, "alias");
    }
  }

  const targetSignature = createModelSignature(normalizedDeepSweName);

  const signatureMatches = candidates.filter(
    ({ signature }) => signature === targetSignature,
  );

  const uniqueNames = new Set(
    signatureMatches.map(({ normalizedName }) => normalizedName),
  );

  // Refuse missing or ambiguous matches.
  if (signatureMatches.length === 0 || uniqueNames.size !== 1) {
    return null;
  }

  const signatureMatch = signatureMatches[0];

  if (!signatureMatch) {
    return null;
  }

  return createCursorModelMatch(signatureMatch, deepSweName, "token-order");
};

/**
 * Matches Cursor models to DeepSWE leaderboard rows.
 *
 * Each unique DeepSWE model is matched once, while every returned row receives
 * the same stable `cursorMatch` property.
 *
 * @param rows - DeepSWE leaderboard rows.
 * @param cursorModels - Cursor model records.
 * @param getCursorName - Returns the name from a Cursor model record.
 * @returns Leaderboard rows with their Cursor match or `null`.
 */
export const matchLeaderboardRows = <T>(
  rows: readonly DeepSweLeaderboardRow[],
  cursorModels: readonly T[],
  getCursorName: (model: T) => string,
): MatchedLeaderboardRow<T>[] => {
  const matchesByModel = new Map<string, CursorModelMatch<T> | null>();

  rows.forEach((row) => {
    if (matchesByModel.has(row.model)) {
      return;
    }

    matchesByModel.set(
      row.model,
      matchCursorModel(row.model, cursorModels, getCursorName),
    );
  });

  return rows.map((row) => ({
    ...row,
    cursorMatch: matchesByModel.get(row.model) ?? null,
  }));
};
