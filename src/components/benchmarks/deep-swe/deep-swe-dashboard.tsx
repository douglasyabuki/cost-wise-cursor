import { type ReactElement, useMemo, useState } from "react";

import type { BenchmarkChangelog as BenchmarkChangelogData } from "@/components/benchmarks/benchmark-changelog";
import { DeepSweEfficiencyChart } from "@/components/benchmarks/deep-swe/deep-swe-efficiency-chart";
import { DeepSwePerformanceRanking } from "@/components/benchmarks/deep-swe/deep-swe-performance-ranking";
import {
  BenchmarkToggleFilter,
  type BenchmarkToggleFilterOption,
} from "@/components/benchmarks/filters/benchmark-toggle-filter";
import { ModelConfigurationFilter } from "@/components/benchmarks/filters/model-configuration-filter";
import { ModelEfficiencyToggle } from "@/components/benchmarks/filters/model-efficiency-toggle";
import type { CursorModelPrice } from "@/types-and-constants/cursor";
import type {
  DeepSweLeaderboard,
  DeepSweLeaderboardRow,
  DeepSweVersion,
  EfficiencyMetric,
} from "@/types-and-constants/deep-swe";
import {
  type CursorMatchedRow,
  matchLeaderboardRows,
} from "@/utils/cursor-model-match";
import {
  compareModelNames,
  getReasoningEffort,
  getReasoningEffortOrder,
} from "@/utils/deep-swe";
import {
  getLessEfficientConfigIds,
  type ModelEfficiencyCandidate,
} from "@/utils/model-efficiency";

/**
 * DeepSWE data and controlled version selection; changelog and Cursor pricing are optional.
 * Configuration filters and the efficiency metric are managed locally.
 *
 * @property changelog - Optional benchmark changelog.
 * @property cursorModelPrices - Optional Cursor model pricing records for availability matching.
 * @property leaderboard - Parsed DeepSWE leaderboard data.
 * @property version - Currently selected benchmark version.
 * @property onVersionChange - Called when the selected version changes.
 */
export interface DeepSweDashboardProps {
  changelog?: BenchmarkChangelogData;
  cursorModelPrices?: readonly CursorModelPrice[];
  leaderboard: DeepSweLeaderboard;
  version: DeepSweVersion;
  onVersionChange: (version: DeepSweVersion) => void;
}

/**
 * Model configurations prepared for the shared configuration filter.
 *
 * @property model - Model identifier.
 * @property rows - Model configurations in reasoning-effort order.
 */
interface ConfigModelGroup {
  model: string;
  rows: DeepSweLeaderboardRow[];
}

/**
 * Cursor availability presets prepared for the configuration filter.
 *
 * @property cursorConfigs - Configurations for models without legacy Max Mode.
 * @property cursorMatchedCount - Number of matched models without legacy Max Mode.
 * @property cursorMaxIncludedConfigs - All matched configurations, including legacy Max Mode models.
 * @property cursorMaxMatchedCount - Number of matched models requiring legacy Max Mode.
 */
interface CursorFilterConfigs {
  cursorConfigs: ReadonlySet<string>;
  cursorMatchedCount: number;
  cursorMaxIncludedConfigs: ReadonlySet<string>;
  cursorMaxMatchedCount: number;
}

const VERSION_OPTIONS = [
  { label: "v1.1", value: "v1.1" },
  { label: "v1", value: "v1" },
] as const satisfies readonly BenchmarkToggleFilterOption<DeepSweVersion>[];

const EFFICIENCY_METRIC_OPTIONS = [
  { label: "Cost", value: "cost" },
  { label: "Output tokens", value: "outputTokens" },
  { label: "Agent steps", value: "agentSteps" },
] as const satisfies readonly BenchmarkToggleFilterOption<EfficiencyMetric>[];

/**
 * Groups configurations by model for the shared filter.
 *
 * Model names use natural alphabetical ordering. Reasoning levels retain their
 * semantic order.
 *
 * @param rows - Available leaderboard configurations.
 * @returns Alphabetized model groups.
 */
const groupRowsByModel = (
  rows: readonly DeepSweLeaderboardRow[],
): ConfigModelGroup[] => {
  const rowsByModel = new Map<string, DeepSweLeaderboardRow[]>();

  rows.forEach((row) => {
    const modelRows = rowsByModel.get(row.model) ?? [];

    modelRows.push(row);
    rowsByModel.set(row.model, modelRows);
  });

  return [...rowsByModel.entries()]
    .map(([model, modelRows]) => ({
      model,
      rows: [...modelRows].sort((first, second) => {
        const firstEffort = getReasoningEffort(first);
        const secondEffort = getReasoningEffort(second);

        return (
          getReasoningEffortOrder(firstEffort) -
            getReasoningEffortOrder(secondEffort) ||
          firstEffort.localeCompare(secondEffort)
        );
      }),
    }))
    .sort((first, second) => compareModelNames(first.model, second.model));
};

/**
 * Builds the two Cursor availability presets.
 *
 * @param rows - Leaderboard rows enriched with Cursor matches.
 * @returns Configuration identifiers and enabled-state counts.
 */
