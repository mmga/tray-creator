"use client";

import type {
  FreeSlot,
  GroupOutlinePreview,
  SimpleSteppedRowBand,
  SlotGroup,
  SteppedSlot,
} from "@/types/custom-tray";
import type { CanvasSlotUpdate } from "@/lib/canvas-types";
import type { SymmetryInsertSlot } from "@/lib/layout-symmetry";

export type LayoutEditorSlot = FreeSlot | SteppedSlot;

export interface LayoutEditorViewportModel {
  trayFrame: {
    width: number;
    depth: number;
    spacing: number;
    boundarySpacing: number;
    cornerRadius: number;
    showEffectiveBaseplate: boolean;
    showMaxBuildBoundary: boolean;
  };
  slots: LayoutEditorSlot[];
  overlays: {
    focusedGroupId?: string | null;
    groupOutlines?: GroupOutlinePreview[] | null;
    rowBands?: SimpleSteppedRowBand[] | null;
    slotGroups?: SlotGroup[] | null;
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
  resizeTray?: (width: number, depth: number) => void;
  updateSlotRotation?: (id: string, rotation: number) => void;
  updateMultipleSlots?: (updates: CanvasSlotUpdate[]) => void;
  liveUpdateMultipleSlots?: (updates: CanvasSlotUpdate[]) => void;
  insertSlots?: (slots: SymmetryInsertSlot[]) => void;
  duplicateSlots?: (ids: string[]) => string[] | void;
  undo?: () => void;
  saveSnapshot?: () => void;
  selectionChanged?: (ids: string[]) => void;
  editInteractionChanged?: (isInteracting: boolean) => void;
}
