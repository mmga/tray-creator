import { booleans, primitives, transforms, extrusions } from "@jscad/modeling";
import type { Geom3 } from "@jscad/modeling/src/geometries/types";
import { RENDER_CONFIG, BASE_HOLE_CONFIG } from "@/lib/config";

const { subtract } = booleans;
const { roundedRectangle, cylinder } = primitives;
const { translate } = transforms;
const { extrudeLinear } = extrusions;

// ── 共享建模工具 ──────────────────────────

/** 凹槽中心坐标 */
export interface SlotCenter {
    cx: number;
    cy: number;
}

/**
 * 创建底板实体：圆角矩形 → 线性拉伸
 *
 * - 圆角仅出现在竖直方向的 4 条边上
 * - 返回从 Z=0 到 Z=height 的实体
 */
export function createBaseBody(
    width: number,
    depth: number,
    height: number,
    cornerRadius: number,
): Geom3 {
    const effectiveRadius = Math.min(
        cornerRadius,
        width / 2 - 0.01,
        depth / 2 - 0.01,
    );

    const profile = roundedRectangle({
        size: [width, depth],
        roundRadius: Math.max(effectiveRadius, 0),
        segments: RENDER_CONFIG.cornerSegments,
    });

    return extrudeLinear({ height }, profile);
}

/**
 * 在底板中挖磁吸孔（盲孔，不穿透）
 *
 * @param tray - 当前几何体
 * @param centers - 每个凹槽的 JSCAD 中心坐标（已转换为模型坐标系）
 * @param baseThickness - 底板厚度
 * @param baseHoleSize - 磁吸孔规格 key
 * @returns 挖孔后的几何体
 */
export function subtractBaseHoles(
    tray: Geom3,
    centers: SlotCenter[],
    baseThickness: number,
    baseHoleSize: "19.5" | "25",
): Geom3 {
    if (centers.length === 0) return tray;

    const { presets, tolerance, topWall, minBottomWall } = BASE_HOLE_CONFIG;
    const { diameter, depth } = presets[baseHoleSize];
    const bottomWall = baseThickness - topWall - depth;

    if (bottomWall < minBottomWall) return tray;

    const bhRadius = (diameter + tolerance) / 2;
    const holeCenterZ = bottomWall + depth / 2;

    const baseHoles: Geom3[] = centers.map(({ cx, cy }) =>
        translate(
            [cx, cy, holeCenterZ],
            cylinder({
                radius: bhRadius,
                height: depth + 0.02,
                segments: RENDER_CONFIG.cylinderSegments,
            }),
        ),
    );

    return subtract(tray, ...baseHoles);
}
