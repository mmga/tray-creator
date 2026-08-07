import type { FreeSlot } from "@/types/custom-tray";
import type { CanvasPoint, CanvasSelectionBox } from "./canvas-types";

export interface CanvasSelectionRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

type SelectableSlot = Pick<FreeSlot, "id">;

interface SelectableIdLookup {
  has(id: string): boolean;
}

export function sanitizeCanvasSelectedIds(
  selectedIds: ReadonlySet<string>,
  validIds: SelectableIdLookup,
) {
  return new Set(Array.from(selectedIds).filter((id) => validIds.has(id)));
}

export function getCanvasSelectionBoxRect(
  selectionBox: CanvasSelectionBox,
): CanvasSelectionRect {
  const left = Math.min(selectionBox.start.x, selectionBox.current.x);
  const top = Math.min(selectionBox.start.y, selectionBox.current.y);
  const right = Math.max(selectionBox.start.x, selectionBox.current.x);
  const bottom = Math.max(selectionBox.start.y, selectionBox.current.y);

  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
  };
}

export function shouldApplyCanvasSelectionBox(
  selectionRect: Pick<CanvasSelectionRect, "width" | "height">,
  threshold = 2,
) {
  return selectionRect.width > threshold || selectionRect.height > threshold;
}

interface CollectCanvasSelectionOptions<TSlot extends SelectableSlot> {
  slots: ReadonlyArray<TSlot>;
  selectionRect: CanvasSelectionRect;
  projectSlotToScreen: (slot: TSlot) => CanvasPoint | null;
  initialSelection?: ReadonlySet<string>;
}

export function collectCanvasSelection<TSlot extends SelectableSlot>({
  slots,
  selectionRect,
  projectSlotToScreen,
  initialSelection,
}: CollectCanvasSelectionOptions<TSlot>) {
  const nextSelection = new Set(initialSelection ?? []);

  for (const slot of slots) {
    const screenPoint = projectSlotToScreen(slot);
    if (!screenPoint) {
      continue;
    }

    if (
      screenPoint.x >= selectionRect.left &&
      screenPoint.x <= selectionRect.right &&
      screenPoint.y >= selectionRect.top &&
      screenPoint.y <= selectionRect.bottom
    ) {
      nextSelection.add(slot.id);
    }
  }

  return nextSelection;
}
