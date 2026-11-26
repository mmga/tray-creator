import type { StorageSteppedParams } from "@/types/storage-stepped";
import type { LayoutEditorViewportModel } from "@/viewports/layout-editor/types";
import {
  deriveStorageSteppedTraySize,
  getStorageSteppedSlotBounds,
  validateStorageSteppedParams,
} from "@/lib/storage-stepped-plan";
import { storageSteppedTrayPartId } from "@/lib/storage-stepped-config";
import { getStorageSteppedTray } from "@/lib/storage-stepped-config";

/**
 * 固定边界的收纳托盘二维编辑模型。
 *
 * 托盘外形由接口参数推导并锁定；编辑器只显示当前阶槽位、边距与冲突，
 * 不提供改变托盘尺寸的入口。
 */
export function buildStorageSteppedLayoutEditorViewportModel({
  params,
  stepIndex,
}: {
  params: StorageSteppedParams;
  stepIndex: number;
}): LayoutEditorViewportModel {
  const size = deriveStorageSteppedTraySize(params.interface);
  const tray = getStorageSteppedTray(params, stepIndex);
  const validation = validateStorageSteppedParams(params);
  const partId = storageSteppedTrayPartId(stepIndex);
  const footprintWarnings = validation.errors
    .filter((issue) => issue.partId === partId)
    .map((issue) => issue.message);

  return {
    trayFrame: {
      width: size.width,
      depth: size.depth,
      spacing: params.slotSpacing,
      boundarySpacing: params.slotBoundarySpacing,
      cornerRadius: 0,
      sideBevelWidth: 0,
      showEffectiveBaseplate: false,
      showMaxBuildBoundary: false,
    },
    slots: tray?.slots ?? [],
    overlays: {
      footprintWarnings,
    },
    interactions: {},
  };
}

/** 供面板显示当前托盘槽位边界；不改变任何参数。 */
export function getStorageSteppedTraySlotBounds(
  params: StorageSteppedParams,
  stepIndex: number,
) {
  const tray = getStorageSteppedTray(params, stepIndex);
  const size = deriveStorageSteppedTraySize(params.interface);
  return {
    width: size.width,
    depth: size.depth,
    bounds: (tray?.slots ?? []).map((slot) => ({
      id: slot.id,
      ...getStorageSteppedSlotBounds(slot),
    })),
  };
}
