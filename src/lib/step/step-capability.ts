import { resolveCustomFootprintStyle } from "@/lib/custom-layout-math";
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
  if (snapshot.mode === "grid") {
    return { available: true, sampled: false };
  }
  return { available: true, sampled: resolveCustomFootprintStyle(snapshot.params) !== "rectangular" ||
    snapshot.params.slots.some(({ shape }) => shape === "ellipse") };
}
