import {
  CircleMinusIcon,
  CirclePlusIcon,
  ListPlusIcon,
  Trash2Icon,
} from "lucide-react";
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

/**
 * A chart dot resolved as a context-menu target.
 *
 * @property kind - Target discriminator.
 * @property config - Configuration identifier represented by the dot.
 * @property level - Reasoning-effort label represented by the dot.
 * @property model - Model identifier represented by the dot.
 */
interface ModelChartContextTarget {
  kind: "dot";
  config: string;
  level: string;
  model: string;
}

/**
 * A chart line resolved as a context-menu target.
 *
 * @property kind - Target discriminator.
 * @property model - Model identifier represented by the line.
 * @property visibleConfigs - Configuration ids currently represented by the line.
 */
interface ModelChartLineContextTarget {
  kind: "line";
  model: string;
  visibleConfigs: ReadonlySet<string>;
}

/**
 * Configuration metadata available to chart context actions.
 *
 * @property config - Stable configuration identifier.
 * @property level - Reasoning-effort label.
 * @property model - Model identifier.
 */
interface ModelChartContextConfig {
  config: string;
  level: string;
  model: string;
}

/**
 * Properties for the efficiency-chart context-menu wrapper.
 *
 * @property availableConfigs - Configurations that can be added to the selection.
 * @property children - Chart content receiving context-menu behavior.
 * @property onAddConfig - Adds one configuration.
 * @property onAddModel - Adds all configurations for one model.
 * @property onRemoveConfig - Removes one configuration.
 * @property onRemoveModel - Removes all configurations for one model.
 */
interface ModelChartContextMenuProps {
  availableConfigs: readonly ModelChartContextConfig[];
  children: ReactNode;
  onAddConfig: (config: string) => void;
  onAddModel: (model: string) => void;
  onRemoveConfig: (config: string) => void;
  onRemoveModel: (model: string) => void;
}

type ResolvedModelChartContextTarget =
  ModelChartContextTarget | ModelChartLineContextTarget;

/**
 * A point in viewport coordinates.
 *
 * @property x - Horizontal viewport coordinate.
 * @property y - Vertical viewport coordinate.
 */
interface ScreenPoint {
  x: number;
  y: number;
}

type PreventableChartEvent<TEvent> = TEvent & {
  preventBaseUIHandler?: () => void;
};

/** Returns the distance from a point to a line segment. */
const getDistanceToSegment = (
  point: ScreenPoint,
  start: ScreenPoint,
  end: ScreenPoint,
): number => {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const lengthSquared = deltaX * deltaX + deltaY * deltaY;

  if (lengthSquared === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const projection = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * deltaX + (point.y - start.y) * deltaY) /
        lengthSquared,
    ),
  );
  return Math.hypot(
    point.x - (start.x + projection * deltaX),
    point.y - (start.y + projection * deltaY),
  );
};

/** Resolves a screen-space point for an SVG path sample. */
const getScreenPoint = (
  point: DOMPoint,
  transform: DOMMatrix,
): ScreenPoint => ({
  x: point.x * transform.a + point.y * transform.c + transform.e,
  y: point.x * transform.b + point.y * transform.d + transform.f,
});

/** Measures the closest distance from the actual press to a rendered line. */
const getDistanceToPath = (
  path: SVGPathElement,
  clientX: number,
  clientY: number,
): number => {
  const bounds = path.getBoundingClientRect();
  const distanceToBounds = Math.max(
    bounds.left - clientX,
    clientX - bounds.right,
    bounds.top - clientY,
    clientY - bounds.bottom,
    0,
  );
  if (distanceToBounds > 12) return Number.POSITIVE_INFINITY;

  const transform = path.getScreenCTM();
  const length = path.getTotalLength();
  if (transform === null || length === 0) return distanceToBounds;

  const sampleCount = Math.max(1, Math.ceil(length / 12));
  const target = { x: clientX, y: clientY };
  let closestDistance = Number.POSITIVE_INFINITY;
  let previous = getScreenPoint(path.getPointAtLength(0), transform);

  for (let index = 1; index <= sampleCount; index += 1) {
    const current = getScreenPoint(
      path.getPointAtLength((length * index) / sampleCount),
      transform,
    );
    closestDistance = Math.min(
      closestDistance,
      getDistanceToSegment(target, previous, current),
    );
    previous = current;
  }

  return closestDistance;
};

