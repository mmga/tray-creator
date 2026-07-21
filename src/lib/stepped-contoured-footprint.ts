import {
  constructContouredFootprints,
  type ConstructedContouredFootprint,
  type ContouredFootprintBounds,
  type ContouredFootprintDiagnostic,
  type ContouredFootprintSlot,
} from "@/lib/contoured-footprint";
import { getSteppedGroupMinBottomHeight } from "@/lib/stepped-base-hole";
import { getEffectiveGroupStructureParams } from "@/lib/stepped-group-params";
import { getFreeSlotProfileGeometry } from "@/lib/slot-definitions";
import type { SteppedLayoutParams, SteppedSlot } from "@/types/custom-tray";

export interface ConstructedSteppedContouredGroup {
  readonly groupId: string;
  readonly columnHeight: number;
  readonly footprint: ConstructedContouredFootprint;
}

export interface ConstructedSteppedContouredFootprints {
  readonly groups: readonly ConstructedSteppedContouredGroup[];
  readonly bounds: ContouredFootprintBounds | null;
  readonly diagnostics: readonly ContouredFootprintDiagnostic[];
}

export function projectSteppedSlotToContoured(
  slot: SteppedSlot,
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

function unionBounds(
  groups: readonly ConstructedSteppedContouredGroup[],
): ContouredFootprintBounds | null {
  const bounds = groups
    .map((group) => group.footprint.bounds)
    .filter((item): item is ContouredFootprintBounds => item !== null);
  if (bounds.length === 0) return null;
  return {
    minX: Math.min(...bounds.map((item) => item.minX)),
    maxX: Math.max(...bounds.map((item) => item.maxX)),
    minY: Math.min(...bounds.map((item) => item.minY)),
    maxY: Math.max(...bounds.map((item) => item.maxY)),
  };
}

/**
 * Stepped Mode Adapter。
 *
 * 每个高度组的请求包含本组槽位和所有更高有效 column height 的槽位；同高度组互不
 * 纳入。Core Module 因而无需知道 group、height band 或 Stepped Mode 的任何概念。
 */
export function constructSteppedContouredFootprints(
  params: SteppedLayoutParams,
): ConstructedSteppedContouredFootprints {
  const columnHeightByGroupId = new Map(
    params.groups.map((group) => [
      group.id,
      Math.max(
        group.bottomHeight,
        getSteppedGroupMinBottomHeight(params, group.id),
        3,
      ),
    ]),
  );
  const slotsByGroupId = new Map<string, SteppedSlot[]>();
  for (const slot of params.slots) {
    const slots = slotsByGroupId.get(slot.groupId);
    if (slots) slots.push(slot);
    else slotsByGroupId.set(slot.groupId, [slot]);
  }

  const requestGroups = params.groups.filter(
    (group) => (slotsByGroupId.get(group.id)?.length ?? 0) > 0,
  );
  const boundarySpacing = params.boundarySpacingIndependent
    ? (params.boundarySpacing ?? params.spacing)
    : params.spacing;
  const requests = requestGroups.map((group) => {
    const columnHeight = columnHeightByGroupId.get(group.id) ?? 3;
    const structure = getEffectiveGroupStructureParams(group, params);
    const slots = params.slots.filter((slot) =>
      slot.groupId === group.id ||
      (columnHeightByGroupId.get(slot.groupId) ?? 3) > columnHeight
    );
    return {
      key: `stepped-group:${group.id}`,
      slots: slots.map(projectSteppedSlotToContoured),
      slotSpacing: params.spacing,
      boundarySpacing,
      smoothingRadius: structure.smoothingRadius,
      disconnectDistance: structure.disconnectDistance,
    };
  });

  const outcome = constructContouredFootprints({ requests });
  if (!outcome.ok) {
    throw Object.assign(new Error(outcome.error.message), {
      code: outcome.error.code,
      constructionError: outcome.error,
    });
  }

  const footprintByKey = new Map(
    outcome.value.footprints.map((footprint) => [footprint.key, footprint]),
  );
  const groups = requestGroups.map((group): ConstructedSteppedContouredGroup => {
    const footprint = footprintByKey.get(`stepped-group:${group.id}`);
    if (!footprint) {
      throw new Error(`高度组 ${group.id} 缺少权威轮廓构造结果`);
    }
    return {
      groupId: group.id,
      columnHeight: columnHeightByGroupId.get(group.id) ?? 3,
      footprint,
    };
  });

  return {
    groups,
    bounds: unionBounds(groups),
    diagnostics: outcome.value.diagnostics,
  };
}
