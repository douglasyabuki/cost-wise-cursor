import { type ReactElement, useMemo, useState } from "react";

import type { BenchmarkChangelog as BenchmarkChangelogData } from "@/components/benchmarks/benchmark-changelog";
import {
  BenchmarkToggleFilter,
  type BenchmarkToggleFilterOption,
} from "@/components/benchmarks/filters/benchmark-toggle-filter";
import { ModelConfigurationFilter } from "@/components/benchmarks/filters/model-configuration-filter";
import { ModelEfficiencyToggle } from "@/components/benchmarks/filters/model-efficiency-toggle";
import { FrontierCodeEfficiencyChart } from "@/components/benchmarks/frontier-code/frontier-code-efficiency-chart";
import { FrontierCodePerformanceRanking } from "@/components/benchmarks/frontier-code/frontier-code-performance-ranking";
import type { CursorModelPrice } from "@/types-and-constants/cursor";
import type {
  FrontierCodeLeaderboard,
  FrontierCodeLeaderboardRow,
  FrontierCodeSubset,
  FrontierCodeVersion,
} from "@/types-and-constants/frontier-code";
import {
  type CursorMatchedRow,
  matchLeaderboardRows,
} from "@/utils/cursor-model-match";
import {
  compareFrontierCodeModelNames,
  getFrontierCodeReasoningEffortOrder,
  getFrontierCodeRows,
} from "@/utils/frontier-code";
import {
  getLessEfficientConfigIds,
  type ModelEfficiencyCandidate,
} from "@/utils/model-efficiency";

/**
 * FrontierCode data and controlled version/subset selection; changelog and Cursor pricing are optional.
 * Configuration filters are managed locally for each version/subset combination.
 */
export interface FrontierCodeDashboardProps {
  changelog?: BenchmarkChangelogData;
  cursorModelPrices?: readonly CursorModelPrice[];
  leaderboard: FrontierCodeLeaderboard;
  version: FrontierCodeVersion;
  subset: FrontierCodeSubset;
  onVersionChange: (version: FrontierCodeVersion) => void;
  onSubsetChange: (subset: FrontierCodeSubset) => void;
}

interface ConfigModelGroup {
  model: string;
  rows: FrontierCodeLeaderboardRow[];
}

interface CursorFilterConfigs {
  cursorConfigs: ReadonlySet<string>;
  cursorMatchedCount: number;
  cursorMaxIncludedConfigs: ReadonlySet<string>;
  cursorMaxMatchedCount: number;
}

const EMPTY_EXCLUDED_CONFIGS: ReadonlySet<string> = new Set();

const VERSION_OPTIONS = [
  { label: "v1.1", value: "v1.1" },
  { label: "v1", value: "v1" },
] as const satisfies readonly BenchmarkToggleFilterOption<FrontierCodeVersion>[];

const SUBSET_OPTIONS = [
  { label: "Main (100)", value: "main" },
  { label: "Extended (150)", value: "extended" },
] as const satisfies readonly BenchmarkToggleFilterOption<FrontierCodeSubset>[];

/**
 * Groups FrontierCode configurations by model for the shared filter.
 *
 * @param rows - Available configurations.
 * @returns Alphabetized model groups with semantic effort ordering.
 */
const groupRowsByModel = (
  rows: readonly FrontierCodeLeaderboardRow[],
): ConfigModelGroup[] => {
  const rowsByModel = new Map<string, FrontierCodeLeaderboardRow[]>();

  rows.forEach((row) => {
    const modelRows = rowsByModel.get(row.model) ?? [];
    modelRows.push(row);
    rowsByModel.set(row.model, modelRows);
  });

  return [...rowsByModel.entries()]
    .map(([model, modelRows]) => ({
      model,
      rows: [...modelRows].sort(
        (first, second) =>
          getFrontierCodeReasoningEffortOrder(first.reasoning_effort) -
            getFrontierCodeReasoningEffortOrder(second.reasoning_effort) ||
          first.reasoning_effort.localeCompare(second.reasoning_effort),
      ),
    }))
    .sort((first, second) =>
      compareFrontierCodeModelNames(first.model, second.model),
    );
};

/**
 * Builds the Cursor availability presets for FrontierCode rows.
 *
 * @param rows - FrontierCode rows enriched with Cursor matches.
 * @returns Preset configuration identifiers and model counts.
 */
const createCursorFilterConfigs = (
  rows: readonly CursorMatchedRow<
    FrontierCodeLeaderboardRow,
    CursorModelPrice
  >[],
): CursorFilterConfigs => {
  const cursorConfigs = new Set<string>();
  const cursorMaxIncludedConfigs = new Set<string>();
  const cursorModels = new Set<string>();
  const cursorMaxModels = new Set<string>();

  rows.forEach((row) => {
    if (row.cursorMatch === null) return;

    cursorMaxIncludedConfigs.add(row.config);

    if (row.cursorMatch.cursorModel.requiresLegacyMaxMode) {
      cursorMaxModels.add(row.model);
      return;
    }

    cursorConfigs.add(row.config);
    cursorModels.add(row.model);
  });

  return {
    cursorConfigs,
    cursorMatchedCount: cursorModels.size,
    cursorMaxIncludedConfigs,
    cursorMaxMatchedCount: cursorMaxModels.size,
  };
};

