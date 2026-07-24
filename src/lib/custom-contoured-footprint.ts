import {
  constructContouredFootprints,
  type ContouredFootprintConstructionError,
  type ConstructedContouredFootprint,
  type ContouredFootprintSlot,
} from "@/lib/contoured-footprint";
import { getFreeSlotProfileGeometry } from "@/lib/slot-definitions";
import type { CustomLayoutParams, FreeSlot } from "@/types/custom-tray";

export type CustomContouredFootprintOutcome =
  | { ok: true; value: ConstructedContouredFootprint }
  | { ok: false; error: ContouredFootprintConstructionError };

export function projectCustomSlotToContoured(
  slot: FreeSlot,
): ContouredFootprintSlot {
  return {
    id: slot.id,
    cx: slot.x,
    cy: slot.y,
    rotation: slot.rotation || 0,
    shape: slot.shape,
    profile: getFreeSlotProfileGeometry(slot),
  };
}

export function constructCustomContouredFootprintOutcome(
  params: CustomLayoutParams,
): CustomContouredFootprintOutcome {
  const outcome = constructContouredFootprints({
    requests: [{
      key: "custom-baseplate",
      slots: params.slots.map(projectCustomSlotToContoured),
      slotSpacing: params.spacing,
      boundarySpacing: params.boundarySpacingIndependent
        ? params.boundarySpacing
        : params.spacing,
      smoothingRadius: params.smoothingRadius ?? 60,
      disconnectDistance: params.disconnectDistance ?? 0,
    }],
  });
  if (!outcome.ok) {
    return outcome;
  }
  const footprint = outcome.value.footprints[0];
  if (!footprint) {
    return {
      ok: false,
      error: {
        code: "invalid-plan",
        message: "Custom Contoured Footprint 缺少构造结果",
      },
    };
  }
  return { ok: true, value: footprint };
}

/**
 * 旧的同步调用入口暂供尚未迁移的 Worker Implementation 使用。
 * 主线程布局状态 Module 应消费结构化 outcome，而非捕获这里抛出的异常。
 */
export function constructCustomContouredFootprint(
  params: CustomLayoutParams,
): ConstructedContouredFootprint {
  const outcome = constructCustomContouredFootprintOutcome(params);
  if (outcome.ok) return outcome.value;
  throw Object.assign(new Error(outcome.error.message), {
    code: outcome.error.code,
    constructionError: outcome.error,
  });
}