/** Returns the model and visible configs represented by a rendered line. */
const getLineContextTarget = (
  path: SVGPathElement,
): ModelChartLineContextTarget | null => {
  const line = path.closest<SVGGElement>("g.ts-chart__line");
  if (line === null || line.closest("[data-ts-focus-layer]")) return null;

  const model = line
    .querySelector<SVGCircleElement>("circle[data-model-context-model]")
    ?.getAttribute("data-model-context-model");
  if (!model) return null;

  const visibleConfigs = new Set<string>();
  line
    .querySelectorAll<SVGCircleElement>("circle[data-model-context-config]")
    .forEach((circle) => {
      const config = circle.getAttribute("data-model-context-config");
      if (config) visibleConfigs.add(config);
    });

  return { kind: "line", model, visibleConfigs };
};

/** Resolves the closest dot or line to the actual press. */
const getContextTarget = (
  container: HTMLDivElement,
  clientX: number,
  clientY: number,
): ResolvedModelChartContextTarget | null => {
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

  if (config && level && model) {
    return { kind: "dot", config, level, model };
  }

  let closestLine: ModelChartLineContextTarget | null = null;
  let closestLineDistance = Number.POSITIVE_INFINITY;
  for (const path of container.querySelectorAll<SVGPathElement>(
    "g.ts-chart__line path",
  )) {
    const nextLine = getLineContextTarget(path);
    if (nextLine === null) continue;

    const distance = getDistanceToPath(path, clientX, clientY);
    if (distance <= 10 && distance < closestLineDistance) {
      closestLine = nextLine;
      closestLineDistance = distance;
    }
  }

  return closestLine;
};

/**
 * Adds configuration-removal actions to model marks in an efficiency chart.
 *
 * @param props - Chart content and callbacks that update the selected configs.
 * @returns A chart wrapper that opens a contextual removal menu on a model mark.
 */
export const ModelChartContextMenu = ({
  availableConfigs,
  children,
  onAddConfig,
  onAddModel,
  onRemoveConfig,
  onRemoveModel,
}: ModelChartContextMenuProps): ReactElement => {
  const [contextTarget, setContextTarget] =
    useState<ResolvedModelChartContextTarget | null>(null);
  const missingConfigs =
    contextTarget?.kind === "line"
      ? availableConfigs.filter(
          (config) =>
            config.model === contextTarget.model &&
            !contextTarget.visibleConfigs.has(config.config),
        )
      : [];

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
        {contextTarget === null ? null : contextTarget.kind === "line" ? (
          <ContextMenuGroup>
            <ContextMenuLabel
              className="max-w-72 truncate"
              title={contextTarget.model}
            >
              {contextTarget.model}
            </ContextMenuLabel>
            {missingConfigs.map((config) => (
              <ContextMenuItem
                key={config.config}
                onClick={() => onAddConfig(config.config)}
              >
                <CirclePlusIcon />
                Add {config.level} level
              </ContextMenuItem>
            ))}
            {missingConfigs.length > 0 ? (
              <ContextMenuItem onClick={() => onAddModel(contextTarget.model)}>
                <ListPlusIcon />
                Add model (all levels)
              </ContextMenuItem>
            ) : null}
            <ContextMenuItem
              onClick={() => onRemoveModel(contextTarget.model)}
              variant="destructive"
            >
              <Trash2Icon />
              Remove model (all levels)
            </ContextMenuItem>
          </ContextMenuGroup>
        ) : (
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
