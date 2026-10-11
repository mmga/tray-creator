import {
  getGridSlotGeometry,
  getZeroSpacingTolerance,
} from "@/lib/grid-config";
import type { TrayParams } from "@/types/tray";
import { RENDER_CONFIG } from "@/lib/config";
import {
  calculateBoxRequiredOuterSize,
  calculateBoxUsableArea,
  isPointWithinRoundedRectangle,
  resolveStackableBoxParams,
  validateBoxBaseGeometry,
  type BoxValidationResult,
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

/**
 * 返回实际用于切削与外接尺寸计算的槽位轮廓。
 * 方形/矩形槽在某轴零间距时不使用单槽 0.4mm 容差，而让相邻切削体按
 * 标称节距重叠，使整体阵列只在该轴外轮廓增加一次整体容差。
 */
export function getGridCutGeometry(params: TrayParams) {
  const slot = getGridSlotGeometry(params);
  if (slot.shape !== "rectangle") return slot;

  const { spacingX, spacingY } = getGridSpacingAxes(params);
  const overallTolerance = getZeroSpacingTolerance(params);
  return {
    ...slot,
    slotWidth: spacingX === 0 ? slot.baseWidth + overallTolerance : slot.slotWidth,
    slotHeight: spacingY === 0 ? slot.baseHeight + overallTolerance : slot.slotHeight,
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
  const slot = getGridCutGeometry(params);
  const { pitchX, pitchY } = getGridSlotPitchAxes(params);
  return {
    contentWidth: slot.slotWidth + (params.columns - 1) * pitchX,
    contentDepth: slot.slotHeight + (params.rows - 1) * pitchY,
  };
}

/** 判断网格中的一个槽位是否完全位于盒体安全区域内。 */
export function isGridSlotWithinBox(
  params: TrayParams,
  row: number,
  column: number,
): boolean {
  const box = resolveStackableBoxParams(params.stackableBox);
  if (!box.enabled) return true;

  const area = calculateBoxUsableArea(box);
  const slot = getGridCutGeometry(params);
  const { pitchX, pitchY } = getGridSlotPitchAxes(params);
  const { contentWidth, contentDepth } = getGridBoxContentSize(params);
  const centerX = box.outerWidth / 2;
  const centerY = box.outerDepth / 2;
  const cx = -contentWidth / 2 + slot.slotWidth / 2 + column * pitchX;
  const cy = -contentDepth / 2 + slot.slotHeight / 2 + row * pitchY;
  return sampleGridSlotPoints(slot, cx + centerX, cy + centerY).every((point) =>
    isPointWithinRoundedRectangle(point.x, point.y, area),
  );
}

/** 盒体开启时，"扩展盒体至刚好容纳"所需的最小外部长宽。 */
export function calculateGridBoxRequiredOuterSize(params: TrayParams) {
  const box = resolveStackableBoxParams(params.stackableBox);
  const { contentWidth, contentDepth } = getGridBoxContentSize(params);
  return calculateBoxRequiredOuterSize(contentWidth, contentDepth, box);
}

/** 网格槽位轮廓采样点（圆形圆周 / 矩形四角）。 */
function sampleGridSlotPoints(
  slot: ReturnType<typeof getGridSlotGeometry>,
  cx: number,
  cy: number,
) {
  if (slot.shape === "rectangle") {
    const hw = slot.slotWidth / 2;
    const hh = slot.slotHeight / 2;
    return [
      { x: cx - hw, y: cy - hh },
      { x: cx + hw, y: cy - hh },
      { x: cx + hw, y: cy + hh },
      { x: cx - hw, y: cy + hh },
    ];
  }
  const radius = slot.slotWidth / 2;
  const points: { x: number; y: number }[] = [];
  const segments = RENDER_CONFIG.cylinderSegments;
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    points.push({
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    });
  }
  return points;
}

/** 盒体开启时的权威网格校验：基础几何 + 槽位安全边界。 */
export function validateGridBox(params: TrayParams): BoxValidationResult {
  const box = resolveStackableBoxParams(params.stackableBox);
  if (!box.enabled) {
    return { valid: true, blockingReasons: [], warnings: [] };
  }

  const base = validateBoxBaseGeometry(
    box,
    params.baseThickness,
    params.holeDepth,
    params.basePlateOnly,
  );

  if (!params.basePlateOnly && params.halfCircleSlots) {
    base.blockingReasons.push({
      code: "grid-half-circle-with-box",
      message: "堆叠盒体结构不支持半圆槽，请切换为完整槽",
    });
  }

  let blocked = false;
  for (let row = 0; row < params.rows && !blocked; row++) {
    for (let col = 0; col < params.columns && !blocked; col++) {
      if (!isGridSlotWithinBox(params, row, col)) {
        blocked = true;
      }
    }
  }

  let overflow;
  if (blocked) {
    const required = calculateGridBoxRequiredOuterSize(params);
    overflow = {
      currentWidth: box.outerWidth,
      currentDepth: box.outerDepth,
      requiredWidth: required.outerWidth,
      requiredDepth: required.outerDepth,
      deltaX: Math.max(0, required.outerWidth - box.outerWidth),
      deltaY: Math.max(0, required.outerDepth - box.outerDepth),
    };
    base.blockingReasons.push({
      code: "slot-in-safety-boundary",
      message: "一个或多个槽位进入盒体安全边界",
    });
  }

  return {
    valid: base.valid && base.blockingReasons.length === 0,
    blockingReasons: base.blockingReasons,
    warnings: base.warnings,
    overflow,
  };
}
