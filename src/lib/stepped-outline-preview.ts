import type {
  GroupOutlinePreview,
  SteppedLayoutParams,
} from "@/types/custom-tray";
import { geometries } from "@jscad/modeling";
import { buildSteppedCadFootprintPlan } from "@/lib/stepped-cad-feature-graph";
import type { ContouredFootprintState } from "@/lib/contoured-footprint-state";
import type { ConstructedSteppedContouredFootprints } from "@/lib/stepped-contoured-footprint";

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
  contouredState: ContouredFootprintState<ConstructedSteppedContouredFootprints> = {
    status: "inactive",
  },
): GroupOutlinePreview[] | null {
  if (params.slots.length === 0 || params.groups.length === 0) {
    return null;
  }

  // Rectangular 分支：复用 Footprint Plan 已派生的 group footprint（每个是矩形 Geom2）
  // 直接提取外轮廓点列，最低层连续矩形+圆角，更高层分组矩形（CONTEXT:601）
  if (params.footprintStyle === "rectangular") {
    return buildRectangularSteppedOutlinePreview(params);
  }

  const result: GroupOutlinePreview[] = [];
  if (contouredState.status !== "ready") {
    return null;
  }
  const construction = contouredState.value;
  const groupById = new Map(params.groups.map((group) => [group.id, group]));
  for (const constructedGroup of construction.groups) {
    const group = groupById.get(constructedGroup.groupId);
    if (!group) continue;
    constructedGroup.footprint.bodies.forEach((body, bodyIndex) => {
      if (body.outerOutline.length < 3) return;
      result.push({
        key: `${group.id}-${body.slotIds.join("-") || bodyIndex}`,
        groupId: group.id,
        color: group.color,
        bottomHeight: group.bottomHeight,
        points: body.outerOutline.map((point) => ({ ...point })),
      });
    });
  }

  result.sort((a, b) => a.bottomHeight - b.bottomHeight);
  return result.length > 0 ? result : null;
}

/**
 * 为 Rectangular Stepped Footprint 派生 2D 预览。
 * 复用 Stepped Footprint Plan 中已经按 style 派生的 group footprint：
 * - 最低 columnHeight 分组：整体轴对齐包络 + cornerRadius 圆角
 * - 更高分组：各自轴对齐包络，直角
 * 这样 2D 预览与 3D 生成消费同一个 footprint（CONTEXT:626）。
 */
function buildRectangularSteppedOutlinePreview(
  params: SteppedLayoutParams,
): GroupOutlinePreview[] | null {
  const plan = buildSteppedCadFootprintPlan(params, { status: "inactive" });
  if (plan.groups.length === 0 || plan.layers.length === 0) {
    return null;
  }

  const groupMetaById = new Map(params.groups.map((group) => [
    group.id,
    { color: group.color, bottomHeight: group.bottomHeight },
  ]));

  const lowestLayer = plan.layers[0];
  const lowestGroup = plan.groups.find(
    (group) => Math.abs(group.columnHeight - lowestLayer.toHeight) <= 1e-6,
  ) ?? plan.groups[0];
  const lowestPoints = getLargestOutlinePoints(lowestLayer.footprint);
  const lowestMeta = groupMetaById.get(lowestGroup.groupId);
  const previews: GroupOutlinePreview[] = lowestPoints && lowestPoints.length >= 3
    ? [{
        key: "rect-lowest-layer",
        groupId: lowestGroup.groupId,
        color: lowestMeta?.color ?? "#8b7355",
        bottomHeight: lowestLayer.toHeight,
        points: lowestPoints,
      }]
    : [];

  plan.groups
    .filter((groupFeature) => groupFeature.columnHeight > lowestLayer.toHeight + 1e-6)
    .forEach((groupFeature, index) => {
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
