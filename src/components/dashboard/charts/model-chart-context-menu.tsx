import { CircleMinusIcon, Trash2Icon } from "lucide-react";
import {
  type MouseEvent,
  type ReactElement,
  type ReactNode,
  type TouchEvent,
  useState,
} from "react";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

interface ModelChartContextTarget {
  config: string;
  level: string;
  model: string;
}

interface ModelChartContextMenuProps {
  children: ReactNode;
  onRemoveConfig: (config: string) => void;
  onRemoveModel: (model: string) => void;
}

type PreventableChartEvent<TEvent> = TEvent & {
  preventBaseUIHandler?: () => void;
};

/** Resolves the closest base dot within eight CSS pixels of the actual press. */
const getContextTarget = (
  container: HTMLDivElement,
  clientX: number,
  clientY: number,
): ModelChartContextTarget | null => {
  let closest: SVGCircleElement | null = null;
  let closestDistance = Number.POSITIVE_INFINITY;

  for (const circle of container.querySelectorAll<SVGCircleElement>(
    "circle[data-model-context-config]",
  )) {
    // Focus copies and guides are presentation only, never menu targets.
    if (circle.closest("[data-ts-focus-layer]")) continue;
    const bounds = circle.getBoundingClientRect();
    if (bounds.width === 0 || bounds.height === 0) continue;
    const distance = Math.hypot(
      clientX - (bounds.left + bounds.width / 2),
      clientY - (bounds.top + bounds.height / 2),
    );
    if (
      distance <= Math.max(8, bounds.width / 2) &&
      distance < closestDistance
    ) {
      closest = circle;
      closestDistance = distance;
    }
  }

  const element = closest;
  const config = element?.getAttribute("data-model-context-config");
  const level = element?.getAttribute("data-model-context-level");
  const model = element?.getAttribute("data-model-context-model");

  return config && level && model ? { config, level, model } : null;
};

/**
 * Adds configuration-removal actions to model marks in an efficiency chart.
 *
 * @param props - Chart content and callbacks that update the selected configs.
 * @returns A chart wrapper that opens a contextual removal menu on a model mark.
 */
export const ModelChartContextMenu = ({
  children,
  onRemoveConfig,
  onRemoveModel,
}: ModelChartContextMenuProps): ReactElement => {
  const [contextTarget, setContextTarget] =
    useState<ModelChartContextTarget | null>(null);

  const handleContextMenu = (
    event: PreventableChartEvent<MouseEvent<HTMLDivElement>>,
  ): void => {
    const nextTarget = getContextTarget(
      event.currentTarget,
      event.clientX,
      event.clientY,
    );
    setContextTarget(nextTarget);

    if (nextTarget === null) {
      event.preventBaseUIHandler?.();
      return;
    }
  };

  const handleTouchStart = (
    event: PreventableChartEvent<TouchEvent<HTMLDivElement>>,
  ): void => {
    const touch = event.touches.length === 1 ? event.touches[0] : undefined;
    const nextTarget = touch
      ? getContextTarget(event.currentTarget, touch.clientX, touch.clientY)
      : null;
    setContextTarget(nextTarget);

    if (nextTarget === null) {
      event.preventBaseUIHandler?.();
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger
        className="min-w-0"
        onContextMenu={handleContextMenu}
        onTouchStart={handleTouchStart}
      >
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent>
        {contextTarget === null ? null : (
          <ContextMenuGroup>
            <ContextMenuLabel
              className="max-w-72 truncate"
              title={`${contextTarget.model} · ${contextTarget.level}`}
            >
              {contextTarget.model} · {contextTarget.level}
            </ContextMenuLabel>
            <ContextMenuItem
              onClick={() => onRemoveConfig(contextTarget.config)}
              variant="destructive"
            >
              <CircleMinusIcon />
              Remove {contextTarget.level} level
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => onRemoveModel(contextTarget.model)}
              variant="destructive"
            >
              <Trash2Icon />
              Remove model (all levels)
            </ContextMenuItem>
          </ContextMenuGroup>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
};
