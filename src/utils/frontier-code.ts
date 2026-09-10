import type {
  FrontierCodeChangelog,
  FrontierCodeLeaderboard,
  FrontierCodeLeaderboardRow,
  FrontierCodeResult,
  FrontierCodeSubset,
  FrontierCodeVersion,
  FrontierCodeVersionData,
} from "@/types-and-constants/frontier-code";

const FRONTIER_CODE_VERSION_KEY: Readonly<
  Record<FrontierCodeVersion, "v1" | "v1_1">
> = {
  v1: "v1",
  "v1.1": "v1_1",
};

const FRONTIER_CODE_REASONING_EFFORT_ORDER = [
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
] as const;

const FRONTIER_CODE_CHANGELOG_DATE_PATTERN =
  /^(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4}$/i;

const modelNameCollator = new Intl.Collator("en-US", {
  numeric: true,
  sensitivity: "base",
});

/**
 * Checks whether a value is a non-null object record.
 *
 * @param value - Value to inspect.
 * @returns Whether the value is an object record.
 */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/**
 * Checks whether a value is a finite number.
 *
 * @param value - Value to inspect.
 * @returns Whether the value is finite numeric data.
 */
const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/**
 * Normalizes text extracted from the upstream HTML document.
 *
 * @param value - Text content from the parsed document.
 * @returns Trimmed text with internal whitespace collapsed.
 */
const normalizeFrontierCodeHtmlText = (value: string): string =>
  value.replace(/\s+/g, " ").trim();

/**
 * Checks whether an element occurs after another element in document order.
 *
 * @param element - Element whose position is being checked.
 * @param reference - Reference element in the document.
 * @returns Whether the element occurs after the reference.
 */
const isFrontierCodeElementAfter = (
  element: Element,
  reference: Element,
): boolean =>
  !reference.contains(element) &&
  Boolean(
    element.compareDocumentPosition(reference) &
    Node.DOCUMENT_POSITION_PRECEDING,
  );

/**
 * Checks whether an element occurs before another element in document order.
 *
 * @param element - Element whose position is being checked.
 * @param reference - Reference element in the document.
 * @returns Whether the element occurs before the reference.
 */
const isFrontierCodeElementBefore = (
  element: Element,
  reference: Element,
): boolean =>
  Boolean(
    element.compareDocumentPosition(reference) &
    Node.DOCUMENT_POSITION_FOLLOWING,
  );

/**
 * Returns the non-empty leaf elements within an entry.
 *
 * @param entry - Changelog entry element.
 * @returns Leaf elements with normalized text content.
 */
const getFrontierCodeEntryTextLeaves = (
  entry: Element,
): Array<{ element: Element; text: string }> =>
  Array.from(entry.querySelectorAll("*"))
    .filter(
      (element) =>
        !element.querySelector("*") &&
        !["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"].includes(element.tagName),
    )
    .map((element) => ({
      element,
      text: normalizeFrontierCodeHtmlText(element.textContent ?? ""),
    }))
    .filter(({ text }) => text.length > 0);

/**
 * Returns a category label that precedes a changelog list.
 *
 * @param list - List containing category update items.
 * @returns Category text, or `null` when no label can be identified.
 */
const getFrontierCodeCategory = (list: Element): string | null => {
  const parent = list.parentElement;

  if (!parent) return null;

  const label = Array.from(parent.children).find(
    (child) =>
      child !== list &&
      isFrontierCodeElementBefore(child, list) &&
      !child.querySelector("ul, ol, li") &&
      normalizeFrontierCodeHtmlText(child.textContent ?? ""),
  );

  return label ? normalizeFrontierCodeHtmlText(label.textContent ?? "") : null;
};

/**
 * Checks whether a list item is a leaf item rather than a nested-list wrapper.
 *
 * @param item - List item to inspect.
 * @returns Whether the item contains no nested list content.
 */
const isFrontierCodeLeafListItem = (item: Element): boolean =>
  item.tagName === "LI" && !item.querySelector("ul, ol");

/**
 * Validates a raw FrontierCode result.
 *
 * @param value - Value to inspect.
 * @returns Whether the value contains the required result metrics.
 */
const isFrontierCodeResult = (value: unknown): value is FrontierCodeResult =>
  isRecord(value) &&
  isFiniteNumber(value.correct) &&
  isFiniteNumber(value.new_score) &&
  isFiniteNumber(value.cost) &&
  (value.flagged_rate === undefined ||
    value.flagged_rate === null ||
    isFiniteNumber(value.flagged_rate));

/**
 * Validates one FrontierCode version payload.
 *
 * @param value - Value to inspect.
 * @returns Whether the value has the minimum version structure.
 */
