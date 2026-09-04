/**
 * A selected benchmark configuration used to compare model efficiency.
 */
export interface ModelEfficiencyCandidate {
  config: string;
  model: string;
  score: number;
  cost: number | null;
}

/**
 * Returns whether a candidate is beaten by another model on cost and score.
 *
 * @param candidate - Configuration being evaluated.
 * @param candidates - Currently selected benchmark configurations.
 * @returns Whether another model has lower cost and at least the same score.
 */
const isCandidateOutperformed = (
  candidate: ModelEfficiencyCandidate,
  candidates: readonly ModelEfficiencyCandidate[],
): boolean => {
  const candidateCost = candidate.cost;

  if (
    candidateCost === null ||
    !Number.isFinite(candidateCost) ||
    candidateCost <= 0 ||
    !Number.isFinite(candidate.score)
  ) {
    return false;
  }

  return candidates.some(
    (competitor) =>
      competitor.model !== candidate.model &&
      competitor.cost !== null &&
      Number.isFinite(competitor.cost) &&
      competitor.cost > 0 &&
      competitor.cost < candidateCost &&
      Number.isFinite(competitor.score) &&
      competitor.score >= candidate.score,
  );
};

/**
 * Returns selected configurations that are outperformed by another model.
 *
 * A configuration is outperformed when another model has a strictly lower
 * positive finite cost and an equal or higher finite score. The comparison is
 * performed independently for every selected configuration, so one model can
 * retain useful levels while its outperformed levels are hidden.
 *
 * @param candidates - Currently selected benchmark configurations.
 * @example
 * ```ts
 * const hiddenConfigIds = getLessEfficientConfigIds(candidates);
 * const visibleRows = rows.filter((row) => !hiddenConfigIds.has(row.config));
 * ```
 *
 * @returns Stable configuration identifiers that should be hidden.
 */
export const getLessEfficientConfigIds = (
  candidates: readonly ModelEfficiencyCandidate[],
): ReadonlySet<string> => {
  const lessEfficientConfigIds = new Set<string>();

  candidates.forEach((candidate) => {
    if (isCandidateOutperformed(candidate, candidates)) {
      lessEfficientConfigIds.add(candidate.config);
    }
  });

  return lessEfficientConfigIds;
};
