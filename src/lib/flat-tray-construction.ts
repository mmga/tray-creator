import type { TrayParams } from "@/types/tray";
import type { CustomLayoutParams, FreeSlot } from "@/types/custom-tray";
import type { ConstructedContouredFootprint } from "./contoured-footprint";
import type { ContouredFootprintState } from "./contoured-footprint-state";
import { createGridBaseHoleConstructionPlan, createCustomBaseHoleConstructionPlan } from "./base-hole-planning";
import { calculateCustomTrayFootprint } from "./custom-layout-math";
import { getGridBoundarySpacingAxes, getGridBoxContentSize, getGridCutGeometry, getGridSlotPitchAxes, shouldRemoveGridIslands } from "./grid-layout-math";
import { getFreeSlotProfileGeometry } from "./slot-definitions";
import { resolveStackableBoxParams } from "./stackable-box";

export interface FlatTrayGroove {
  shape: "circle" | "rectangle" | "ellipse";
  width: number;
  height: number;
  cx: number;
  cy: number;
  bottom: number;
  length: number;
  rotation: number;
  outerOffset: number;
  profileExponent?: number;
}

export function planGridTrayConstruction(params: TrayParams) {
  const { rows, columns, baseThickness, holeDepth } = params;
  const box = resolveStackableBoxParams(params.stackableBox);
  const slot = getGridCutGeometry(params);
  const { pitchX, pitchY } = getGridSlotPitchAxes(params);
  const { contentWidth, contentDepth } = getGridBoxContentSize(params);
  const { boundarySpacingX, boundarySpacingY } = getGridBoundarySpacingAxes(params);
  const bevel = Math.max(0, params.sideBevelWidth);
  const width = box.enabled ? box.outerWidth : 2 * boundarySpacingX + slot.slotWidth + (columns - 1) * pitchX + 2 * bevel;
  const depth = box.enabled ? box.outerDepth : 2 * boundarySpacingY + slot.slotHeight + (rows - 1) * pitchY + 2 * bevel;
  const height = params.basePlateOnly ? baseThickness : baseThickness + holeDepth;
  const halfAxis: "x" | "y" | null = !box.enabled && !params.basePlateOnly && params.halfCircleSlots &&
    slot.shape === "circle" && (rows === 1 || columns === 1)
    ? (rows === 1 ? "y" : "x")
    : null;
  const removeIslands = shouldRemoveGridIslands(params);
  const grooves: FlatTrayGroove[] = [];
  if (!params.basePlateOnly) {
    const positionX = box.enabled
      ? -contentWidth / 2 + slot.slotWidth / 2
      : -width / 2 + bevel + boundarySpacingX + slot.slotWidth / 2;
    const positionY = box.enabled
      ? -contentDepth / 2 + slot.slotHeight / 2
      : -depth / 2 + bevel + boundarySpacingY + slot.slotHeight / 2;
    const length = holeDepth + 0.02;
    const bottom = baseThickness + holeDepth / 2 + (halfAxis ? 0.01 : 0) - length / 2;
    const placement = { bottom, length, rotation: 0, outerOffset: 0 };
    if (removeIslands) {
      grooves.push({ ...placement, shape: "rectangle", cx: 0, cy: 0,
        width: (columns - 1) * pitchX, height: (rows - 1) * pitchY });
    }
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        if (removeIslands && row > 0 && row < rows - 1 && col > 0 && col < columns - 1) continue;
        grooves.push({ ...placement, shape: slot.shape, width: slot.slotWidth, height: slot.slotHeight,
          cx: positionX + col * pitchX, cy: positionY + row * pitchY });
      }
    }
  }
  return { width, depth, height, halfAxis, box, grooves, baseHoles: createGridBaseHoleConstructionPlan(params) };
}

function planCustomGroove(slot: FreeSlot, centerX: number, centerY: number, bottom: number, length: number): FlatTrayGroove {
  return { ...getFreeSlotProfileGeometry(slot), shape: slot.shape,
    cx: slot.x - centerX, cy: slot.y - centerY, rotation: slot.rotation || 0, bottom, length };
}

export function planCustomTrayConstruction(
  params: CustomLayoutParams,
  contouredState: ContouredFootprintState<ConstructedContouredFootprint>,
) {
  const footprint = calculateCustomTrayFootprint(params, contouredState);
  const box = resolveStackableBoxParams(params.stackableBox);
  const { width, depth } = footprint;
  const height = params.baseThickness + params.holeDepth;
  const usesBox = box.enabled && footprint.footprintStyle === "rectangular";
  const useLayoutCenter = !usesBox && footprint.sizingMode === "auto" && footprint.hasSlots;
  const centerX = useLayoutCenter ? (footprint.minX + footprint.maxX) / 2 : (usesBox ? box.outerWidth : width) / 2;
  const centerY = useLayoutCenter ? (footprint.minY + footprint.maxY) / 2 : (usesBox ? box.outerDepth : depth) / 2;
  const grooves = params.slots.map((slot) => planCustomGroove(slot, centerX, centerY, params.baseThickness, params.holeDepth + 0.02));
  return { width, depth, height, footprintStyle: footprint.footprintStyle, box, grooves,
    baseHoles: createCustomBaseHoleConstructionPlan(params, { contouredState }) };
}
