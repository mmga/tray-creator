import { resolveCustomFootprintStyle } from "@/lib/custom-layout-math";
import { shouldRemoveGridIslands } from "@/lib/grid-layout-math";
import type { FlatTraySnapshot } from "@/lib/manual-split-plan";

export type StepScope = "whole" | "parts";

type StepCapability =
  | { available: true; sampled: boolean }
  | { available: false; reason: string };

export function getStepCapability(snapshot: FlatTraySnapshot, scope: StepScope): StepCapability {
  const { params } = snapshot;
  const blocked = (reason: string): StepCapability => ({ available: false, reason });
  if (params.stackableBox?.enabled) return blocked("堆叠盒体暂不支持 STEP 导出");
  if (scope === "parts") return blocked("暂不支持分件 STEP 导出");
  if (params.sideBevelWidth > 0) return blocked("带侧面斜面的托盘暂不支持 STEP 导出");
  if (snapshot.mode === "grid") {
    const grid = snapshot.params;
    if (!grid.basePlateOnly && grid.halfCircleSlots && grid.slotShape !== "rectangle" &&
        (grid.rows === 1 || grid.columns === 1)) {
      return blocked("半圆槽暂不支持 STEP 导出");
    }
    if (shouldRemoveGridIslands(grid)) return blocked("零间距去岛暂不支持 STEP 导出");
    return { available: true, sampled: false };
  }
  if (resolveCustomFootprintStyle(snapshot.params) !== "rectangular") {
    return blocked("当前底座轮廓暂不支持 STEP 导出");
  }
  return { available: true, sampled: snapshot.params.slots.some(({ shape }) => shape === "ellipse") };
}
