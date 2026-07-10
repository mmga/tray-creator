import { getEllipsePolygon, polygonsIntersect } from "@/lib/collision";
import type { FreeSlot } from "@/types/custom-tray";
import { getEllipseBoundingBox } from "./canvas-slot-geometry";
import { getFreeSlotProfileGeometry } from "@/lib/slot-definitions";

export interface CanvasCollisionInfo {
  boundaryReasons: string[];
  overlapIds: string[];
}

export interface CanvasConnectorPair {
  key: string;
  firstId: string;
  secondId: string;
}

export interface CanvasCollisionState<TSlot extends { id: string }> {
  collisionErrorCount: number;
  collisionMap: Map<string, CanvasCollisionInfo>;
  connectorPairs: CanvasConnectorPair[];
  involvedIds: Set<string>;
  slotById: Map<string, TSlot>;
}

export interface CanvasCollisionSpacingOptions<TSlot> {
  maxSpacing?: number;
  getPairSpacing?: (left: TSlot, right: TSlot, baseSpacing: number) => number;
  getBoundaryReasons?: (slot: TSlot) => string[];
}

type CanvasCollisionSlot = Pick<
  FreeSlot,
  | "id"
  | "x"
  | "y"
  | "width"
  | "height"
  | "rotation"
  | "shape"
  | "slotWidth"
  | "slotHeight"
  | "outerOffset"
  | "profileExponent"
>;

export function buildCanvasCollisionState<TSlot extends CanvasCollisionSlot>(
  slots: ReadonlyArray<TSlot>,
  spacing: number,
  ellipseProfileExponent?: number,
  spacingOptions?: CanvasCollisionSpacingOptions<TSlot>,
): CanvasCollisionState<TSlot> {
  const collisionMap = new Map<string, CanvasCollisionInfo>();
  const involvedIds = new Set<string>();
  const connectorPairs: CanvasConnectorPair[] = [];
  const slotById = new Map(slots.map((slot) => [slot.id, slot] as const));

  if (slots.length === 0) {
    return {
      collisionErrorCount: 0,
      collisionMap,
      connectorPairs,
      involvedIds,
      slotById,
    };
  }

  const expandedBounds = slots
    .map((slot) => {
      const profile = getFreeSlotProfileGeometry(slot);
      const broadPhaseSpacing = spacingOptions?.maxSpacing ?? spacing;
      const margin = broadPhaseSpacing / 2 + profile.outerOffset;
      const { halfW, halfH } = getEllipseBoundingBox(
        profile.width,
        profile.height,
        slot.rotation,
        slot.shape,
        profile.profileExponent ?? ellipseProfileExponent,
        profile.outerOffset,
      );

      return {
        slot,
        profile,
        margin,
        minX: slot.x - halfW - margin,
        maxX: slot.x + halfW + margin,
        minY: slot.y - halfH - margin,
        maxY: slot.y + halfH + margin,
      };
    })
    .sort((a, b) => a.minX - b.minX);
  const expandedPolygons = new Map<string, ReturnType<typeof getEllipsePolygon>>();
  const getExpandedPolygon = (slot: TSlot, margin: number) => {
    const cacheKey = `${slot.id}:${margin}`;
    const cached = expandedPolygons.get(cacheKey);
    if (cached) {
      return cached;
    }

    const profile = getFreeSlotProfileGeometry(slot);
    const polygon = getEllipsePolygon(
      slot.x,
      slot.y,
      profile.width,
      profile.height,
      slot.rotation,
      margin,
      12,
      profile.profileExponent ?? ellipseProfileExponent,
    );
    expandedPolygons.set(cacheKey, polygon);
    return polygon;
  };

  let collisionErrorCount = 0;
  slots.forEach((slot) => {
    const boundaryReasons = spacingOptions?.getBoundaryReasons?.(slot) ?? [];
    collisionMap.set(slot.id, {
      boundaryReasons,
      overlapIds: [],
    });
    if (boundaryReasons.length > 0) {
      collisionErrorCount += 1;
    }
  });

  for (let i = 0; i < expandedBounds.length; i += 1) {
    const current = expandedBounds[i];

    for (let j = i + 1; j < expandedBounds.length; j += 1) {
      const other = expandedBounds[j];
      if (other.minX > current.maxX) {
        break;
      }

      if (current.maxY < other.minY || other.maxY < current.minY) {
        continue;
      }

      const pairSpacing =
        spacingOptions?.getPairSpacing?.(current.slot, other.slot, spacing) ??
        spacing;
      const currentPolygon = getExpandedPolygon(
        current.slot,
        pairSpacing / 2 + current.profile.outerOffset,
      );
      const otherPolygon = getExpandedPolygon(
        other.slot,
        pairSpacing / 2 + other.profile.outerOffset,
      );
      if (!polygonsIntersect(currentPolygon, otherPolygon)) {
        continue;
      }

      collisionMap.get(current.slot.id)?.overlapIds.push(other.slot.id);
      collisionMap.get(other.slot.id)?.overlapIds.push(current.slot.id);
      involvedIds.add(current.slot.id);
      involvedIds.add(other.slot.id);
      collisionErrorCount += 1;
      connectorPairs.push({
        key: [current.slot.id, other.slot.id].sort().join("|"),
        firstId: current.slot.id,
        secondId: other.slot.id,
      });
    }
  }

  return {
    collisionErrorCount,
    collisionMap,
    connectorPairs,
    involvedIds,
    slotById,
  };
}
