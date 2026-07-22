import type { CanvasPoint, CanvasSlotUpdate } from "@/lib/canvas-types";
import type { LayoutEditorSlot } from "@/viewports/layout-editor/types";

export interface LayoutCanvasDragStart {
  draggingId: string;
  origins: Map<string, CanvasPoint>;
}

export function resolveLayoutCanvasDragStart({
  draggingId,
  selectedIds,
  slotById,
  slotMoveScopeResolver,
}: {
  draggingId: string;
  selectedIds: string[];
  slotById: Map<string, LayoutEditorSlot>;
  slotMoveScopeResolver?: (
    draggingId: string,
    selectedIds: string[],
  ) => string[];
}): LayoutCanvasDragStart | null {
  const scopedDragIds = slotMoveScopeResolver
    ? slotMoveScopeResolver(draggingId, selectedIds)
    : selectedIds;

  if (scopedDragIds.length === 0 || !slotById.has(draggingId)) {
    return null;
  }

  const origins = new Map<string, CanvasPoint>();
  scopedDragIds.forEach((id) => {
    const slot = slotById.get(id);
    if (slot) {
      origins.set(id, { x: slot.x, y: slot.y });
    }
  });

  if (origins.size === 0) {
    return null;
  }

  return {
    draggingId,
    origins,
  };
}

export function buildLayoutCanvasDragUpdates({
  draggingId,
  dragOrigins,
  finalDraggingPosition,
}: {
  draggingId: string;
  dragOrigins: Map<string, CanvasPoint>;
  finalDraggingPosition: CanvasPoint;
}): CanvasSlotUpdate[] {
  const draggingOrigin = dragOrigins.get(draggingId);
  if (!draggingOrigin) {
    return [];
  }

  const finalDeltaX = finalDraggingPosition.x - draggingOrigin.x;
  const finalDeltaY = finalDraggingPosition.y - draggingOrigin.y;
  const updates: CanvasSlotUpdate[] = [];
  dragOrigins.forEach((origin, id) => {
    updates.push({
      id,
      x: origin.x + finalDeltaX,
      y: origin.y + finalDeltaY,
    });
  });
  return updates;
}