const isFrontierCodeVersionData = (
  value: unknown,
): value is FrontierCodeVersionData => {
  if (!isRecord(value)) return false;

  if (
    !Array.isArray(value.models) ||
    value.models.length === 0 ||
    !value.models.every((model) => typeof model === "string") ||
    !isRecord(value.harness) ||
    !Object.values(value.harness).every(
      (harness) => typeof harness === "string",
    ) ||
    !isRecord(value.efforts) ||
    !Object.values(value.efforts).every(
      (efforts) =>
        Array.isArray(efforts) &&
        efforts.length > 0 &&
        efforts.every((effort) => typeof effort === "string"),
    ) ||
    !isRecord(value.subsets) ||
    !isFiniteNumber(value.subsets.main) ||
    !isFiniteNumber(value.subsets.extended) ||
    !isRecord(value.data)
  ) {
    return false;
  }

  const models = value.models;
  const harness = value.harness as Record<string, unknown>;
  const efforts = value.efforts as Record<string, unknown>;
  const data = value.data as Record<string, unknown>;

  return models.every((model) => {
    const modelData = data[model];
    const modelEfforts = efforts[model];

    return (
      typeof harness[model] === "string" &&
      Array.isArray(modelEfforts) &&
      isRecord(modelData) &&
      modelEfforts.every((effort) => {
        const effortData = modelData[effort];

        return (
          isRecord(effortData) &&
          isFrontierCodeResult(effortData.main) &&
          isFrontierCodeResult(effortData.extended)
        );
      })
    );
  });
};

/**
 * Parses and validates the complete FrontierCode response.
 *
 * @param value - Decoded JSON payload returned by Cognition.
 * @returns Validated FrontierCode data for both versions.
 * @throws {Error} When the payload is missing a required structure.
 */
export const parseFrontierCodeLeaderboard = (
  value: unknown,
): FrontierCodeLeaderboard => {
  if (
    !isRecord(value) ||
    !isFrontierCodeVersionData(value.v1) ||
    !isFrontierCodeVersionData(value.v1_1)
  ) {
    throw new Error("FrontierCode returned an invalid leaderboard response");
  }

  return {
    v1: value.v1,
    v1_1: value.v1_1,
  };
};

/**
 * Parses the complete FrontierCode Changelog section.
 *
 * HTML is parsed as inert markup and only validated text fields are returned.
 * The source is currently newest-first and groups lists by category within
 * each dated entry.
 *
 * @param html - HTML document returned by Cognition.
 * @returns Complete FrontierCode changelog history.
 * @throws {Error} When the Changelog section or any entry is invalid.
 */
export const parseFrontierCodeChangelog = (
  html: string,
): FrontierCodeChangelog => {
  if (typeof DOMParser === "undefined") {
    throw new Error("FrontierCode changelog parsing is unavailable");
  }

  const document = new DOMParser().parseFromString(html, "text/html");
  const headings = Array.from(
    document.querySelectorAll("h1, h2, h3, h4, h5, h6"),
  );
  const changelogHeading = headings.find(
    (heading) =>
      normalizeFrontierCodeHtmlText(heading.textContent ?? "").toLowerCase() ===
      "changelog",
  );

  if (!changelogHeading) {
    throw new Error("FrontierCode returned an invalid changelog response");
  }

  const changelogSection = Array.from(
    document.querySelectorAll("section"),
  ).find((section) => isFrontierCodeElementAfter(section, changelogHeading));

  if (!changelogSection || changelogSection.children.length === 0) {
    throw new Error("FrontierCode returned an invalid changelog response");
  }

  return Array.from(changelogSection.children).map((entry) => {
    const date = getFrontierCodeEntryTextLeaves(entry).find(({ text }) =>
      FRONTIER_CODE_CHANGELOG_DATE_PATTERN.test(text),
    );
    const lists = Array.from(entry.querySelectorAll("ul, ol")).filter((list) =>
      Array.from(list.children).some(isFrontierCodeLeafListItem),
    );

    if (!date || lists.length === 0) {
      throw new Error("FrontierCode returned an invalid changelog response");
    }

    const sections = lists.map((list) => {
      const category = getFrontierCodeCategory(list);
      const items = Array.from(list.children)
        .filter(isFrontierCodeLeafListItem)
        .map((item) => normalizeFrontierCodeHtmlText(item.textContent ?? ""))
        .filter((item) => item.length > 0);

      if (!category || items.length === 0) {
        throw new Error("FrontierCode returned an invalid changelog response");
      }

      return { category, items };
    });

    return {
      date: date.text,
      sections,
    };
  });
};

