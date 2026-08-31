import { booleans, primitives, transforms, extrusions, geometries, maths } from "@jscad/modeling";
import type { Geom2, Geom3 } from "@jscad/modeling/src/geometries/types";
import {
    RENDER_CONFIG,
    BASE_HOLE_CONFIG,
    getBaseHoleMinBottomWall,
} from "@/lib/config";
import { sampleSlotProfilePoints } from "@/lib/slot-profile-geometry";
import type { BaseHolePresetKey } from "@/types/tray";
import type { FreeSlot } from "@/types/custom-tray";
import {
    getBaseHoleFitBlockingReason,
    type BaseHoleConstructionPlan,
} from "@/lib/base-hole-construction-plan";

const { subtract } = booleans;
const { roundedRectangle, cylinder, ellipse } = primitives;
const { translate } = transforms;
const { extrudeLinear, extrudeFromSlices, slice } = extrusions;
const { geom2 } = geometries;
const { mat4 } = maths;
const BASE_HOLE_WALL_EPSILON = 1e-6;
const MIN_BEVEL_TOP_SIZE = 0.1;

// ── 共享建模工具 ──────────────────────────

/** 凹槽中心坐标 */
export interface SlotCenter {
    cx: number;
    cy: number;
    baseHoleSize?: BaseHolePresetKey;
    baseThickness?: number;
}

/** 磁铁桩孔中心；floorHeight 是 Slot Floor 的 Z 高度。 */
export interface MagnetPostHoleCenter {
    cx: number;
    cy: number;
    floorHeight: number;
}

export function createMagnetPostHoleSolid(
    center: MagnetPostHoleCenter,
    diameter: number,
    depth: number,
    overlap: number = 0.02,
    segments: number = RENDER_CONFIG.cylinderSegments,
): Geom3 {
    return translate(
        [
            center.cx,
            center.cy,
            center.floorHeight - depth / 2 + overlap / 2,
        ],
        cylinder({
            radius: diameter / 2,
            height: depth + overlap,
            segments,
        }),
    );
}

/**
 * 执行权威 Base-hole Construction Plan 中的声明式切割指令。
 * 坐标转换只负责把 Adapter 坐标投影到当前 CAD 装配坐标系，不重新解析孔型。
 */
export function subtractBaseHoleConstructionPlan(
    tray: Geom3,
    plan: BaseHoleConstructionPlan,
    projectPoint: (x: number, y: number) => [number, number] = (x, y) => [x, y],
): Geom3 {
    if (plan.blocked) {
        throw new Error(getBaseHoleFitBlockingReason(plan.violations) ?? "底板孔位不适配");
    }
    if (plan.instructions.length === 0) return tray;

    const solids = plan.instructions.map((instruction) => {
        const [x, y] = projectPoint(instruction.x, instruction.y);
        const height = instruction.top - instruction.bottom;
        return translate(
            [x, y, instruction.bottom + height / 2],
            cylinder({
                radius: instruction.diameter / 2,
                height,
                segments: RENDER_CONFIG.cylinderSegments,
            }),
        );
    });
    return subtract(tray, ...solids);
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
    sideBevelWidth = 0,
): Geom3 {
    const effectiveRadius = Math.min(
        cornerRadius,
        width / 2 - 0.01,
        depth / 2 - 0.01,
    );
    const safeBevelWidth = Math.max(
        0,
        Math.min(
            sideBevelWidth,
            width / 2 - MIN_BEVEL_TOP_SIZE,
            depth / 2 - MIN_BEVEL_TOP_SIZE,
        ),
    );

    const profile = roundedRectangle({
        size: [width, depth],
        roundRadius: Math.max(effectiveRadius, 0),
        segments: RENDER_CONFIG.cornerSegments,
    });

    if (safeBevelWidth > 0) {
        const topWidth = width - safeBevelWidth * 2;
        const topDepth = depth - safeBevelWidth * 2;
        const topRadius = Math.max(effectiveRadius - safeBevelWidth, 0);

        return extrudeFromSlices(
            {
                numberOfSlices: 2,
                callback: (progress) => {
                    const currentProfile = progress === 0
                        ? profile
                        : roundedRectangle({
                            size: [topWidth, topDepth],
                            roundRadius: Math.min(
                                topRadius,
                                topWidth / 2 - 0.01,
                                topDepth / 2 - 0.01,
                            ),
                            segments: RENDER_CONFIG.cornerSegments,
                        });
                    const currentSlice = slice.fromSides(geom2.toSides(currentProfile));
                    return slice.transform(
                        mat4.fromTranslation(mat4.create(), [0, 0, height * progress]),
                        currentSlice,
                    );
                },
            },
            slice.fromSides(geom2.toSides(profile)),
        );
    }

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

/**
 * 生成带等距外扩的 2D 槽形（Geom2）
 *
 * - offset <= 0 时直接用标准椭圆
 * - offset > 0 时采样带外扩的轮廓点，用于椭圆 superellipse 外扩
 *
 * 抽取自 custom-tray-model / stepped-tray-model 的重复实现，作为共享建模原语。
 */
export function createOffsetSlotShape(
    width: number,
    height: number,
    shape: FreeSlot["shape"],
    offset: number,
    ellipseProfileExponent?: number,
): Geom2 {
    if (offset <= 0) {
        return ellipse({
            radius: [width / 2, height / 2],
            segments: RENDER_CONFIG.cylinderSegments,
        });
    }

    const points = sampleSlotProfilePoints(
        width,
        height,
        shape,
        offset,
        RENDER_CONFIG.cylinderSegments,
        ellipseProfileExponent,
    ).map((point): [number, number] => [point.x, point.y]);

    return geom2.fromPoints(points);
}
