import type { CustomLayoutParams, GroupOutlinePreview } from "@/types/custom-tray";
import {
  calculateCustomContouredFootprint,
  calculateFixedCustomTrayUsableArea,
  resolveCustomFootprintStyle,
  resolveCustomTraySizingMode,
} from "@/lib/custom-layout-math";
import { geometries } from "@jscad/modeling";
import type { Geom2 } from "@jscad/modeling/src/geometries/types";
import type { LayoutEditorViewportModel } from "@/viewports/layout-editor/types";

const { geom2 } = geometries;

/**
 * 从 contoured body 提取面积最大的外轮廓点列，转成 GroupOutlinePreview 渲染格式。
 */
function extractLargestOutline(body: Geom2): { x: number; y: number }[] | null {
  const outlines = geom2.toOutlines(body);
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

/**
 * 为 contoured footprint 派生每个独立实体的轮廓预览，供画布渲染（CONTEXT:623,625）。
 */
function buildContouredGroupOutlines(
  params: CustomLayoutParams,
): GroupOutlinePreview[] | null {
  const contoured = calculateCustomContouredFootprint(params);
  if (contoured.bodies.length === 0) {
    return null;
  }
  const previews: GroupOutlinePreview[] = [];
  contoured.bodies.forEach((body, index) => {
    const points = extractLargestOutline(body);
    if (points && points.length >= 3) {
      previews.push({
        key: `custom-contoured-${index}`,
        groupId: `custom-contoured-${index}`,
        color: "#8b7355",
        bottomHeight: 0,
        points,
      });
    }
  });
  return previews.length > 0 ? previews : null;
}

export function buildCustomLayoutEditorViewportModel(
  params: CustomLayoutParams,
): LayoutEditorViewportModel {
  const isFixed = resolveCustomTraySizingMode(params) === "fixed";
  const isContoured = resolveCustomFootprintStyle(params) === "contoured";

  return {
    trayFrame: {
      width: params.trayWidth,
      depth: params.trayDepth,
      spacing: params.spacing,
      boundarySpacing: params.boundarySpacingIndependent
        ? params.boundarySpacing
        : params.spacing,
      cornerRadius: params.cornerRadius,
      sideBevelWidth: params.sideBevelWidth,
      // contoured 下不显示矩形 effective baseplate（改用 groupOutlines 渲染贴合轮廓）
      // rectangular 下保持原语义：auto 显示 effective，fixed 不显示（CONTEXT:619-620）
      showEffectiveBaseplate: !isContoured && !isFixed,
      showMaxBuildBoundary: false,
      fixedUsableArea: !isContoured && isFixed
        ? calculateFixedCustomTrayUsableArea(params)
        : undefined,
    },
    slots: params.slots,
    overlays: isContoured
      ? { groupOutlines: buildContouredGroupOutlines(params) }
      : {},
    interactions: {},
  };
}
