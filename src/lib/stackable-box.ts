import type { StackableBoxParams } from "@/types/tray";

/**
 * 堆叠盒体结构的纯领域计算：固定制造规格、默认值、范围与纯几何投影。
 *
 * 约束：本模块不依赖 React、Worker 或 JSCAD；所有固定制造值只在此定义一次，
 * 业务代码不得散落 `??` 默认值，统一通过 resolver 补全。
 */

// ── 固定制造规格（不进入普通参数面板，不允许逐模型修改） ──────────

export const STACKABLE_BOX_SPECS = {
  /** 主体墙厚 (mm) */
  bodyWallThickness: 2.4,
  /** 外轮廓圆角 (mm) */
  outerCornerRadius: 6.0,
  /** 顶部局部承重边宽 (mm) */
  topRimWidth: 4.0,
  /** 底部定位凸缘宽 (mm) */
  flangeWidth: 1.2,
  /** 底部定位凸缘高度 (mm) */
  flangeHeight: 1.2,
  /** 顶部定位凹槽深度 (mm) */
  grooveDepth: 1.4,
  /** 凸缘与凹槽底部余量 (mm) */
  flangeGrooveBottomClearance: 0.2,
  /** 定位环中心线距外侧面 (mm) */
  locatorRingCenterlineInset: 2.0,
  /** 凸缘入口倒角 (mm × 45°) */
  flangeEntryChamfer: 0.3,
  /** 盒壁必须高出内部托盘顶面的最小值 (mm) */
  minWallRise: 2.4,
  /** 盒壁高出托盘顶面不足该值时提示浅盒 (mm) */
  shallowBoxThreshold: 10,
  /** 盖子短边指甲槽：宽度 (mm) */
  nailNotchWidth: 18,
  /** 盖子短边指甲槽：高度 (mm) */
  nailNotchHeight: 1.0,
  /** 盖子短边指甲槽：向内深度 (mm) */
  nailNotchDepth: 1.2,
} as const;

/** 任一轴超过该尺寸仅警告，不阻断 (mm) */
export const STACKABLE_BOX_MAX_BUILD_SIZE = 260;

// ── 默认值与范围 ──────────

/**
 * 默认关闭的堆叠盒体参数。
 * outerWidth / outerDepth 为休眠占位值：启用盒体时由当前布局一次性计算覆盖。
 */
export const STACKABLE_BOX_DEFAULTS = {
  enabled: false,
  outerWidth: 100,
  outerDepth: 100,
  outerHeight: 50,
  minimumWallClearance: 2,
  xyFitClearance: 0.25,
  lidThickness: 2.4,
} as const satisfies StackableBoxParams;

export const STACKABLE_BOX_LIMITS = {
  outerWidth: { label: "盒体长度", min: 30, max: 5000, step: 0.1, unit: "mm" },
  outerDepth: { label: "盒体宽度", min: 30, max: 5000, step: 0.1, unit: "mm" },
  outerHeight: {
    label: "盒体高度",
    // 高度使用动态结构下限（trayTopZ + minWallRise），静态下限仅为兜底值。
    min: 1,
    max: 5000,
    step: 0.1,
    unit: "mm",
  },
  minimumWallClearance: {
    label: "最小内壁间距",
    min: 0,
    max: 20,
    step: 1,
    unit: "mm",
  },
  xyFitClearance: {
    label: "XY 配合间隙",
    min: 0.15,
    max: 0.5,
    step: 0.01,
    unit: "mm",
  },
  lidThickness: {
    label: "盖板厚度",
    min: 2.0,
    max: 4.0,
    step: 0.1,
    unit: "mm",
  },
} as const;

// ── Resolver ──────────

function clampFinite(value: unknown, min: number, max: number, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : fallback;
}

/** 生成默认关闭的盒体参数副本。 */
export function createDefaultStackableBoxParams(): StackableBoxParams {
  return { ...STACKABLE_BOX_DEFAULTS };
}

/**
 * 运行时统一补全盒体参数：缺失字段回落到默认值，非法数值回落到范围钳制。
 * 保留原始 enabled 布尔语义；禁用时同样规范化休眠值，避免重新启用时恢复非法参数。
 */
