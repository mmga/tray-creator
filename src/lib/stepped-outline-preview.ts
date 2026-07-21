import type {
  GroupOutlinePreview,
  SteppedLayoutParams,
  SteppedSlot,
} from "@/types/custom-tray";
import { geometries } from "@jscad/modeling";
import type { Geom2 } from "@jscad/modeling/src/geometries/types";
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
import { buildSteppedCadFeatureGraph } from "@/lib/stepped-cad-feature-graph";

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

  // Rectangular 分支：复用 feature-graph 已经派生的 group footprint（每个是矩形 Geom2）
  // 直接提取外轮廓点列，最低层连续矩形+圆角，更高层分组矩形（CONTEXT:601）
  if (params.footprintStyle === "rectangular") {
    return buildRectangularSteppedOutlinePreview(params);
  }

  // Contoured 分支：保持现有集群派生
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

/**
 * 为 Rectangular Stepped Footprint 派生 2D 预览。
 * 复用 buildSteppedCadFeatureGraph 中已经按 style 派生的 group footprint：
 * - 最低 columnHeight 分组：整体轴对齐包络 + cornerRadius 圆角
 * - 更高分组：各自轴对齐包络，直角
 * 这样 2D 预览与 3D 生成消费同一个 footprint（CONTEXT:626）。
 */
function buildRectangularSteppedOutlinePreview(
  params: SteppedLayoutParams,
): GroupOutlinePreview[] | null {
  const graph = buildSteppedCadFeatureGraph(params);
  if (graph.groups.length === 0) {
    return null;
  }

  const groupMetaById = new Map(params.groups.map((group) => [
    group.id,
    { color: group.color, bottomHeight: group.bottomHeight },
  ]));

  const previews: GroupOutlinePreview[] = [];
  graph.groups.forEach((groupFeature, index) => {
    const points = getLargestOutlinePoints(groupFeature.footprint);
    const meta = groupMetaById.get(groupFeature.groupId);
    if (points && points.length >= 3) {
      previews.push({
        key: `rect-group-${groupFeature.groupId}-${index}`,
        groupId: groupFeature.groupId,
        color: meta?.color ?? "#8b7355",
        bottomHeight: meta?.bottomHeight ?? groupFeature.columnHeight,
        points,
      });
    }
  });

  previews.sort((a, b) => a.bottomHeight - b.bottomHeight);
  return previews.length > 0 ? previews : null;
}
