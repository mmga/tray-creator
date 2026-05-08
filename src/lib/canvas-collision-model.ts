import { getEllipsePolygon, polygonsIntersect } from "@/lib/collision";
import { getSlotOuterOffset } from "@/lib/config";
import type { FreeSlot } from "@/types/custom-tray";
import { getEllipseBoundingBox } from "./canvas-slot-geometry";

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

type CanvasCollisionSlot = Pick<
  FreeSlot,
  "id" | "x" | "y" | "width" | "height" | "rotation" | "shape"
>;

export function buildCanvasCollisionState<TSlot extends CanvasCollisionSlot>(
  slots: ReadonlyArray<TSlot>,
  spacing: number,
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
      const margin =
        spacing / 2 + getSlotOuterOffset(slot.width, slot.height, slot.shape);
      const { halfW, halfH } = getEllipseBoundingBox(
        slot.width,
        slot.height,
        slot.rotation,
        slot.shape,
      );

      return {
        slot,
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
    const cached = expandedPolygons.get(slot.id);
    if (cached) {
      return cached;
    }

    const polygon = getEllipsePolygon(
      slot.x,
      slot.y,
      slot.width,
      slot.height,
      slot.rotation,
      margin,
      12,
    );
    expandedPolygons.set(slot.id, polygon);
    return polygon;
  };

  slots.forEach((slot) => {
    collisionMap.set(slot.id, {
      boundaryReasons: [],
      overlapIds: [],
    });
  });

  let collisionErrorCount = 0;
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

      const currentPolygon = getExpandedPolygon(current.slot, current.margin);
      const otherPolygon = getExpandedPolygon(other.slot, other.margin);
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