export function resolveStackableBoxParams(
  params: StackableBoxParams | undefined,
): StackableBoxParams {
  const source = params ?? createDefaultStackableBoxParams();
  return {
    enabled: source.enabled === true,
    outerWidth: clampFinite(
      source.outerWidth,
      STACKABLE_BOX_LIMITS.outerWidth.min,
      STACKABLE_BOX_LIMITS.outerWidth.max,
      STACKABLE_BOX_DEFAULTS.outerWidth,
    ),
    outerDepth: clampFinite(
      source.outerDepth,
      STACKABLE_BOX_LIMITS.outerDepth.min,
      STACKABLE_BOX_LIMITS.outerDepth.max,
      STACKABLE_BOX_DEFAULTS.outerDepth,
    ),
    outerHeight: clampFinite(
      source.outerHeight,
      STACKABLE_BOX_LIMITS.outerHeight.min,
      STACKABLE_BOX_LIMITS.outerHeight.max,
      STACKABLE_BOX_DEFAULTS.outerHeight,
    ),
    minimumWallClearance: clampFinite(
      source.minimumWallClearance,
      STACKABLE_BOX_LIMITS.minimumWallClearance.min,
      STACKABLE_BOX_LIMITS.minimumWallClearance.max,
      STACKABLE_BOX_DEFAULTS.minimumWallClearance,
    ),
    xyFitClearance: clampFinite(
      source.xyFitClearance,
      STACKABLE_BOX_LIMITS.xyFitClearance.min,
      STACKABLE_BOX_LIMITS.xyFitClearance.max,
      STACKABLE_BOX_DEFAULTS.xyFitClearance,
    ),
    lidThickness: clampFinite(
      source.lidThickness,
      STACKABLE_BOX_LIMITS.lidThickness.min,
      STACKABLE_BOX_LIMITS.lidThickness.max,
      STACKABLE_BOX_DEFAULTS.lidThickness,
    ),
  };
}

// ── 纯几何投影 ──────────

/** 盒口最窄处由顶部承重边决定；槽位允许区域按该内缩计算。 */
export interface BoxUsableOpening {
  /** 盒口内侧到槽位允许区域的距离 (mm) */
  usableInset: number;
  usableWidth: number;
  usableDepth: number;
  usableCornerRadius: number;
}

export function calculateBoxUsableOpening(
  params: StackableBoxParams,
): BoxUsableOpening {
  const usableInset =
    STACKABLE_BOX_SPECS.topRimWidth + params.minimumWallClearance;
  return {
    usableInset,
    usableWidth: params.outerWidth - 2 * usableInset,
    usableDepth: params.outerDepth - 2 * usableInset,
    usableCornerRadius: Math.max(
      STACKABLE_BOX_SPECS.outerCornerRadius - usableInset,
      0,
    ),
  };
}

/** 盒体垂直尺寸投影。 */
export interface BoxHeightProjection {
  /** 槽底 Z 高度 (mm)，即 baseThickness */
  slotFloorZ: number;
  /** 内部托盘顶面 Z 高度 (mm) */
  trayTopZ: number;
  /** 满足盒壁最小高出量的外高下限 (mm) */
  minimumOuterHeight: number;
  /** 带盖净高 (mm) */
  lidClearHeight: number;
  /** 堆叠安全净高 (mm)，扣除凸缘侵入量 */
  stackClearHeight: number;
  /** 盖上盖子后的闭合外高 (mm) */
  closedOuterHeight: number;
}

export function calculateBoxHeightProjection(
  params: StackableBoxParams,
  baseThickness: number,
  holeDepth: number,
  basePlateOnly = false,
): BoxHeightProjection {
  const slotFloorZ = baseThickness;
  const trayTopZ = basePlateOnly ? baseThickness : baseThickness + holeDepth;
  const minimumOuterHeight = trayTopZ + STACKABLE_BOX_SPECS.minWallRise;
  const lidClearHeight = params.outerHeight - slotFloorZ;
  const stackClearHeight = lidClearHeight - STACKABLE_BOX_SPECS.flangeHeight;
  const closedOuterHeight = params.outerHeight + params.lidThickness;

  return {
    slotFloorZ,
    trayTopZ,
    minimumOuterHeight,
    lidClearHeight,
    stackClearHeight,
    closedOuterHeight,
  };
}

/** 向上取整到 0.1 mm 精度。 */
export function roundBoxDimensionUp(value: number): number {
  return Math.ceil(value * 10) / 10;
}

/** 由内容外接范围 + 两侧可用内缩计算所需外部尺寸（向上取 0.1 mm）。 */
export function calculateBoxRequiredOuterSize(
  contentWidth: number,
  contentDepth: number,
  params: StackableBoxParams,
) {
  const { usableInset } = calculateBoxUsableOpening(params);
  return {
    outerWidth: roundBoxDimensionUp(contentWidth + 2 * usableInset),
    outerDepth: roundBoxDimensionUp(contentDepth + 2 * usableInset),
  };
}

// ── 圆角矩形区域判定（槽位边界校验的纯函数） ──────────

export interface RoundedRectangleArea {
  x: number;
  y: number;
  width: number;
  depth: number;
  cornerRadius: number;
}

