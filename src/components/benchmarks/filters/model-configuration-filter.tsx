import { ChevronDown, SearchIcon, X } from "lucide-react";
import { type ReactElement, useId, useMemo, useState } from "react";

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
import { cn } from "@/lib/utils";

/** A prepared configuration with a stable ID, effort label, and benchmark-specific tooltip. */
export interface ModelConfigurationOption {
  config: string;
  effort: string;
  title: string;
}

/** A model and its ordered configuration options. */
export interface ModelConfigurationGroup {
  model: string;
  rows: readonly ModelConfigurationOption[];
}

/**
 * Prepared model groups and controlled configuration selection with Cursor presets.
 * All selection values and callbacks are required; search and menu state are local.
 */
export interface ModelConfigurationFilterProps {
  cursorMatchedCount: number;
  cursorMaxMatchedCount: number;
  hiddenConfigIds: ReadonlySet<string>;
  models: readonly ModelConfigurationGroup[];
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

/**
 * Renders the shared model and reasoning-effort selector.
 * @param props - Prepared options, controlled selection, and selection callbacks.
 * @returns A searchable menu with labeled controls and instance-specific checkbox IDs.
 */
export const ModelConfigurationFilter = ({
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
}: ModelConfigurationFilterProps): ReactElement => {
  const filterId = useId();
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
                  className={cn(searchQuery.length > 0 ? "flex" : "hidden")}
                  aria-label="Clear model search"
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
                      id={`${filterId}-${modelGroup.model}`}
                      indeterminate={
                        selectedLevelCount > 0 &&
                        selectedLevelCount < totalLevelCount
                      }
                      onCheckedChange={() => onToggleModel(configIds)}
                    />
                    <Label
                      className="min-w-0 flex-1 truncate font-medium"
                      htmlFor={`${filterId}-${modelGroup.model}`}
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
                        aria-label={`${modelGroup.model} ${row.effort} reasoning level`}
                        key={row.config}
                        pressed={selectedLevelIds.includes(row.config)}
                        size="sm"
                        title={row.title}
                        value={row.config}
                      >
                        {row.effort}
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
