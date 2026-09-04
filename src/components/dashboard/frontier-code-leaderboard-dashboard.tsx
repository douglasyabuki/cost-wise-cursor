import { ChevronDown, SearchIcon, X } from "lucide-react";
import { type ReactElement, useMemo, useState } from "react";

import { ModelEfficiencyToggle } from "@/components/dashboard/model-efficiency-toggle";
import { Badge } from "@/components/ui/badge";
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
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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

import { FrontierCodeComparisonChart } from "./charts/frontier-code-efficiency-chart";
import { FrontierCodePerformanceRankingChart } from "./charts/frontier-code-performance-ranking-chart";

/**
 * Public properties for the FrontierCode dashboard.
 */
export interface FrontierCodeLeaderboardDashboardProps {
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
  hiddenConfigIds: ReadonlySet<string>;
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

const EMPTY_EXCLUDED_CONFIGS: ReadonlySet<string> = new Set();

const VERSION_OPTIONS = [
  { label: "v1.1", value: "v1.1" },
  { label: "v1", value: "v1" },
] as const satisfies readonly ToggleFilterOption<FrontierCodeVersion>[];

const SUBSET_OPTIONS = [
  { label: "Main (100)", value: "main" },
  { label: "Extended (150)", value: "extended" },
] as const satisfies readonly ToggleFilterOption<FrontierCodeSubset>[];

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
      if (nextValue !== undefined) onChange(nextValue as T);
    }}
    size="sm"
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
 * Renders the FrontierCode model and effort configuration selector.
 *
 * @param props - Model groups, selection state, and Cursor presets.
 * @returns Configuration filter menu.
 */
const ConfigFilter = ({
  cursorMatchedCount,
  cursorMaxMatchedCount,
  hiddenConfigIds,
  models,
  selectedConfigs,
  totalCount,
  onSelectCursorModels,
  onSelectCursorModelsWithMax,
  onToggleModel,
  onToggleLevels,
  onShowAll,
  onHideAll,
}: ConfigFilterProps): ReactElement => {
  const [searchQuery, setSearchQuery] = useState("");
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const visibleModels = useMemo(
    () =>
      normalizedSearchQuery.length === 0
        ? models
        : models.filter((modelGroup) =>
            modelGroup.model.toLowerCase().includes(normalizedSearchQuery),
          ),
    [models, normalizedSearchQuery],
  );

  return (
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

        <DropdownMenuGroup>
          <DropdownMenuLabel>Models</DropdownMenuLabel>
          <div className="px-2 pb-2">
            <InputGroup>
              <InputGroupInput
                aria-label="Search models"
                onKeyDown={(event) => {
                  if (
                    event.key.length === 1 &&
                    !event.ctrlKey &&
                    !event.metaKey &&
                    !event.altKey
                  ) {
                    event.stopPropagation();
                  }
                }}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search models..."
                type="text"
                value={searchQuery}
              />
              <InputGroupAddon>
                <SearchIcon aria-hidden />
              </InputGroupAddon>
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  className={searchQuery.length > 0 ? "flex" : "hidden"}
                  onClick={() => setSearchQuery("")}
                >
                  <X />
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </div>
        </DropdownMenuGroup>

        <DropdownMenuGroup className="flex max-h-80 flex-col gap-1 overflow-y-auto">
          {visibleModels.length === 0 ? (
            <div className="text-muted-foreground px-2 py-3 text-sm">
              No models found.
            </div>
          ) : (
            visibleModels.map((modelGroup) => {
              const configIds = modelGroup.rows.map((row) => row.config);
              const selectedLevelIds = configIds.filter((config) =>
                selectedConfigs.has(config),
              );
              const selectedLevelCount = selectedLevelIds.length;
              const totalLevelCount = modelGroup.rows.length;
              const hiddenLevelCount = modelGroup.rows.filter((row) =>
                hiddenConfigIds.has(row.config),
              ).length;

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
                      id={`frontier-code-${modelGroup.model}`}
                      indeterminate={
                        selectedLevelCount > 0 &&
                        selectedLevelCount < totalLevelCount
                      }
                      onCheckedChange={() => onToggleModel(configIds)}
                    />
                    <Label
                      className="min-w-0 flex-1 truncate font-medium"
                      htmlFor={`frontier-code-${modelGroup.model}`}
                    >
                      {modelGroup.model}
                    </Label>

                    {hiddenLevelCount > 0 && (
                      <Badge className="shrink-0" variant="secondary">
                        {hiddenLevelCount} level
                        {hiddenLevelCount === 1 ? "" : "s"} hidden
                      </Badge>
                    )}

                    <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                      {selectedLevelCount}/{totalLevelCount}
                    </span>
                  </div>

                  <ToggleGroup
                    aria-label={`${modelGroup.model} reasoning levels`}
                    className="ml-6 max-w-full flex-wrap"
                    multiple
                    onValueChange={(values) =>
                      onToggleLevels(configIds, new Set(values))
                    }
                    size="sm"
                    spacing={0}
                    value={selectedLevelIds}
                    variant="outline"
                  >
                    {modelGroup.rows.map((row) => (
                      <ToggleGroupItem
                        aria-label={`${modelGroup.model} ${row.reasoning_effort} reasoning level`}
                        key={row.config}
                        pressed={selectedLevelIds.includes(row.config)}
                        size="sm"
                        title={`${row.reasoning_effort.toUpperCase()} · score ${(row.score * 100).toFixed(1)}% · pass rate ${(row.pass_rate * 100).toFixed(1)}%`}
                        value={row.config}
                      >
                        {row.reasoning_effort}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </DropdownMenuItem>
              );
            })
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
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
export const FrontierCodeLeaderboardDashboard = ({
  cursorModelPrices,
  leaderboard,
  onSubsetChange,
  onVersionChange,
  subset,
  version,
}: FrontierCodeLeaderboardDashboardProps): ReactElement => {
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
  const configModels = useMemo(() => groupRowsByModel(rows), [rows]);

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
          <ToggleFilter
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
          <ToggleFilter
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

          <ConfigFilter
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

      <FrontierCodeComparisonChart
        key={`${version}-${subset}-comparison-${hiddenConfigKey}`}
        rows={visibleRows}
        showAllPointLabels={showMoreEfficientOnly}
        showModelLines={!showMoreEfficientOnly}
      />
      <FrontierCodePerformanceRankingChart
        key={`${version}-${subset}-ranking-${hiddenConfigKey}`}
        rows={visibleRows}
      />
    </div>
  );
};
