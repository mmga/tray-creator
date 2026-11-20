"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { getStepCapability, type StepScope } from "@/lib/step/step-capability";
import type { FlatTraySnapshot } from "@/lib/manual-split-plan";
import type { StepPhase } from "@/lib/step/step-protocol";
import { useToast } from "./useToast";

export function useStepExport(snapshot: FlatTraySnapshot | undefined, scope: StepScope, blockingReason?: string | null) {
  const [phase, setPhase] = useState<StepPhase>();
  const task = useRef<AbortController | null>(null);
  const { toast } = useToast();
  const params = snapshot?.params;
  const mode = snapshot?.mode;
  const capability = snapshot && getStepCapability(snapshot, scope);
  const reason = blockingReason ?? (capability && !capability.available ? capability.reason : undefined);
  const cancel = useCallback(() => task.current?.abort(), []);
  useLayoutEffect(() => cancel, [mode, params, scope, reason, cancel]);

  async function run() {
    if (!snapshot || reason || task.current) return;
    const captured = structuredClone(snapshot);
    const controller = new AbortController();
    task.current = controller;
    setPhase("加载导出组件");
    try {
      const { exportStepFiles } = await import("@/lib/step/step-export-service");
      await exportStepFiles(captured, scope, controller.signal, setPhase);
      toast("success", "STEP 和参数文件已导出");
    } catch (error) {
      if (!controller.signal.aborted) toast("error", error instanceof Error ? error.message : "STEP 导出失败");
    } finally {
      task.current = null;
      setPhase(undefined);
    }
  }

  return { phase, run, cancel, reason, sampled: capability?.available ? capability.sampled : false };
}
