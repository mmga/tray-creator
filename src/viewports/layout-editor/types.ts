"use client";

import type {
  FreeSlot,
  GroupOutlinePreview,
  SlotGroup,
  SteppedSlot,
} from "@/types/custom-tray";
import type { CanvasSlotUpdate } from "@/lib/canvas-types";
import type { SymmetryInsertSlot } from "@/lib/layout-symmetry";
import type { FixedCustomTrayUsableArea } from "@/lib/custom-layout-math";

export type LayoutEditorSlot = FreeSlot | SteppedSlot;

export interface LayoutEditorViewportModel {
  trayFrame: {
    width: number;
    depth: number;
    spacing: number;
    boundarySpacing: number;
    cornerRadius: number;
    sideBevelWidth: number;
    showEffectiveBaseplate: boolean;
    showMaxBuildBoundary: boolean;
    fixedUsableArea?: FixedCustomTrayUsableArea;
  };
  slots: LayoutEditorSlot[];
  overlays: {
    focusedGroupId?: string | null;
    groupOutlines?: GroupOutlinePreview[] | null;
    slotGroups?: SlotGroup[] | null;
    footprintWarnings?: readonly string[];
  };
  interactions: {
    slotHeightById?: Record<string, number>;
    slotMoveScopeResolver?: (
      draggingId: string,
      selectedIds: string[],
    ) => string[];
  };
}

export interface LayoutEditorViewportCommands {
  updateSlotPosition: (id: string, x: number, y: number) => void;
  removeSlot: (id: string) => void;
  removeSlots?: (ids: string[]) => void;
  updateSlotRotation?: (id: string, rotation: number) => void;
  updateMultipleSlots?: (updates: CanvasSlotUpdate[]) => void;
  liveUpdateMultipleSlots?: (updates: CanvasSlotUpdate[]) => void;
  insertSlots?: (slots: SymmetryInsertSlot[]) => void;
  duplicateSlots?: (ids: string[]) => string[] | void;
  undo?: () => void;
  saveSnapshot?: () => void;
  beginContinuousEdit?: () => boolean | void;
  commitContinuousEdit?: () => void;
  cancelContinuousEdit?: () => void;
  selectionChanged?: (ids: string[]) => void;
  editInteractionChanged?: (isInteracting: boolean) => void;
}
