/**
 * Strategy used to match a benchmark model to a Cursor model.
 */
export type ModelMatchStrategy = "exact" | "alias" | "token-order";

/**
 * Describes a successful match between a benchmark model and a Cursor model.
 */
export interface CursorModelMatch<T> {
  cursorModel: T;
  cursorName: string;
  benchmarkName: string;
  strategy: ModelMatchStrategy;
}

/**
 * Benchmark row enriched with its corresponding Cursor model.
 */
export type CursorMatchedRow<Row extends { model: string }, T> = Row & {
  cursorMatch: CursorModelMatch<T> | null;
};

interface CursorModelCandidate<T> {
  cursorModel: T;
  cursorName: string;
  normalizedName: string;
  signature: string;
}

/**
 * Explicit mappings for benchmark model names whose names differ semantically.
 *
 * Keys use a benchmark format. Values use the normalized Cursor format.
 */
const CURSOR_NAME_BY_BENCHMARK_NAME: Readonly<Record<string, string>> = {
  "gemini-3-1-pro-preview": "gemini-3-1-pro",
};

/**
 * Converts a model name into a lowercase, hyphen-separated identifier.
 *
 * @param modelName - Model name from a benchmark or Cursor.
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
 * @param benchmarkName - Original benchmark model name.
 * @param strategy - Strategy used to find the match.
 * @returns Complete Cursor model match.
 */
const createCursorModelMatch = <T>(
  candidate: CursorModelCandidate<T>,
  benchmarkName: string,
  strategy: ModelMatchStrategy,
): CursorModelMatch<T> => {
  return {
    cursorModel: candidate.cursorModel,
    cursorName: candidate.cursorName,
    benchmarkName,
    strategy,
  };
};

/**
 * Finds the corresponding Cursor model for a benchmark model name.
 *
 * Matching order:
 * 1. Exact normalized name
 * 2. Explicit alias
 * 3. Same identity tokens and version, with different token order
 *
 * @param benchmarkName - Canonical benchmark model name.
 * @param cursorModels - Cursor model records.
 * @param getCursorName - Returns the name from a Cursor model record.
 * @returns The matched Cursor model and strategy, or `null`.
 */
export const matchCursorModel = <T>(
  benchmarkName: string,
  cursorModels: readonly T[],
  getCursorName: (model: T) => string,
): CursorModelMatch<T> | null => {
  const normalizedBenchmarkName = normalizeModelName(benchmarkName);

  if (!normalizedBenchmarkName) {
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
    ({ normalizedName }) => normalizedName === normalizedBenchmarkName,
  );

  if (exactMatch) {
    return createCursorModelMatch(exactMatch, benchmarkName, "exact");
  }

  const alias = CURSOR_NAME_BY_BENCHMARK_NAME[normalizedBenchmarkName];

  if (alias) {
    const aliasMatch = candidates.find(
      ({ normalizedName }) => normalizedName === alias,
    );

    if (aliasMatch) {
      return createCursorModelMatch(aliasMatch, benchmarkName, "alias");
    }
  }

  const targetSignature = createModelSignature(normalizedBenchmarkName);

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

  return createCursorModelMatch(signatureMatch, benchmarkName, "token-order");
};

/**
 * Matches Cursor models to benchmark leaderboard rows.
 *
 * Each unique benchmark model is matched once, while every returned row
 * receives the same stable `cursorMatch` property.
 *
 * @param rows - Benchmark leaderboard rows.
 * @param cursorModels - Cursor model records.
 * @param getCursorName - Returns the name from a Cursor model record.
 * @returns Leaderboard rows with their Cursor match or `null`.
 */
export const matchLeaderboardRows = <Row extends { model: string }, T>(
  rows: readonly Row[],
  cursorModels: readonly T[],
  getCursorName: (model: T) => string,
): CursorMatchedRow<Row, T>[] => {
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
