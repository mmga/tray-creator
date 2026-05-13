import type {
  GroupOutlinePreview,
  SteppedLayoutParams,
  SteppedSlot,
} from "@/types/custom-tray";
import { getFreeSlotProfileGeometry } from "@/lib/slot-definitions";
import { getEffectiveGroupStructureParams } from "@/lib/stepped-group-params";
import { generateOutline } from "@/lib/outline-geometry";
import {
  clusterConnectivityCircles,
  getConnectivityRadius,
  getEffectiveBridgeGap,
  type ConnectivityCircle,
} from "@/lib/stepped-connectivity";

export function buildSteppedOutlinePreview(
  params: SteppedLayoutParams,
): GroupOutlinePreview[] | null {
  if (params.slots.length === 0 || params.groups.length === 0) {
    return null;
  }

  const result: GroupOutlinePreview[] = [];
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
  const groupsByHeight = [...params.groups].sort(
    (a, b) => b.bottomHeight - a.bottomHeight,
  );
  let higherSlots: SteppedSlot[] = [];

  for (let index = 0; index < groupsByHeight.length; ) {
    const currentHeight = groupsByHeight[index].bottomHeight;
    const sameHeightGroups: typeof groupsByHeight = [];

    while (
      index < groupsByHeight.length &&
      groupsByHeight[index].bottomHeight === currentHeight
    ) {
      sameHeightGroups.push(groupsByHeight[index]);
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

  for (const group of params.groups) {
    const ownSlots = slotsByGroupId.get(group.id) ?? [];
    if (ownSlots.length === 0) {
      continue;
    }
    const effectiveParams = getEffectiveGroupStructureParams(group, params);

    const higherSlotsForGroup = higherSlotsByGroupId.get(group.id) ?? [];
    const connectivityCircles: ConnectivityCircle[] = [
      ...ownSlots,
      ...higherSlotsForGroup,
    ].map((slot) => {
      const profile = getFreeSlotProfileGeometry(slot);
      return {
        id: slot.id,
        cx: slot.x,
        cy: slot.y,
        rOuter: getConnectivityRadius(
          profile.width,
          profile.height,
          params.spacing,
          profile.outerOffset * 2,
          profile.outerOffset * 2,
        ),
      };
    });

    const clusters = clusterConnectivityCircles(
      connectivityCircles,
      getEffectiveBridgeGap(
        effectiveParams.smoothingRadius,
        effectiveParams.disconnectDistance,
      ),
    );

    clusters.forEach((cluster, clusterIndex) => {
      const clusterKey =
        cluster.map((circle) => circle.id).sort().join("-") ||
        `${group.id}-${clusterIndex}`;
      const outline = generateOutline(
        cluster.map((circle) => ({
          cx: circle.cx,
          cy: circle.cy,
          rOuter: circle.rOuter,
        })),
        effectiveParams.smoothingRadius,
        64,
      );

      if (outline && outline.points.length >= 3) {
        result.push({
          key: `${group.id}-${clusterKey}`,
          groupId: group.id,
          color: group.color,
          bottomHeight: group.bottomHeight,
          points: outline.points,
        });
      }
    });
  }

  result.sort((a, b) => a.bottomHeight - b.bottomHeight);
  return result.length > 0 ? result : null;
}
