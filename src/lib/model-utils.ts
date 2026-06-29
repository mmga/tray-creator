import { booleans, primitives, transforms, extrusions } from "@jscad/modeling";
import type { Geom3 } from "@jscad/modeling/src/geometries/types";
import {
    RENDER_CONFIG,
    BASE_HOLE_CONFIG,
    getBaseHoleMinBottomWall,
} from "@/lib/config";
import type { BaseHolePresetKey } from "@/types/tray";

const { subtract } = booleans;
const { roundedRectangle, cylinder } = primitives;
const { translate } = transforms;
const { extrudeLinear } = extrusions;
const BASE_HOLE_WALL_EPSILON = 1e-6;

// ── 共享建模工具 ──────────────────────────

/** 凹槽中心坐标 */
export interface SlotCenter {
    cx: number;
    cy: number;
    baseHoleSize?: BaseHolePresetKey;
    baseThickness?: number;
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
 * @param fallbackBaseHoleSize - 兼容旧调用的默认磁吸孔规格 key
 * @returns 挖孔后的几何体
 */
export function subtractBaseHoles(
    tray: Geom3,
    centers: SlotCenter[],
    baseThickness: number,
    fallbackBaseHoleSize?: BaseHolePresetKey,
): Geom3 {
    if (centers.length === 0) return tray;

    const { presets, topWall } = BASE_HOLE_CONFIG;
    const baseHoles: Geom3[] = centers.flatMap(({
        cx,
        cy,
        baseHoleSize,
        baseThickness: centerBaseThickness,
    }) => {
        const resolvedBaseHoleSize =
            baseHoleSize ??
            fallbackBaseHoleSize ??
            BASE_HOLE_CONFIG.defaultPreset;
        const { diameter, depth } = presets[resolvedBaseHoleSize];
        const minBottomWall = getBaseHoleMinBottomWall(resolvedBaseHoleSize);
        const effectiveBaseThickness = centerBaseThickness ?? baseThickness;
        const bottomWall = effectiveBaseThickness - topWall - depth;

        if (bottomWall < minBottomWall - BASE_HOLE_WALL_EPSILON) {
            return [];
        }

        const bhRadius = diameter / 2;
        const resolvedBottomWall = Math.max(bottomWall, minBottomWall);
        const holeCenterZ = resolvedBottomWall + depth / 2;

        return translate(
            [cx, cy, holeCenterZ],
            cylinder({
                radius: bhRadius,
                height: depth,
                segments: RENDER_CONFIG.cylinderSegments,
            }),
        );
    });

    if (baseHoles.length === 0) return tray;

    return subtract(tray, ...baseHoles);
}
