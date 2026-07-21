import type {
  GroupOutlinePreview,
  SteppedLayoutParams,
  SteppedSlot,
} from "@/types/custom-tray";
import { geometries } from "@jscad/modeling";
import { getFreeSlotProfileGeometry } from "@/lib/slot-definitions";
import { getEffectiveGroupStructureParams } from "@/lib/stepped-group-params";
import {
  buildContouredClusterFootprint,
  type ContouredFootprintSlot,
} from "@/lib/contoured-footprint";
import {
  clusterConnectivityCircles,
  getConnectivityRadius,
  getEffectiveBridgeGap,
  type ConnectivityCircle,
} from "@/lib/stepped-connectivity";

const { geom2 } = geometries;

function getLargestOutlinePoints(footprint: Parameters<typeof geom2.toOutlines>[0]) {
  const outlines = geom2.toOutlines(footprint);
  let largest: [number, number][] | null = null;
  let largestArea = 0;

  for (const outline of outlines) {
    let area = 0;
    for (let index = 0; index < outline.length; index += 1) {
      const next = outline[(index + 1) % outline.length];
      area += outline[index][0] * next[1] - next[0] * outline[index][1];
    }
    const absoluteArea = Math.abs(area / 2);
    if (absoluteArea > largestArea) {
      largest = outline;
      largestArea = absoluteArea;
    }
  }

  return largest?.map(([x, y]) => ({ x, y })) ?? null;
}

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
    const footprintSlotsById = new Map<string, ContouredFootprintSlot>();
    const connectivityCircles: ConnectivityCircle[] = [
      ...ownSlots,
      ...higherSlotsForGroup,
    ].map((slot) => {
      const profile = getFreeSlotProfileGeometry(slot);
      footprintSlotsById.set(slot.id, {
        id: slot.id,
        cx: slot.x,
        cy: slot.y,
        rotation: slot.rotation,
        shape: slot.shape,
        profile,
      });
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
      const footprint = buildContouredClusterFootprint(
        cluster,
        footprintSlotsById,
        params.spacing,
        effectiveParams.smoothingRadius,
      );
      const points = footprint ? getLargestOutlinePoints(footprint) : null;

      if (points && points.length >= 3) {
        result.push({
          key: `${group.id}-${clusterKey}`,
          groupId: group.id,
          color: group.color,
          bottomHeight: group.bottomHeight,
          points,
        });
      }
    });
  }

  result.sort((a, b) => a.bottomHeight - b.bottomHeight);
  return result.length > 0 ? result : null;
}
