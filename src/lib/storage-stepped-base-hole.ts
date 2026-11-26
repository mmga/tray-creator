import { createBaseHoleConstructionPlan } from "@/lib/base-hole-construction-plan";
import type { BaseHoleConstructionPlan } from "@/lib/base-hole-construction-plan";
import { getRequiredBaseHoleSupportingThickness } from "@/lib/base-hole-construction-plan";
import {
  getFreeSlotProfileGeometry,
  DEFAULT_ELLIPSE_PROFILE_EXPONENT,
} from "@/lib/slot-definitions";
import { sampleSlotProfilePoints } from "@/lib/slot-profile-geometry";
import type { FreeSlot } from "@/types/custom-tray";
import type { StorageSteppedTrayConfig } from "@/types/storage-stepped";

export const BASE_HOLE_EPSILON = 1e-6;

/** 槽底厚度 = 托盘总厚度 − 槽深；不允许通过加厚托盘回避。 */
export function getStorageSteppedFloorThickness(
  tray: Pick<StorageSteppedTrayConfig, "holeDepth">,
  trayThickness: number,
): number {
  return trayThickness - tray.holeDepth;
}

/**
 * 判断一个以槽心为圆心的底孔是否完整落在槽底范围内。
 * 圆形槽直接比较半径；椭圆/超椭圆槽按最小极径判断，避免采样外扩造成误判。
 */
export function slotContainsExpandedCircle(
  slot: FreeSlot,
  radius: number,
): boolean {
  const profile = getFreeSlotProfileGeometry(slot);
  if (slot.shape === "circle") {
    return radius <= profile.width / 2 + BASE_HOLE_EPSILON;
  }

  const steps = 360;
  const points = sampleSlotProfilePoints(
    profile.width,
    profile.height,
    "ellipse",
    profile.outerOffset,
    steps,
    profile.profileExponent ?? DEFAULT_ELLIPSE_PROFILE_EXPONENT,
  );
  let minRadius = Infinity;
  for (const point of points) {
    minRadius = Math.min(minRadius, Math.hypot(point.x, point.y));
  }
  return radius <= minRadius + BASE_HOLE_EPSILON;
}

/**
 * 为单块收纳托盘生成权威底孔构造计划。
 *
 * 与自定义托盘不同，托盘槽底高度由“固定总厚度 − 槽深”决定，
 * 因此底孔深度、剩余底壁和侧壁都由同一套尺寸推导，禁止在此处抬高托盘。
 */
export function createStorageSteppedTrayBaseHolePlan(
  tray: StorageSteppedTrayConfig,
  trayWidth: number,
  trayDepth: number,
  trayThickness: number,
): BaseHoleConstructionPlan {
  const floorHeight = getStorageSteppedFloorThickness(tray, trayThickness);
  if (tray.baseHoleStructure === "none") {
    return createBaseHoleConstructionPlan(tray, []);
  }

  const projectedSlots = tray.slots.map((slot) => {
    const profile = getFreeSlotProfileGeometry(slot);
    return {
      id: slot.id,
      shape: slot.shape,
      nominalWidth: slot.width,
      nominalHeight: slot.height,
      finalWidth: profile.width,
      finalHeight: profile.height,
      x: slot.x - trayWidth / 2,
      y: slot.y - trayDepth / 2,
      floorHeight,
      containsExpandedHole: (radius: number) =>
        slotContainsExpandedCircle(slot, radius),
    };
  });

  return createBaseHoleConstructionPlan(tray, projectedSlots);
}

export function getStorageSteppedTrayRequiredSupportingThickness(
  tray: StorageSteppedTrayConfig,
): number {
  return getRequiredBaseHoleSupportingThickness(tray);
}

/** 底孔构造计划被阻断时的用户可读原因。 */
export function getStorageSteppedBaseHoleBlockingReason(
  plan: BaseHoleConstructionPlan,
): string | null {
  if (!plan.blocked) return null;
  const first = plan.violations[0];
  const remaining = plan.violations.length - 1;
  return `底板孔位不适配：${first?.message ?? "未知冲突"}${
    remaining > 0 ? `（另有 ${remaining} 项）` : ""
  }`;
}