/**
 * Returns the raw data for a user-facing FrontierCode version label.
 *
 * @param leaderboard - Complete FrontierCode response.
 * @param version - Selected version label.
 * @returns Raw data for the selected version.
 */
export const getFrontierCodeVersionData = (
  leaderboard: FrontierCodeLeaderboard,
  version: FrontierCodeVersion,
): FrontierCodeVersionData => leaderboard[FRONTIER_CODE_VERSION_KEY[version]];

/**
 * Creates a stable identifier for a model and reasoning-effort configuration.
 *
 * @param model - FrontierCode model name.
 * @param effort - Reasoning-effort label.
 * @returns Stable configuration identifier.
 */
export const createFrontierCodeConfigId = (
  model: string,
  effort: string,
): string => `${model}::${effort}`;

/**
 * Flattens one version and subset of the FrontierCode response into typed rows.
 *
 * @param leaderboard - Complete FrontierCode response.
 * @param version - Selected version label.
 * @param subset - Selected task subset.
 * @returns Rows containing one model and effort configuration each.
 */
export const getFrontierCodeRows = (
  leaderboard: FrontierCodeLeaderboard,
  version: FrontierCodeVersion,
  subset: FrontierCodeSubset,
): FrontierCodeLeaderboardRow[] => {
  const versionData = getFrontierCodeVersionData(leaderboard, version);

  return versionData.models.flatMap((model) => {
    const modelData = versionData.data[model];
    const modelEfforts = versionData.efforts[model] ?? [];

    if (!modelData) return [];

    return modelEfforts.flatMap((effort) => {
      const result = modelData[effort]?.[subset];

      if (!result) return [];

      return [
        {
          model,
          harness: versionData.harness[model],
          reasoning_effort: effort,
          config: createFrontierCodeConfigId(model, effort),
          score: result.new_score,
          pass_rate: result.correct,
          cost: result.cost,
          flagged_rate: result.flagged_rate ?? null,
        },
      ];
    });
  });
};

/**
 * Compares model names using natural, case-insensitive ordering.
 *
 * @param first - First model name.
 * @param second - Second model name.
 * @returns Array-sort comparison value.
 */
export const compareFrontierCodeModelNames = (
  first: string,
  second: string,
): number => modelNameCollator.compare(first, second);

/**
 * Returns a stable reasoning-effort ordering value.
 *
 * @param effort - Reasoning-effort label.
 * @returns Semantic order, with unknown values after known efforts.
 */
export const getFrontierCodeReasoningEffortOrder = (effort: string): number => {
  const index = FRONTIER_CODE_REASONING_EFFORT_ORDER.indexOf(
    effort.toLowerCase() as (typeof FRONTIER_CODE_REASONING_EFFORT_ORDER)[number],
  );

  return index === -1 ? FRONTIER_CODE_REASONING_EFFORT_ORDER.length : index;
};

/**
 * Formats a FrontierCode score as a percentage.
 *
 * @param value - Fractional score.
 * @returns Percentage with one decimal place.
 */
export const formatFrontierCodeScore = (value: number): string =>
  `${(value * 100).toFixed(1)}%`;

/**
 * Formats a FrontierCode pass rate as a percentage.
 *
 * @param value - Fractional pass rate.
 * @returns Percentage with one decimal place.
 */
export const formatFrontierCodePassRate = (value: number): string =>
  `${(value * 100).toFixed(1)}%`;

/**
 * Formats a FrontierCode benchmark cost in US dollars.
 *
 * @param value - Benchmark cost.
 * @returns Dollar value with two decimal places.
 */
export const formatFrontierCodeCost = (value: number): string =>
  `$${value.toFixed(2)}`;

/**
 * Calculates FrontierCode score percentage points per benchmark dollar.
 *
 * @param row - FrontierCode configuration row.
 * @returns Cost-efficiency score or null when cost is unusable.
 */
export const getFrontierCodeCostEfficiency = (
  row: FrontierCodeLeaderboardRow,
): number | null =>
  Number.isFinite(row.cost) && row.cost > 0
    ? (row.score * 100) / row.cost
    : null;

/**
 * Formats a FrontierCode cost-efficiency score.
 *
 * @param value - Percentage points per benchmark dollar.
 * @returns Formatted efficiency value.
 */
export const formatFrontierCodeCostEfficiency = (
  value: number | null,
): string => (value === null ? "—" : `${value.toFixed(1)} pts/$`);

/**
 * Formats a selected FrontierCode subset for UI copy.
 *
 * @param subset - Selected subset.
 * @returns Human-readable subset label.
 */
export const formatFrontierCodeSubset = (subset: FrontierCodeSubset): string =>
  subset === "main" ? "Main (100)" : "Extended (150)";
