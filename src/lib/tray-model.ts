import { booleans, primitives, transforms } from "@jscad/modeling";
import type { Geom3 } from "@jscad/modeling/src/geometries/types";
import type { StackableBoxParams, TrayParams } from "@/types/tray";
import { RENDER_CONFIG } from "@/lib/config";
import {
  createBaseBody,
  subtractBaseHoleConstructionPlan,
} from "@/lib/model-utils";
import { planGridTrayConstruction, type FlatTrayGroove } from "@/lib/flat-tray-construction";
import {
  getGridBoundarySpacingAxes,
  getGridCutGeometry,
  getGridSlotPitchAxes,
} from "@/lib/grid-layout-math";
import { resolveStackableBoxParams } from "@/lib/stackable-box";
import { createStackableBoxBody } from "@/lib/stackable-box-model";
import type { FlatTrayCutSource } from "@/lib/manual-split-cad";

export {
  getGridBoundarySpacingAxes,
  getGridSlotPitchAxes,
  getGridSpacingAxes,
  shouldRemoveGridIslands,
} from "@/lib/grid-layout-math";

const { intersect, subtract, union } = booleans;
const { cuboid, cylinder } = primitives;
const { translate } = transforms;

/**
 * 根据参数生成托盘 3D 模型（JSCAD geom3）
 *
 * 结构说明：
 * - 底板 + 墙壁一体，通过 2D 圆角矩形线性拉伸生成
 *   → 圆角只出现在竖直方向的 4 条边上
 * - 凹槽从顶部向下挖，深度 = holeDepth，到达底板顶面
 * - 总高度 = baseThickness + holeDepth，仅底板模式下为 baseThickness
 * - 间距支持统一 / X-Y 独立：边-凹槽与凹槽-凹槽分别按轴计算
 * - 凹槽实际直径 = slotDiameter 快照；旧参数缺失时按兼容规则补齐
 */
function createHalfCircleTrayBody(
  width: number,
  depth: number,
  baseThickness: number,
  holeDepth: number,
  cornerRadius: number,
  sideBevelWidth: number,
  splitAxis: "x" | "y",
) {
  const totalHeight = baseThickness + holeDepth;
  const safeSideBevelWidth = Math.max(
    0,
    Math.min(sideBevelWidth, width / 2 - 0.1, depth / 2 - 0.1),
  );
  const baseBevelWidth = safeSideBevelWidth * (baseThickness / totalHeight);
  const upperBevelWidth = safeSideBevelWidth - baseBevelWidth;
  const upperWidth = width - baseBevelWidth * 2;
  const upperDepth = depth - baseBevelWidth * 2;
  const upperCornerRadius = Math.max(cornerRadius - baseBevelWidth, 0);
  const base = createBaseBody(
    width,
    depth,
    baseThickness,
    cornerRadius,
    baseBevelWidth,
  );
  const upper = translate(
    [0, 0, baseThickness],
    createBaseBody(
      upperWidth,
      upperDepth,
      holeDepth,
      upperCornerRadius,
      upperBevelWidth,
    ),
  );
  const clipCenter: [number, number, number] =
    splitAxis === "y"
      ? [0, -depth / 4, baseThickness + holeDepth / 2]
      : [-width / 4, 0, baseThickness + holeDepth / 2];
  const clipSize: [number, number, number] =
    splitAxis === "y"
      ? [width + 1, depth / 2, holeDepth + 0.1]
      : [width / 2, depth + 1, holeDepth + 0.1];
  const farSideUpper = intersect(
    upper,
    cuboid({
      center: clipCenter,
      size: clipSize,
    }),
  );

  return union(base, farSideUpper);
}

function realizeGridGroove({ shape, width, height, cx, cy, bottom, length }: FlatTrayGroove) {
  return translate([cx, cy, bottom + length / 2], shape === "circle"
    ? cylinder({ radius: width / 2, height: length, segments: RENDER_CONFIG.cylinderSegments })
    : cuboid({ size: [width, height, length] }));
}

function createStackableBoxGridModel(params: TrayParams, box: StackableBoxParams): Geom3 {
  const { height, grooves, baseHoles } = planGridTrayConstruction(params);
  const body = createStackableBoxBody({
    outerWidth: box.outerWidth,
    outerDepth: box.outerDepth,
    outerHeight: box.outerHeight,
    trayTopZ: height,
    xyFitClearance: box.xyFitClearance,
  });
  return subtractBaseHoleConstructionPlan(grooves.length ? subtract(body, ...grooves.map(realizeGridGroove)) : body, baseHoles);
}

export function createTrayModel(params: TrayParams, captureSplitSource?: (source: FlatTrayCutSource) => void): Geom3 {
  const box = resolveStackableBoxParams(params.stackableBox);
  if (box.enabled) {
    return createStackableBoxGridModel(params, box);
  }
  const source = prepareGridTrayCutSource(params);
  captureSplitSource?.(source);
  const tray = source.grooves.length ? subtract(source.body, ...source.grooves) : source.body;
  return subtractBaseHoleConstructionPlan(tray, source.baseHoles);
}

export function prepareGridTrayCutSource(params: TrayParams): FlatTrayCutSource {
  const { width, depth, height, halfAxis, grooves, baseHoles } = planGridTrayConstruction(params);
  const body = halfAxis
    ? createHalfCircleTrayBody(width, depth, params.baseThickness, params.holeDepth,
        params.cornerRadius, params.sideBevelWidth, halfAxis)
    : createBaseBody(width, depth, height, params.cornerRadius, params.sideBevelWidth);
  return { body, grooves: grooves.map(realizeGridGroove), baseHoles, clipGroovesToBody: halfAxis !== null };
}

/**
 * 根据参数计算托盘的理论外观尺寸 (mm)
 */
export function calculateTrayDimensions(params: TrayParams) {
  const {
    rows,
    columns,
    baseThickness,
    holeDepth,
  } = params;
  const slot = getGridCutGeometry(params);
  const { pitchX, pitchY } = getGridSlotPitchAxes(params);
  const { boundarySpacingX, boundarySpacingY } =
    getGridBoundarySpacingAxes(params);
  return {
    width:
      2 * boundarySpacingX +
      slot.slotWidth +
      (columns - 1) * pitchX +
      Math.max(0, params.sideBevelWidth) * 2,
    depth:
      2 * boundarySpacingY +
      slot.slotHeight +
      (rows - 1) * pitchY +
      Math.max(0, params.sideBevelWidth) * 2,
    height: params.basePlateOnly ? baseThickness : baseThickness + holeDepth,
  };
}
