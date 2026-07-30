import type { CustomLayoutParams, GroupOutlinePreview } from "@/types/custom-tray";
import {
  calculateFixedCustomTrayUsableArea,
  resolveCustomFootprintStyle,
  resolveCustomTraySizingMode,
} from "@/lib/custom-layout-math";
import type {
  ConstructedContouredFootprint,
} from "@/lib/contoured-footprint";
import type { ContouredFootprintState } from "@/lib/contoured-footprint-state";
import type { LayoutEditorViewportModel } from "@/viewports/layout-editor/types";

/**
 * 为 contoured footprint 派生每个独立实体的轮廓预览，供画布渲染（CONTEXT:623,625）。
 */
function buildContouredGroupOutlines(
  contoured: ConstructedContouredFootprint,
): GroupOutlinePreview[] | null {
  if (contoured.bodies.length === 0) {
    return null;
  }
  const previews: GroupOutlinePreview[] = [];
  contoured.bodies.forEach((body, index) => {
    const points = [...body.outerOutline];
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
  contouredState: ContouredFootprintState<ConstructedContouredFootprint> = {
    status: "inactive",
  },
): LayoutEditorViewportModel {
  const isFixed = resolveCustomTraySizingMode(params) === "fixed";
  const isContoured = resolveCustomFootprintStyle(params) === "contoured";
  const contoured =
    contouredState.status === "ready" ? contouredState.value : null;

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
      ? {
          groupOutlines: contoured
            ? buildContouredGroupOutlines(contoured)
            : null,
          footprintWarnings: contouredState.status === "failed"
            ? [contouredState.error.message]
            : contoured?.diagnostics.map((diagnostic) => diagnostic.message),
        }
      : {},
    interactions: {},
  };
}