/**
 * Renders the FrontierCode dashboard for a selected version and subset.
 *
 * Configuration selection is kept independently for every version/subset
 * combination. The charts share the resulting filtered rows.
 *
 * @param props - FrontierCode data, controls, and Cursor pricing records.
 * @returns FrontierCode controls and visualizations.
 */
export const FrontierCodeDashboard = ({
  changelog,
  cursorModelPrices,
  leaderboard,
  onSubsetChange,
  onVersionChange,
  subset,
  version,
}: FrontierCodeDashboardProps): ReactElement => {
  const rows = useMemo(
    () => getFrontierCodeRows(leaderboard, version, subset),
    [leaderboard, subset, version],
  );
  const matchedRows = useMemo(
    () =>
      matchLeaderboardRows(
        rows,
        cursorModelPrices ?? [],
        (cursorModel) => cursorModel.model,
      ),
    [cursorModelPrices, rows],
  );
  const cursorFilterConfigs = useMemo(
    () => createCursorFilterConfigs(matchedRows),
    [matchedRows],
  );
  const configModels = useMemo(
    () =>
      groupRowsByModel(rows).map((group) => ({
        model: group.model,
        rows: group.rows.map((row) => ({
          config: row.config,
          effort: row.reasoning_effort,
          title: `${row.reasoning_effort.toUpperCase()} \u00b7 score ${(row.score * 100).toFixed(1)}% \u00b7 pass rate ${(row.pass_rate * 100).toFixed(1)}%`,
        })),
      })),
    [rows],
  );

  const [excludedConfigsBySelection, setExcludedConfigsBySelection] = useState<
    Partial<
      Record<
        FrontierCodeVersion,
        Partial<Record<FrontierCodeSubset, Set<string>>>
      >
    >
  >({});
  const excludedConfigs =
    excludedConfigsBySelection[version]?.[subset] ?? EMPTY_EXCLUDED_CONFIGS;
  const selectedConfigs = useMemo(
    () =>
      new Set(
        matchedRows
          .filter((row) => !excludedConfigs.has(row.config))
          .map((row) => row.config),
      ),
    [excludedConfigs, matchedRows],
  );
  const selectedRows = useMemo(
    () => matchedRows.filter((row) => selectedConfigs.has(row.config)),
    [matchedRows, selectedConfigs],
  );
  const selectedModelCount = useMemo(
    () => new Set(selectedRows.map((row) => row.model)).size,
    [selectedRows],
  );

  const [
    showMoreEfficientOnlyBySelection,
    setShowMoreEfficientOnlyBySelection,
  ] = useState<
    Partial<
      Record<FrontierCodeVersion, Partial<Record<FrontierCodeSubset, boolean>>>
    >
  >({});
  const showMoreEfficientOnly =
    showMoreEfficientOnlyBySelection[version]?.[subset] ?? false;
  const hiddenConfigIds = useMemo(() => {
    if (!showMoreEfficientOnly) {
      return new Set<string>();
    }

    const candidates: ModelEfficiencyCandidate[] = selectedRows.map((row) => ({
      config: row.config,
      model: row.model,
      score: row.score,
      cost: row.cost,
    }));

    return getLessEfficientConfigIds(candidates);
  }, [selectedRows, showMoreEfficientOnly]);
  const visibleRows = useMemo(
    () => selectedRows.filter((row) => !hiddenConfigIds.has(row.config)),
    [hiddenConfigIds, selectedRows],
  );
  const hiddenConfigKey = [...hiddenConfigIds].sort().join("|");

  /**
   * Updates excluded configurations for the active version/subset.
   *
   * @param update - State transformation for the current exclusion set.
   */
  const updateExcludedConfigs = (
    update: (current: ReadonlySet<string>) => Set<string>,
  ): void => {
    setExcludedConfigsBySelection((current) => ({
      ...current,
      [version]: {
        ...current[version],
        [subset]: update(current[version]?.[subset] ?? EMPTY_EXCLUDED_CONFIGS),
      },
    }));
  };

  /**
   * Selects or hides every effort belonging to a model.
   *
   * @param configs - Configuration ids belonging to the model.
   */
  const handleModelToggle = (configs: readonly string[]): void => {
    const shouldShowAll = configs.some(
      (config) => !selectedConfigs.has(config),
    );

    updateExcludedConfigs((current) => {
      const next = new Set(current);
      configs.forEach((config) => {
        if (shouldShowAll) next.delete(config);
        else next.add(config);
      });
      return next;
    });
  };

  /**
   * Applies an exact effort-level selection to one model.
   *
   * @param configs - All configuration ids belonging to the model.
   * @param nextSelectedConfigs - Configuration ids that should be selected.
   */
  const handleLevelsToggle = (
    configs: readonly string[],
    nextSelectedConfigs: ReadonlySet<string>,
  ): void => {
    updateExcludedConfigs((current) => {
      const next = new Set(current);
      configs.forEach((config) => {
        if (nextSelectedConfigs.has(config)) next.delete(config);
        else next.add(config);
      });
      return next;
    });
  };

  /** Removes one configuration from the active selection. */
  const handleRemoveConfig = (config: string): void => {
    updateExcludedConfigs((current) => new Set(current).add(config));
  };

  /** Adds one configuration back to the active selection. */
  const handleAddConfig = (config: string): void => {
    updateExcludedConfigs((current) => {
      const next = new Set(current);
      next.delete(config);
      return next;
    });
  };

  /** Adds every configuration for a model back to the active selection. */
  const handleAddModel = (model: string): void => {
    updateExcludedConfigs((current) => {
      const next = new Set(current);
      matchedRows.forEach((row) => {
        if (row.model === model) next.delete(row.config);
      });
      return next;
    });
  };

  /** Removes every configuration for a model from the active selection. */
  const handleRemoveModel = (model: string): void => {
    updateExcludedConfigs((current) => {
      const next = new Set(current);
      matchedRows.forEach((row) => {
        if (row.model === model) next.add(row.config);
      });
      return next;
    });
  };

  /**
   * Replaces the active selection with an exact set of configurations.
   *
   * @param configs - Configuration ids to select.
   */
  const handleSelectConfigs = (configs: ReadonlySet<string>): void => {
    updateExcludedConfigs(
      () =>
        new Set(
          matchedRows
            .filter((row) => !configs.has(row.config))
            .map((row) => row.config),
        ),
    );
  };

  /**
   * Updates whether the charts show only more efficient models.
   *
   * @param nextShowMoreEfficientOnly - Whether to show only more efficient models.
   */
  const handleMoreEfficientOnlyChange = (
    nextShowMoreEfficientOnly: boolean,
  ): void => {
    setShowMoreEfficientOnlyBySelection((current) => ({
      ...current,
      [version]: {
        ...current[version],
        [subset]: nextShowMoreEfficientOnly,
      },
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="grid gap-1.5">
          <span className="text-muted-foreground text-xs font-medium">
            Version
          </span>
          <BenchmarkToggleFilter
            label="FrontierCode version"
            onChange={onVersionChange}
            options={VERSION_OPTIONS}
            value={version}
          />
        </div>

        <div className="grid gap-1.5">
          <span className="text-muted-foreground text-xs font-medium">
            Subset
          </span>
          <BenchmarkToggleFilter
            label="FrontierCode subset"
            onChange={onSubsetChange}
            options={SUBSET_OPTIONS}
            value={subset}
          />
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <ModelEfficiencyToggle
            hiddenConfigurationCount={hiddenConfigIds.size}
            modelCount={selectedModelCount}
            onShowMoreEfficientOnlyChange={handleMoreEfficientOnlyChange}
            showMoreEfficientOnly={showMoreEfficientOnly}
          />

          <ModelConfigurationFilter
            cursorMatchedCount={cursorFilterConfigs.cursorMatchedCount}
            cursorMaxMatchedCount={cursorFilterConfigs.cursorMaxMatchedCount}
            hiddenConfigIds={hiddenConfigIds}
            models={configModels}
            onHideAll={() => handleSelectConfigs(new Set())}
            onSelectCursorModels={() =>
              handleSelectConfigs(cursorFilterConfigs.cursorConfigs)
            }
            onSelectCursorModelsWithMax={() =>
              handleSelectConfigs(cursorFilterConfigs.cursorMaxIncludedConfigs)
            }
            onShowAll={() =>
              handleSelectConfigs(new Set(matchedRows.map((row) => row.config)))
            }
            onToggleLevels={handleLevelsToggle}
            onToggleModel={handleModelToggle}
            selectedConfigs={selectedConfigs}
            totalCount={matchedRows.length}
          />
        </div>
      </div>

      <FrontierCodeEfficiencyChart
        availableRows={matchedRows}
        changelog={changelog}
        key={`${version}-${subset}-comparison-${hiddenConfigKey}`}
        onAddConfig={handleAddConfig}
        onAddModel={handleAddModel}
        onRemoveConfig={handleRemoveConfig}
        onRemoveModel={handleRemoveModel}
        rows={visibleRows}
        showAllPointLabels={showMoreEfficientOnly}
        showModelLines={!showMoreEfficientOnly}
      />
      <FrontierCodePerformanceRanking
        key={`${version}-${subset}-ranking-${hiddenConfigKey}`}
        rows={visibleRows}
      />
    </div>
  );
};
