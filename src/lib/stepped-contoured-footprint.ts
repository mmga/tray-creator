import {
  constructContouredFootprints,
  type ContouredFootprintConstructionError,
  type ContouredFootprintConstructionOutcome,
  type ContouredFootprintPlan,
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

interface SteppedContouredGroupInput {
  readonly groupId: string;
  readonly columnHeight: number;
  readonly requestKey: string;
}

export interface SteppedContouredFootprintInput {
  readonly plan: ContouredFootprintPlan;
  readonly groups: readonly SteppedContouredGroupInput[];
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
export function projectSteppedContouredFootprintInput(
  params: SteppedLayoutParams,
): SteppedContouredFootprintInput {
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
  const groups = requestGroups.map((group) => {
    const columnHeight = columnHeightByGroupId.get(group.id) ?? 3;
    const structure = getEffectiveGroupStructureParams(group, params);
    const slots = params.slots.filter((slot) =>
      slot.groupId === group.id ||
      (columnHeightByGroupId.get(slot.groupId) ?? 3) > columnHeight
    );
    const requestKey = `stepped-group:${group.id}`;
    return {
      groupId: group.id,
      columnHeight,
      requestKey,
      request: {
        key: requestKey,
        slots: slots.map(projectSteppedSlotToContoured),
        slotSpacing: params.spacing,
        boundarySpacing,
        smoothingRadius: structure.smoothingRadius,
        disconnectDistance: structure.disconnectDistance,
      },
    };
  });

  return {
    plan: { requests: groups.map((group) => group.request) },
    groups: groups.map((group) => ({
      groupId: group.groupId,
      columnHeight: group.columnHeight,
      requestKey: group.requestKey,
    })),
  };
}

export function selectSteppedContouredFootprints(
  input: SteppedContouredFootprintInput,
  outcome: Extract<ContouredFootprintConstructionOutcome, { ok: true }>,
): ConstructedSteppedContouredFootprints | ContouredFootprintConstructionError {
  const footprintByKey = new Map(
    outcome.value.footprints.map((footprint) => [footprint.key, footprint] as const),
  );
  const groups: ConstructedSteppedContouredGroup[] = [];
  for (const group of input.groups) {
    const footprint = footprintByKey.get(group.requestKey);
    if (!footprint) {
      return {
        code: "invalid-plan",
        requestKey: group.requestKey,
        message: `高度组 ${group.groupId} 缺少权威轮廓构造结果`,
      };
    }
    groups.push({
      groupId: group.groupId,
      columnHeight: group.columnHeight,
      footprint,
    });
  }

  return {
    groups,
    bounds: unionBounds(groups),
    diagnostics: outcome.value.diagnostics,
  };
}

export function constructSteppedContouredFootprintsOutcome(
  input: SteppedContouredFootprintInput,
):
  | { ok: true; value: ConstructedSteppedContouredFootprints }
  | { ok: false; error: ContouredFootprintConstructionError } {
  const outcome = constructContouredFootprints(input.plan);
  if (!outcome.ok) return outcome;
  const selected = selectSteppedContouredFootprints(input, outcome);
  return "code" in selected
    ? { ok: false, error: selected }
    : { ok: true, value: selected };
}
