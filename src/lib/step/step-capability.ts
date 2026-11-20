import { resolveCustomFootprintStyle } from "@/lib/custom-layout-math";
import type { FlatTraySnapshot } from "@/lib/manual-split-plan";

export type StepScope = "whole" | "parts";

type StepCapability =
  | { available: true; sampled: boolean }
  | { available: false; reason: string };

export function getStepCapability(snapshot: FlatTraySnapshot, scope: StepScope): StepCapability {
  const { params } = snapshot;
  const blocked = (reason: string): StepCapability => ({ available: false, reason });
  if (params.stackableBox?.enabled && scope === "parts") return blocked("堆叠盒体不支持手动拆件");
  if (scope === "parts") return blocked("暂不支持分件 STEP 导出");
  if (snapshot.mode === "grid") {
    return { available: true, sampled: false };
  }
  if (params.stackableBox?.enabled && resolveCustomFootprintStyle(snapshot.params) !== "rectangular") {
    return blocked("此自定义底座轮廓不支持堆叠盒体");
  }
  return { available: true, sampled: resolveCustomFootprintStyle(snapshot.params) !== "rectangular" ||
    snapshot.params.slots.some(({ shape }) => shape === "ellipse") };
}
