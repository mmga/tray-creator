import {
  booleans,
  geometries,
  transforms,
  extrusions,
  measurements,
} from "@jscad/modeling";
import type { Geom3 } from "@jscad/modeling/src/geometries/types";
import type { CustomLayoutParams } from "@/types/custom-tray";
import {
  calculateCustomTrayFootprint,
  resolveCustomFootprintStyle,
} from "@/lib/custom-layout-math";
import type { ConstructedContouredFootprint } from "@/lib/contoured-footprint";
import type { ContouredFootprintState } from "@/lib/contoured-footprint-state";
import { planCustomTrayConstruction, type FlatTrayGroove } from "@/lib/flat-tray-construction";
import {
  createBaseBody,
  createOffsetSlotShape,
  subtractBaseHoleConstructionPlan,
} from "@/lib/model-utils";
import { resolveStackableBoxParams } from "@/lib/stackable-box";
import { createStackableBoxBody } from "@/lib/stackable-box-model";
import type { FlatTrayCutSource } from "@/lib/manual-split-cad";

const { subtract, union } = booleans;
const { geom3 } = geometries;
const { translate, rotateZ } = transforms;
const { extrudeLinear } = extrusions;
const { measureVolume } = measurements;

const DEG_TO_RAD = Math.PI / 180;

/**
 * 保证几何体积为正，避免布尔运算后法线方向反转导致 measureVolume 返回负值。
 * 参考 stepped-cad-realization.ts 的同名 Implementation。
 */
function orientPositiveVolume(geometry: Geom3): Geom3 {
  return measureVolume(geometry) < 0 ? geom3.invert(geometry) : geometry;
}

/**
 * 根据自定义参数生成托盘 3D 模型
 *
 * 坐标系说明：
 * - JSCAD 原点 (0,0,0) 对应托盘底板中心
 * - 用户坐标 (x,y) 原点对应托盘左下角
 * - 转换公式：jscad_x = user_x - width/2, jscad_y = user_y - depth/2
 *
 * 底座轮廓样式（footprintStyle）：
 * - rectangular：createBaseBody 生成圆角矩形 + 可选侧面斜角，保持原语义
 * - contoured：直接拉伸 Contoured Footprint Construction 的 2D bodies；
 *   不应用 corner radius / side bevel（CONTEXT:615-617），允许产生多个独立实体
 */
export function createCustomTrayModel(
  params: CustomLayoutParams,
  contouredState: ContouredFootprintState<ConstructedContouredFootprint> = {
    status: "inactive",
  },
  captureSplitSource?: (source: FlatTrayCutSource) => void,
): Geom3 {
  const box = resolveStackableBoxParams(params.stackableBox);
  if (box.enabled && resolveCustomFootprintStyle(params) === "rectangular") {
    return createStackableBoxCustomModel(params, box, contouredState);
  }
  const source = prepareCustomTrayCutSource(params, contouredState);
  captureSplitSource?.(source);
  const tray = source.grooves.length ? subtract(source.body, ...source.grooves) : source.body;
  return subtractBaseHoleConstructionPlan(tray, source.baseHoles);
}

export function prepareCustomTrayCutSource(
  params: CustomLayoutParams,
  contouredState: ContouredFootprintState<ConstructedContouredFootprint>,
): FlatTrayCutSource {
  if (resolveCustomFootprintStyle(params) !== "rectangular" && contouredState.status !== "ready") {
    throw new Error(
      contouredState.status === "failed"
        ? contouredState.error.message
        : "Contoured Footprint Construction 结果未激活",
    );
  }
  const plan = planCustomTrayConstruction(params, contouredState);
  const body = plan.footprintStyle !== "rectangular" && contouredState.status === "ready"
    ? createContouredBaseBody(params, contouredState.value, plan.height)
    : createBaseBody(plan.width, plan.depth, plan.height, params.cornerRadius, params.sideBevelWidth);
  return { body, grooves: plan.grooves.map(realizeCustomGroove), baseHoles: plan.baseHoles };
}

function realizeCustomGroove(groove: FlatTrayGroove) {
  const { cx, cy, bottom, rotation, width, height, shape, outerOffset, profileExponent, length } = groove;
  const profile = createOffsetSlotShape(width, height, shape === "circle" ? "circle" : "ellipse", outerOffset, profileExponent);
  const cutter = extrudeLinear({ height: length }, profile);
  return translate([cx, cy, bottom], rotateZ(rotation * DEG_TO_RAD, cutter));
}

function createStackableBoxCustomModel(
  params: CustomLayoutParams,
  box: ReturnType<typeof resolveStackableBoxParams>,
  contouredState: ContouredFootprintState<ConstructedContouredFootprint>,
): Geom3 {
  const { height, grooves, baseHoles } = planCustomTrayConstruction(params, contouredState);
  const body = createStackableBoxBody({ outerWidth: box.outerWidth, outerDepth: box.outerDepth,
    outerHeight: box.outerHeight, trayTopZ: height, xyFitClearance: box.xyFitClearance });
  return subtractBaseHoleConstructionPlan(grooves.length ? subtract(body, ...grooves.map(realizeCustomGroove)) : body, baseHoles);
}

/**
 * 从 contoured footprint 的 2D bodies 拉伸生成底座实体。
 * contoured footprint 在用户坐标系中已经包含 boundary spacing 外扩，
 * 这里需要把用户坐标系中心（外接框中心）平移到 JSCAD 中心。
 */
function createContouredBaseBody(
  params: CustomLayoutParams,
  contoured: ConstructedContouredFootprint,
  totalHeight: number,
): Geom3 {
  if (contoured.bodies.length === 0) {
    // 无槽位时退化为占位底座，避免下游 measureVolume 等失败
    return createBaseBody(params.trayWidth, params.trayDepth, totalHeight, 0, 0);
  }

  // 把用户坐标系下的 2D 轮廓平移到 JSCAD 中心坐标系
  const centerX = ((contoured.bounds?.minX ?? 0) + (contoured.bounds?.maxX ?? 0)) / 2;
  const centerY = ((contoured.bounds?.minY ?? 0) + (contoured.bounds?.maxY ?? 0)) / 2;

  const solids = contoured.bodies.map((body) =>
    orientPositiveVolume(
      translate(
        [-centerX, -centerY, 0],
        extrudeLinear({ height: totalHeight }, body.geometry),
      ),
    ),
  );

  const combined = solids.length === 1 ? solids[0] : union(...solids);
  return orientPositiveVolume(combined);
}

/** 计算自定义托盘的边界尺寸。 */
export function calculateCustomTrayDimensions(
  params: CustomLayoutParams,
  contouredState: ContouredFootprintState<ConstructedContouredFootprint> = {
    status: "inactive",
  },
) {
  const footprint = calculateCustomTrayFootprint(params, contouredState);
  return {
    width: footprint.width,
    depth: footprint.depth,
    height: params.baseThickness + params.holeDepth,
  };
}