const createCursorFilterConfigs = (
  rows: readonly CursorMatchedRow<DeepSweLeaderboardRow, CursorModelPrice>[],
): CursorFilterConfigs => {
  const cursorConfigs = new Set<string>();
  const cursorMaxIncludedConfigs = new Set<string>();
  const cursorModels = new Set<string>();
  const cursorMaxModels = new Set<string>();

  rows.forEach((row) => {
    if (row.cursorMatch === null) {
      return;
    }

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
 * Renders DeepSWE filters, efficiency comparison, and performance ranking.
 * @param props - Benchmark data, optional metadata, and controlled version selection.
 * @returns Dashboard with configuration selection retained per version and cost as the initial metric.
 */
export const DeepSweDashboard = ({
  changelog,
  cursorModelPrices,
  leaderboard,
  version,
  onVersionChange,
}: DeepSweDashboardProps): ReactElement => {
  const [metric, setMetric] = useState<EfficiencyMetric>("cost");
  const matchedRows = useMemo(
    () =>
      matchLeaderboardRows(
        leaderboard.rows,
        cursorModelPrices ?? [],
        (cursorModel) => cursorModel.model,
      ),
    [cursorModelPrices, leaderboard.rows],
  );

  const cursorFilterConfigs = useMemo(
    () => createCursorFilterConfigs(matchedRows),
    [matchedRows],
  );

  const configModels = useMemo(
    () =>
      groupRowsByModel(matchedRows).map((group) => ({
        model: group.model,
        rows: group.rows.map((row) => ({
          config: row.config,
          effort: getReasoningEffort(row),
          title: [
            getReasoningEffort(row).toUpperCase(),
            row.mean_cost_usd === null
              ? null
              : `$${row.mean_cost_usd.toFixed(2)}`,
            `${(row.pass_at_1 * 100).toFixed(0)}%`,
          ]
            .filter(Boolean)
            .join(" \u00b7 "),
        })),
      })),
    [matchedRows],
  );

  const [excludedConfigsByVersion, setExcludedConfigsByVersion] = useState<
    Partial<Record<DeepSweVersion, Set<string>>>
  >({});

  const excludedConfigs = useMemo(
    () => excludedConfigsByVersion[version] ?? new Set(),
    [excludedConfigsByVersion, version],
  );

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

  const [showMoreEfficientOnlyByVersion, setShowMoreEfficientOnlyByVersion] =
    useState<Partial<Record<DeepSweVersion, boolean>>>({});
  const showMoreEfficientOnly =
    showMoreEfficientOnlyByVersion[version] ?? false;
  const hiddenConfigIds = useMemo(() => {
    if (!showMoreEfficientOnly) {
      return new Set<string>();
    }

    const candidates: ModelEfficiencyCandidate[] = selectedRows.map((row) => ({
      config: row.config,
      model: row.model,
      score: row.pass_at_1,
      cost: row.mean_cost_usd,
    }));

    return getLessEfficientConfigIds(candidates);
  }, [selectedRows, showMoreEfficientOnly]);
  const visibleRows = useMemo(
    () => selectedRows.filter((row) => !hiddenConfigIds.has(row.config)),
    [hiddenConfigIds, selectedRows],
  );
  const hiddenConfigKey = [...hiddenConfigIds].sort().join("|");

  /**
   * Updates the excluded configurations for the active benchmark version.
   */
  const updateExcludedConfigs = (
    update: (current: ReadonlySet<string>) => Set<string>,
  ): void => {
    setExcludedConfigsByVersion((current) => ({
      ...current,
      [version]: update(current[version] ?? new Set()),
    }));
  };

  /**
   * Selects or hides every reasoning level belonging to a model.
   */
  const handleModelToggle = (configs: readonly string[]): void => {
    const shouldShowAll = configs.some(
      (config) => !selectedConfigs.has(config),
    );

    updateExcludedConfigs((current) => {
      const next = new Set(current);

      configs.forEach((config) => {
        if (shouldShowAll) {
          next.delete(config);
        } else {
          next.add(config);
        }
      });

      return next;
    });
  };

  /**
   * Applies an exact reasoning-level selection to one model.
   */
  const handleLevelsToggle = (
    configs: readonly string[],
    nextSelectedConfigs: ReadonlySet<string>,
  ): void => {
    updateExcludedConfigs((current) => {
      const next = new Set(current);

      configs.forEach((config) => {
        if (nextSelectedConfigs.has(config)) {
          next.delete(config);
        } else {
          next.add(config);
        }
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
    setShowMoreEfficientOnlyByVersion((current) => ({
      ...current,
      [version]: nextShowMoreEfficientOnly,
    }));
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="grid gap-1.5">
          <span className="text-muted-foreground text-xs font-medium">
            Version
          </span>
          <BenchmarkToggleFilter
            label="Benchmark version"
            onChange={onVersionChange}
            options={VERSION_OPTIONS}
            value={version}
          />
        </div>

        <div className="grid gap-1.5">
          <span className="text-muted-foreground text-xs font-medium">
            Metric
          </span>
          <BenchmarkToggleFilter
            label="Efficiency metric"
            onChange={setMetric}
            options={EFFICIENCY_METRIC_OPTIONS}
            value={metric}
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

      <DeepSweEfficiencyChart
        availableRows={matchedRows}
        changelog={changelog}
        key={`${version}-${metric}-${hiddenConfigKey}`}
        metric={metric}
        onAddConfig={handleAddConfig}
        onAddModel={handleAddModel}
        onRemoveConfig={handleRemoveConfig}
        onRemoveModel={handleRemoveModel}
        rows={visibleRows}
        showAllPointLabels={showMoreEfficientOnly}
        showModelLines={!showMoreEfficientOnly}
        version={version}
      />

      <DeepSwePerformanceRanking
        key={`${version}-${hiddenConfigKey}`}
        rows={visibleRows}
      />
    </div>
  );
};
