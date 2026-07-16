import {
  booleans,
  extrusions,
  measurements,
  primitives,
  transforms,
} from "@jscad/modeling";
import type { Geom3 } from "@jscad/modeling/src/geometries/types";
import { RENDER_CONFIG } from "@/lib/config";
import { resolveMagneticBaseHolePreset } from "@/lib/base-hole-config";
import {
  calculateSimpleSteppedDimensions,
  deriveSimpleSteppedLayout,
  getSimpleSteppedEffectiveDiameter,
} from "@/lib/simple-stepped-layout";
import {
  createBaseBody,
  subtractBaseHoles,
  subtractMagnetPostHoles,
  type MagnetPostHoleCenter,
  type SlotCenter,
} from "@/lib/model-utils";
import type { SimpleSteppedLayoutParams } from "@/types/custom-tray";

const { subtract, union } = booleans;
const { extrudeLinear } = extrusions;
const { circle, cuboid } = primitives;
const { translate } = transforms;
const { measureVolume } = measurements;

function createEmptyGeom() {
  return cuboid({ size: [1, 1, 0.1], center: [0, 0, 0.05] });
}

/**
 * 简易阶梯模式 3D 模型
 *
 * 结构：
 * - 整体矩形底板，基础高度 = firstRowHeight
 * - 第 N 行在自己的矩形带上额外抬高 (N - 1) * stepHeight
 * - 所有凹槽从所属行顶部向下挖 holeDepth
 */
export function createSimpleSteppedTrayModel(
  params: SimpleSteppedLayoutParams,
): Geom3 {
  const derived = deriveSimpleSteppedLayout(params);
  const rows = derived.activeRows;

  if (rows.length === 0 || derived.trayWidth <= 0 || derived.trayDepth <= 0) {
    return createEmptyGeom();
  }

  const baseHeight = params.firstRowHeight;
  let solid = createBaseBody(
    derived.trayWidth,
    derived.trayDepth,
    baseHeight,
    params.cornerRadius,
  );

  rows.forEach((row) => {
    if (row.extraHeight <= 0) {
      return;
    }

    // 只有整体底板使用外圆角；阶梯层保持矩形，避免短行拉伸后 3D 仍出现视觉缩窄。
    const rowSolid = cuboid({
      size: [row.length, row.depth, row.extraHeight],
      center: [0, row.centerY - derived.trayDepth / 2, baseHeight + row.extraHeight / 2],
    });
    solid = union(solid, rowSolid);
  });

  const baseHoleCenters: SlotCenter[] = [];
  const magnetPostHoleCenters: MagnetPostHoleCenter[] = [];
  const holes: Geom3[] = rows.flatMap((row) =>
    row.slots.map((slot) => {
      const topHeight = row.topHeight;
      const clampedDepth = Math.min(params.holeDepth, topHeight);
      const floorHeight = topHeight - clampedDepth;
      const cx = slot.globalX - derived.trayWidth / 2;
      const cy = slot.globalY - derived.trayDepth / 2;
      baseHoleCenters.push({
        cx,
        cy,
        baseHoleSize: resolveMagneticBaseHolePreset(
          "circle",
          slot.diameter,
          slot.diameter,
        ),
        baseThickness: floorHeight,
      });
      magnetPostHoleCenters.push({ cx, cy, floorHeight });
      const hole = extrudeLinear(
        { height: clampedDepth + 0.02 },
        circle({
          radius: getSimpleSteppedEffectiveDiameter({ diameter: slot.diameter }) / 2,
          segments: RENDER_CONFIG.cylinderSegments,
        }),
      );

      return translate(
        [
          cx,
          cy,
          floorHeight,
        ],
        hole,
      );
    }),
  );

  let tray = holes.length > 0 ? subtract(solid, ...holes) : solid;
  if (params.baseHoleStructure === "magnetic-base-hole") {
    tray = subtractBaseHoles(tray, baseHoleCenters, 0, params.baseHoleSize);
  } else if (params.baseHoleStructure === "magnet-post-hole") {
    tray = subtractMagnetPostHoles(
      tray,
      magnetPostHoleCenters,
      params.magnetPostHoleDiameter,
      params.magnetPostHoleDepth,
    );
  }
  return tray;
}

export function calculateSimpleSteppedTrayDimensions(
  params: SimpleSteppedLayoutParams,
) {
  const dimensions = calculateSimpleSteppedDimensions(params);
  return {
    width: dimensions.width,
    depth: dimensions.depth,
    height: dimensions.height,
  };
}

export function calculateSimpleSteppedTrayVolume(
  params: SimpleSteppedLayoutParams,
) {
  const geometry = createSimpleSteppedTrayModel(params);
  return measureVolume(geometry);
}
