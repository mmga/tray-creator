import { getSlotTolerance } from "@/lib/config";
import {
  analyzeBridgeWarning,
  getConnectivityRadius,
  type BridgeWarning,
  type ConnectivityCircle,
} from "@/lib/stepped-connectivity";
import { getEffectiveGroupStructureParams } from "@/lib/stepped-group-params";
import type { SteppedLayoutParams, SteppedSlot } from "@/types/custom-tray";

export function buildSteppedBridgeWarning(
  params: SteppedLayoutParams,
): BridgeWarning | null {
  const slotsByGroupId = new Map<string, SteppedSlot[]>();

  params.slots.forEach((slot) => {
    const groupedSlots = slotsByGroupId.get(slot.groupId);
    if (groupedSlots) {
      groupedSlots.push(slot);
    } else {
      slotsByGroupId.set(slot.groupId, [slot]);
    }
  });

  const higherSlotsByGroupId = new Map<string, SteppedSlot[]>();
  const groupsByHeightDesc = [...params.groups].sort(
    (a, b) => b.bottomHeight - a.bottomHeight,
  );
  let higherSlots: SteppedSlot[] = [];

  for (let index = 0; index < groupsByHeightDesc.length; ) {
    const currentHeight = groupsByHeightDesc[index].bottomHeight;
    const sameHeightGroups: typeof groupsByHeightDesc = [];

    while (
      index < groupsByHeightDesc.length &&
      groupsByHeightDesc[index].bottomHeight === currentHeight
    ) {
      sameHeightGroups.push(groupsByHeightDesc[index]);
      index += 1;
    }

    sameHeightGroups.forEach((group) => {
      higherSlotsByGroupId.set(group.id, higherSlots);
    });

    const sameHeightSlots = sameHeightGroups.flatMap(
      (group) => slotsByGroupId.get(group.id) ?? [],
    );
    higherSlots = [...higherSlots, ...sameHeightSlots];
  }

  const groupsByHeightAsc = [...params.groups].sort(
    (a, b) => a.bottomHeight - b.bottomHeight,
  );

  for (const group of groupsByHeightAsc) {
    const ownSlots = slotsByGroupId.get(group.id) ?? [];
    if (ownSlots.length === 0) {
      continue;
    }

    const effectiveParams = getEffectiveGroupStructureParams(group, params);
    const circles: ConnectivityCircle[] = [
      ...ownSlots,
      ...(higherSlotsByGroupId.get(group.id) ?? []),
    ].map((slot) => ({
      id: slot.id,
      cx: slot.x,
      cy: slot.y,
      rOuter: getConnectivityRadius(
        slot.width,
        slot.height,
        params.spacing,
        getSlotTolerance(slot.width),
        getSlotTolerance(slot.height),
      ),
    }));

    const warning = analyzeBridgeWarning(
      circles,
      effectiveParams.smoothingRadius,
      effectiveParams.disconnectDistance,
      { groupId: group.id, groupName: group.name },
    );

    if (warning) {
      return warning;
    }
  }

  return null;
}