export function isPointWithinRoundedRectangle(
  x: number,
  y: number,
  area: RoundedRectangleArea,
): boolean {
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

export function isPolygonWithinRoundedRectangle(
  points: readonly { x: number; y: number }[],
  area: RoundedRectangleArea,
): boolean {
  return points.every((point) =>
    isPointWithinRoundedRectangle(point.x, point.y, area),
  );
}

/** 盒体安全边界（供槽位边界校验），在盒体左下角坐标系中。 */
export function calculateBoxUsableArea(
  params: StackableBoxParams,
): RoundedRectangleArea {
  const opening = calculateBoxUsableOpening(params);
  return {
    x: opening.usableInset,
    y: opening.usableInset,
    width: opening.usableWidth,
    depth: opening.usableDepth,
    cornerRadius: opening.usableCornerRadius,
  };
}

// ── 校验结果 ──────────

export type BoxBlockingCode =
  | "outer-dimensions-insufficient"
  | "outer-height-below-minimum"
  | "custom-contoured-with-box"
  | "grid-half-circle-with-box"
  | "slot-in-safety-boundary"
  | "clearance-or-lid-out-of-range"
  | "base-hole-incompatible";

export interface BoxBlockingReason {
  code: BoxBlockingCode;
  message: string;
}

export type BoxWarningCode = "shallow-box" | "oversized-axis";

export interface BoxWarning {
  code: BoxWarningCode;
  message: string;
}

/** 槽位越界明细：当前外尺寸、最小所需外尺寸与 X/Y 差值。 */
export interface BoxSlotOverflow {
  currentWidth: number;
  currentDepth: number;
  requiredWidth: number;
  requiredDepth: number;
  deltaX: number;
  deltaY: number;
}

export interface BoxValidationResult {
  valid: boolean;
  blockingReasons: BoxBlockingReason[];
  warnings: BoxWarning[];
  overflow?: BoxSlotOverflow;
}

/** 校验字段值是否落在范围与基础几何内；不涉及槽位轮廓。 */
export function validateBoxBaseGeometry(
  params: StackableBoxParams,
  baseThickness: number,
  holeDepth: number,
  basePlateOnly = false,
): BoxValidationResult {
  const reasons: BoxBlockingReason[] = [];
  const warnings: BoxWarning[] = [];

  const opening = calculateBoxUsableOpening(params);
  if (opening.usableWidth <= 0 || opening.usableDepth <= 0) {
    reasons.push({
      code: "outer-dimensions-insufficient",
      message: "盒体外部长宽无法容纳固定圆角与顶部承重边",
    });
  }

  const height = calculateBoxHeightProjection(
    params,
    baseThickness,
    holeDepth,
    basePlateOnly,
  );
  if (params.outerHeight < height.minimumOuterHeight) {
    reasons.push({
      code: "outer-height-below-minimum",
      message: `盒体外高低于结构下限 ${height.minimumOuterHeight.toFixed(1)} mm`,
    });
  }

  if (params.xyFitClearance < STACKABLE_BOX_LIMITS.xyFitClearance.min ||
    params.xyFitClearance > STACKABLE_BOX_LIMITS.xyFitClearance.max) {
    reasons.push({
      code: "clearance-or-lid-out-of-range",
      message: "XY 配合间隙超出允许范围",
    });
  }
  if (params.lidThickness < STACKABLE_BOX_LIMITS.lidThickness.min ||
    params.lidThickness > STACKABLE_BOX_LIMITS.lidThickness.max) {
    reasons.push({
      code: "clearance-or-lid-out-of-range",
      message: "盖板厚度超出允许范围",
    });
  }

  // 浅盒提示：盒壁高出托盘顶面不足 10 mm
  const wallRise = params.outerHeight - height.trayTopZ;
  if (wallRise < STACKABLE_BOX_SPECS.shallowBoxThreshold) {
    warnings.push({
      code: "shallow-box",
      message: `盒壁高出内部托盘顶面仅 ${wallRise.toFixed(1)} mm，属于浅盒`,
    });
  }

  // 三轴超常规打印尺寸仅警告
  const oversizedAxes: string[] = [];
  if (params.outerWidth > STACKABLE_BOX_MAX_BUILD_SIZE) oversizedAxes.push("长度");
  if (params.outerDepth > STACKABLE_BOX_MAX_BUILD_SIZE) oversizedAxes.push("宽度");
  if (params.outerHeight > STACKABLE_BOX_MAX_BUILD_SIZE) oversizedAxes.push("高度");
  if (oversizedAxes.length > 0) {
    warnings.push({
      code: "oversized-axis",
      message: `${oversizedAxes.join("、")}超过 ${STACKABLE_BOX_MAX_BUILD_SIZE} mm，超出常规打印尺寸`,
    });
  }

  return {
    valid: reasons.length === 0,
    blockingReasons: reasons,
    warnings,
  };
}

/** 顶部定位凹槽横截面宽度 (mm)。 */
export function calculateBoxGrooveWidth(params: StackableBoxParams): number {
  return STACKABLE_BOX_SPECS.flangeWidth + 2 * params.xyFitClearance;
}
