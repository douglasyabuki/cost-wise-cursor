import { ChevronDown } from "lucide-react";
import { type ReactElement, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { CursorModelPrice } from "@/types-and-constants/cursor";
import type {
  DeepSweLeaderboard,
  DeepSweLeaderboardRow,
  DeepSweVersion,
} from "@/types-and-constants/deep-swe";
import {
  compareModelNames,
  getReasoningEffort,
  getReasoningEffortOrder,
} from "@/utils/deep-swe";
import {
  type MatchedLeaderboardRow,
  matchLeaderboardRows,
} from "@/utils/deep-swe-cursor-model-match";

import { DeepSweEfficiencyChart } from "./charts/deep-swe-efficiency-chart";
import { DeepSwePerformanceRankingChart } from "./charts/deep-swe-performance-ranking-chart";

export interface DeepSweLeaderboardDashboardProps {
  cursorModelPrices?: readonly CursorModelPrice[];
  leaderboard: DeepSweLeaderboard;
  version: DeepSweVersion;
  onVersionChange: (version: DeepSweVersion) => void;
}

interface ConfigModelGroup {
  model: string;
  rows: DeepSweLeaderboardRow[];
}

interface ToggleFilterOption<T extends string> {
  label: string;
  value: T;
}

interface ToggleFilterProps<T extends string> {
  label: string;
  options: readonly ToggleFilterOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

interface ConfigFilterProps {
  cursorMatchedCount: number;
  cursorMaxMatchedCount: number;
  models: ConfigModelGroup[];
  selectedConfigs: ReadonlySet<string>;
  totalCount: number;
  onSelectCursorModels: () => void;
  onSelectCursorModelsWithMax: () => void;
  onToggleModel: (configs: readonly string[]) => void;
  onToggleLevels: (
    configs: readonly string[],
    selectedConfigs: ReadonlySet<string>,
  ) => void;
  onShowAll: () => void;
  onHideAll: () => void;
}

interface CursorFilterConfigs {
  cursorConfigs: ReadonlySet<string>;
  cursorMatchedCount: number;
  cursorMaxIncludedConfigs: ReadonlySet<string>;
  cursorMaxMatchedCount: number;
}

const VERSION_OPTIONS = [
  { label: "v1.1", value: "v1.1" },
  { label: "v1", value: "v1" },
] as const satisfies readonly ToggleFilterOption<DeepSweVersion>[];

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
  rows: readonly MatchedLeaderboardRow<CursorModelPrice>[],
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
 * Renders a single-selection toggle filter.
 */
const ToggleFilter = <T extends string>({
  label,
  options,
  value,
  onChange,
}: ToggleFilterProps<T>): ReactElement => (
  <ToggleGroup
    aria-label={label}
    className="bg-background"
    onValueChange={(values) => {
      const [nextValue] = values;

      if (nextValue !== undefined) {
        onChange(nextValue as T);
      }
    }}
    size="default"
    spacing={0}
    value={[value]}
    variant="outline"
  >
    {options.map((option) => (
      <ToggleGroupItem
        aria-label={option.label}
        className="min-w-10"
        key={option.value}
        value={option.value}
      >
        {option.label}
      </ToggleGroupItem>
    ))}
  </ToggleGroup>
);

/**
 * Renders the configuration selector shared by both leaderboard views.
 */
const ConfigFilter = ({
  cursorMatchedCount,
  cursorMaxMatchedCount,
  models,
  selectedConfigs,
  totalCount,
  onSelectCursorModels,
  onSelectCursorModelsWithMax,
  onToggleModel,
  onToggleLevels,
  onShowAll,
  onHideAll,
}: ConfigFilterProps): ReactElement => (
  <DropdownMenu>
    <DropdownMenuTrigger render={<Button variant="outline" />}>
      Configs{" "}
      <span className="text-muted-foreground tabular-nums">
        ({selectedConfigs.size}/{totalCount})
      </span>
      <ChevronDown aria-hidden data-icon="inline-end" />
    </DropdownMenuTrigger>

    <DropdownMenuContent align="end" className="w-80">
      <DropdownMenuGroup>
        <DropdownMenuLabel>Filter configurations</DropdownMenuLabel>
        <DropdownMenuItem onClick={onShowAll}>Select all</DropdownMenuItem>
        <DropdownMenuItem onClick={onHideAll}>Clear</DropdownMenuItem>
      </DropdownMenuGroup>

      <DropdownMenuSeparator />

      <DropdownMenuGroup>
        <DropdownMenuLabel>Cursor availability</DropdownMenuLabel>

        <div className="grid gap-2 px-2 pb-2">
          <Button
            aria-label={`Select ${cursorMatchedCount} Cursor models that do not require legacy Max Mode`}
            disabled={cursorMatchedCount === 0}
            onClick={onSelectCursorModels}
            size="sm"
            type="button"
            variant="outline"
          >
            Cursor models
          </Button>

          <Button
            aria-label={`Select Cursor models, including ${cursorMaxMatchedCount} that require legacy Max Mode`}
            disabled={cursorMaxMatchedCount === 0}
            onClick={onSelectCursorModelsWithMax}
            size="sm"
            type="button"
            variant="outline"
          >
            Cursor models{" "}
            <span className="text-muted-foreground">[MAX included]</span>
          </Button>
        </div>
      </DropdownMenuGroup>

      <DropdownMenuSeparator />

      <DropdownMenuGroup className="flex max-h-80 flex-col gap-1 overflow-y-auto">
        <DropdownMenuLabel>Models</DropdownMenuLabel>

        {models.map((modelGroup) => {
          const configIds = modelGroup.rows.map((row) => row.config);
          const selectedLevelIds = configIds.filter((config) =>
            selectedConfigs.has(config),
          );
          const selectedLevelCount = selectedLevelIds.length;
          const totalLevelCount = modelGroup.rows.length;

          return (
            <DropdownMenuItem
              closeOnClick={false}
              className="focus:text-foreground focus:**:text-foreground data-highlighted:text-foreground data-highlighted:**:text-foreground flex-col items-stretch gap-2 p-2 focus:bg-transparent data-highlighted:bg-transparent"
              key={modelGroup.model}
            >
              <div className="flex min-w-0 items-center gap-2">
                <Checkbox
                  aria-label={`Select all ${modelGroup.model} levels`}
                  checked={selectedLevelCount === totalLevelCount}
                  indeterminate={
                    selectedLevelCount > 0 &&
                    selectedLevelCount < totalLevelCount
                  }
                  onCheckedChange={() => onToggleModel(configIds)}
                  id={modelGroup.model}
                />

                <Label
                  className="min-w-0 flex-1 truncate font-medium"
                  htmlFor={modelGroup.model}
                >
                  {modelGroup.model}
                </Label>

                <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                  {selectedLevelCount}/{totalLevelCount}
                </span>
              </div>

              <ToggleGroup
                aria-label={`${modelGroup.model} reasoning levels`}
                className="ml-6 max-w-full flex-wrap"
                onValueChange={(values) =>
                  onToggleLevels(configIds, new Set(values))
                }
                size="sm"
                spacing={0}
                value={selectedLevelIds}
                multiple
                variant="outline"
              >
                {modelGroup.rows.map((row) => {
                  const effort = getReasoningEffort(row);

                  return (
                    <ToggleGroupItem
                      aria-label={`${modelGroup.model} ${effort} reasoning level`}
                      key={row.config}
                      pressed={selectedLevelIds.includes(row.config)}
                      size="sm"
                      title={[
                        effort.toUpperCase(),
                        row.mean_cost_usd === null
                          ? null
                          : `$${row.mean_cost_usd.toFixed(2)}`,
                        `${(row.pass_at_1 * 100).toFixed(0)}%`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                      value={row.config}
                    >
                      {effort}
                    </ToggleGroupItem>
                  );
                })}
              </ToggleGroup>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuGroup>
    </DropdownMenuContent>
  </DropdownMenu>
);

/**
 * Coordinates shared configuration filters for both leaderboard views.
 */
export const DeepSweLeaderboardDashboard = ({
  cursorModelPrices,
  leaderboard,
  version,
  onVersionChange,
}: DeepSweLeaderboardDashboardProps): ReactElement => {
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
    () => groupRowsByModel(matchedRows),
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <ToggleFilter
          label="Benchmark version"
          onChange={onVersionChange}
          options={VERSION_OPTIONS}
          value={version}
        />

        <div className="ml-auto">
          <ConfigFilter
            cursorMatchedCount={cursorFilterConfigs.cursorMatchedCount}
            cursorMaxMatchedCount={cursorFilterConfigs.cursorMaxMatchedCount}
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
        leaderboard={leaderboard}
        rows={selectedRows}
        version={version}
      />

      <DeepSwePerformanceRankingChart rows={selectedRows} />
    </div>
  );
};
