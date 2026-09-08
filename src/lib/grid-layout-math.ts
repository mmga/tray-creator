import { getGridSlotGeometry } from "@/lib/grid-config";
import type { TrayParams } from "@/types/tray";
import {
  calculateBoxRequiredOuterSize,
  resolveStackableBoxParams,
} from "@/lib/stackable-box";

export function getGridSpacingAxes(params: TrayParams) {
  return {
    spacingX: params.spacingIndependent ? params.spacingX : params.spacing,
    spacingY: params.spacingIndependent ? params.spacingY : params.spacing,
  };
}

export function getGridBoundarySpacingAxes(params: TrayParams) {
  const { spacingX, spacingY } = getGridSpacingAxes(params);
  return {
    boundarySpacingX: params.boundarySpacingIndependent
      ? params.boundarySpacing
      : spacingX,
    boundarySpacingY: params.boundarySpacingIndependent
      ? params.boundarySpacing
      : spacingY,
  };
}

export function getGridSlotPitchAxes(params: TrayParams) {
  const slot = getGridSlotGeometry(params);
  const { spacingX, spacingY } = getGridSpacingAxes(params);
  return {
    pitchX:
      (slot.shape === "rectangle" ? slot.baseWidth : slot.slotWidth) + spacingX,
    pitchY:
      (slot.shape === "rectangle" ? slot.baseHeight : slot.slotHeight) + spacingY,
  };
}

export function shouldRemoveGridIslands(params: TrayParams) {
  const { spacingX, spacingY } = getGridSpacingAxes(params);
  return (
    !params.basePlateOnly &&
    params.rows > 1 &&
    params.columns > 1 &&
    spacingX === 0 &&
    spacingY === 0
  );
}

/** 网格槽位阵列内容外接尺寸（最终槽位轮廓 + 行列间距）。 */
export function getGridBoxContentSize(params: TrayParams) {
  const slot = getGridSlotGeometry(params);
  const { pitchX, pitchY } = getGridSlotPitchAxes(params);
  return {
    contentWidth: slot.slotWidth + (params.columns - 1) * pitchX,
    contentDepth: slot.slotHeight + (params.rows - 1) * pitchY,
  };
}

/** 盒体开启时，"扩展盒体至刚好容纳"所需的最小外部长宽。 */
export function calculateGridBoxRequiredOuterSize(params: TrayParams) {
  const box = resolveStackableBoxParams(params.stackableBox);
  const { contentWidth, contentDepth } = getGridBoxContentSize(params);
  return calculateBoxRequiredOuterSize(contentWidth, contentDepth, box);
}
