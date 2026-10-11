import { getEllipseBoundingBox } from "@/lib/canvas-slot-geometry";
import { getFreeSlotProfileGeometry } from "@/lib/slot-definitions";
import { sampleSlotProfilePoints } from "@/lib/slot-profile-geometry";
import { RENDER_CONFIG } from "@/lib/config";
import type { ConstructedContouredFootprint } from "@/lib/contoured-footprint";
import type { ContouredFootprintState } from "@/lib/contoured-footprint-state";
import type { CustomBaseplateFootprintStyle, CustomLayoutParams, FreeSlot } from "@/types/custom-tray";
import {
  calculateBoxRequiredOuterSize,
  calculateBoxUsableArea,
  isPointWithinRoundedRectangle,
  resolveStackableBoxParams,
  validateBoxBaseGeometry,
  type BoxValidationResult,
} from "@/lib/stackable-box";

export type CustomTraySizingMode = "auto" | "fixed";

export interface LayoutExtents {
  width: number;
  depth: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface CustomTrayFootprint {
  sizingMode: CustomTraySizingMode;
  footprintStyle: CustomBaseplateFootprintStyle;
  hasSlots: boolean;
  width: number;
  depth: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  /** contoured footprint 产生的独立可打印实体数；rectangular 始终为 1（或 0 当无槽）。 */
  contourBodyCount: number;
}

export interface FixedCustomTrayUsableArea {
  x: number;
  y: number;
  width: number;
  depth: number;
  cornerRadius: number;
}

export function roundLayoutDimensionToTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

export function resolveCustomBoundarySpacing(
  params: CustomLayoutParams,
): number {
  if (params.boundarySpacingIndependent) {
    return params.boundarySpacing;
  }

  return params.spacing;
}

export function resolveCustomTraySizingMode(
  params: Pick<CustomLayoutParams, "traySizingMode">,
): CustomTraySizingMode {
  return params.traySizingMode === "fixed" ? "fixed" : "auto";
}

/**
 * 解析自定义模式的底座轮廓样式；缺失时默认 rectangular 以兼容旧配置（CONTEXT:591）。
 */
export function resolveCustomFootprintStyle(
  params: Pick<CustomLayoutParams, "footprintStyle">,
): CustomBaseplateFootprintStyle {
  return params.footprintStyle === "contoured" || params.footprintStyle === "polygonal"
    ? params.footprintStyle : "rectangular";
}

export function calculateCustomEffectiveDimensions(
  params: CustomLayoutParams,
): LayoutExtents {
  const boundarySpacing = resolveCustomBoundarySpacing(params);
  if (params.slots.length === 0) {
    return {
      width: 0,
      depth: 0,
      minX: 0,
      maxX: 0,
      minY: 0,
      maxY: 0,
    };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  params.slots.forEach((slot) => {
    const profile = getFreeSlotProfileGeometry(slot);
    const { halfW, halfH } = getEllipseBoundingBox(
      profile.width,
      profile.height,
      slot.rotation,
      slot.shape,
      profile.profileExponent,
      profile.outerOffset,
    );
    minX = Math.min(minX, slot.x - halfW);
    maxX = Math.max(maxX, slot.x + halfW);
    minY = Math.min(minY, slot.y - halfH);
    maxY = Math.max(maxY, slot.y + halfH);
  });

  return {
    width: roundLayoutDimensionToTenth(
      maxX - minX + boundarySpacing * 2,
    ),
    depth: roundLayoutDimensionToTenth(
      maxY - minY + boundarySpacing * 2,
    ),
    minX,
    maxX,
    minY,
    maxY,
  };
}

export function calculateCustomTrayFootprint(
  params: CustomLayoutParams,
  contouredState: ContouredFootprintState<ConstructedContouredFootprint> = {
    status: "inactive",
  },
): CustomTrayFootprint {
  const sizingMode = resolveCustomTraySizingMode(params);
  const footprintStyle = resolveCustomFootprintStyle(params);

  // contoured 分支：底座贴合槽位轮廓，不应用 side bevel / fixed sizing / corner radius。
  // 这些字段保留为 Dormant Fixed Tray Configuration，切换回 rectangular 时复活（CONTEXT:607-608）。
  if (footprintStyle !== "rectangular") {
    if (contouredState.status !== "ready") {
      return {
        sizingMode: "auto",
        footprintStyle,
        hasSlots: false,
        width: params.trayWidth,
        depth: params.trayDepth,
        minX: 0,
        maxX: 0,
        minY: 0,
        maxY: 0,
        contourBodyCount: 0,
      };
    }
    const contoured = contouredState.value;
    const width = roundLayoutDimensionToTenth(
      (contoured.bounds?.maxX ?? 0) - (contoured.bounds?.minX ?? 0),
    );
    const depth = roundLayoutDimensionToTenth(
      (contoured.bounds?.maxY ?? 0) - (contoured.bounds?.minY ?? 0),
    );
    return {
      sizingMode: "auto", // contoured 下 fixed sizing 休眠，按派生尺寸返回
      footprintStyle,
      hasSlots: contoured.bodyCount > 0,
      width: width > 0 ? width : params.trayWidth,
      depth: depth > 0 ? depth : params.trayDepth,
      minX: contoured.bounds?.minX ?? 0,
      maxX: contoured.bounds?.maxX ?? 0,
      minY: contoured.bounds?.minY ?? 0,
      maxY: contoured.bounds?.maxY ?? 0,
      contourBodyCount: contoured.bodyCount,
    };
  }

  // rectangular 分支：保持现有语义
  if (sizingMode === "fixed") {
    return {
      sizingMode,
      footprintStyle,
      hasSlots: params.slots.length > 0,
      width: params.trayWidth,
      depth: params.trayDepth,
      minX: 0,
      maxX: params.trayWidth,
      minY: 0,
      maxY: params.trayDepth,
      contourBodyCount: params.slots.length > 0 ? 1 : 0,
    };
  }

  const effective = calculateCustomEffectiveDimensions(params);
  const sideBevelWidth = Math.max(0, params.sideBevelWidth);
  return {
    sizingMode,
    footprintStyle,
    hasSlots: effective.width > 0 && effective.depth > 0,
    width: effective.width > 0 ? effective.width + sideBevelWidth * 2 : params.trayWidth,
    depth: effective.depth > 0 ? effective.depth + sideBevelWidth * 2 : params.trayDepth,
    minX: effective.minX,
    maxX: effective.maxX,
    minY: effective.minY,
    maxY: effective.maxY,
    contourBodyCount: effective.width > 0 && effective.depth > 0 ? 1 : 0,
  };
}

export function calculateFixedCustomTrayUsableArea(
  params: CustomLayoutParams,
): FixedCustomTrayUsableArea {
  const safeBevelWidth = Math.max(
    0,
    Math.min(
      params.sideBevelWidth,
      params.trayWidth / 2 - 0.1,
      params.trayDepth / 2 - 0.1,
    ),
  );
  const outerCornerRadius = Math.max(
    0,
    Math.min(
      params.cornerRadius,
      params.trayWidth / 2 - 0.01,
      params.trayDepth / 2 - 0.01,
    ),
  );
  const inset = safeBevelWidth + resolveCustomBoundarySpacing(params);
  const width = Math.max(0, params.trayWidth - inset * 2);
  const depth = Math.max(0, params.trayDepth - inset * 2);

  return {
    x: inset,
    y: inset,
    width,
    depth,
    cornerRadius: Math.max(
      0,
      Math.min(outerCornerRadius - inset, width / 2, depth / 2),
    ),
  };
}

function isPointWithinRoundedArea(
  x: number,
  y: number,
  area: FixedCustomTrayUsableArea,
) {
  if (
    x < area.x ||
    x > area.x + area.width ||
    y < area.y ||
    y > area.y + area.depth
  ) {
    return false;
  }

  if (area.cornerRadius <= 0) {
    return true;
  }

  const centerX = Math.min(
    Math.max(x, area.x + area.cornerRadius),
    area.x + area.width - area.cornerRadius,
  );
  const centerY = Math.min(
    Math.max(y, area.y + area.cornerRadius),
    area.y + area.depth - area.cornerRadius,
  );
  return Math.hypot(x - centerX, y - centerY) <= area.cornerRadius + 1e-6;
}

export function isCustomSlotWithinFixedTrayUsableArea(
  slot: FreeSlot,
  area: FixedCustomTrayUsableArea,
): boolean {
  const profile = getFreeSlotProfileGeometry(slot);
  const radians = (slot.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const points = sampleSlotProfilePoints(
    profile.width,
    profile.height,
    slot.shape,
    profile.outerOffset,
    RENDER_CONFIG.cylinderSegments,
    profile.profileExponent,
  );

  return points.every((point) =>
    isPointWithinRoundedArea(
      slot.x + point.x * cos - point.y * sin,
      slot.y + point.x * sin + point.y * cos,
      area,
    ),
  );
}

/** 盒体开启时，自由槽位是否完全位于盒体可用区域内。 */
export function isCustomSlotWithinBoxUsableArea(
  slot: FreeSlot,
  box: ReturnType<typeof resolveStackableBoxParams>,
): boolean {
  const area = calculateBoxUsableArea(box);
  const profile = getFreeSlotProfileGeometry(slot);
  const radians = (slot.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const points = sampleSlotProfilePoints(
    profile.width,
    profile.height,
    slot.shape,
    profile.outerOffset,
    RENDER_CONFIG.cylinderSegments,
    profile.profileExponent,
  );

  return points.every((point) =>
    isPointWithinRoundedRectangle(
      slot.x + point.x * cos - point.y * sin,
      slot.y + point.x * sin + point.y * cos,
      area,
    ),
  );
}

/** 盒体开启时，"扩展盒体至刚好容纳"所需的最小外部长宽（空盒不改变当前尺寸）。 */
export function calculateCustomBoxRequiredOuterSize(params: CustomLayoutParams) {
  const box = resolveStackableBoxParams(params.stackableBox);
  if (params.slots.length === 0) {
    return { outerWidth: box.outerWidth, outerDepth: box.outerDepth };
  }
  const extents = calculateCustomEffectiveDimensions(params);
  const contentWidth = extents.maxX - extents.minX;
  const contentDepth = extents.maxY - extents.minY;
  return calculateBoxRequiredOuterSize(contentWidth, contentDepth, box);
}

/** 盒体开启时的权威校验：基础几何 + 槽位安全边界。盒体关闭时始终通过。 */
export function validateCustomBox(params: CustomLayoutParams): BoxValidationResult {
  const box = resolveStackableBoxParams(params.stackableBox);
  if (!box.enabled) {
    return { valid: true, blockingReasons: [], warnings: [] };
  }

  if (resolveCustomFootprintStyle(params) !== "rectangular") {
    return {
      valid: false,
      blockingReasons: [
        {
          code: "custom-contoured-with-box",
          message: params.footprintStyle === "polygonal"
            ? "直边包络自定义托盘不支持堆叠盒体"
            : "贴合轮廓自定义托盘不支持堆叠盒体",
        },
      ],
      warnings: [],
    };
  }

  const base = validateBoxBaseGeometry(
    box,
    params.baseThickness,
    params.holeDepth,
    false,
  );

  let overflow;
  for (const slot of params.slots) {
    if (!isCustomSlotWithinBoxUsableArea(slot, box)) {
      const required = calculateCustomBoxRequiredOuterSize(params);
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
      break;
    }
  }

  return {
    valid: base.valid && base.blockingReasons.length === 0,
    blockingReasons: base.blockingReasons,
    warnings: base.warnings,
    overflow,
  };
}
