"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { browserDownloadPort } from "@/lib/download-port";
import { useToast } from "@/hooks/useToast";
import type {
  DownloadPort,
  SteppedWorkerPort,
} from "@/lib/model-ports";
import type { SteppedSplitPreviewPart } from "@/lib/stepped-model-service";
import {
  captureModeParamSnapshot,
  type ModeParamSnapshot,
} from "@/lib/mode-param-snapshot";
import { trayWorkerService } from "@/lib/worker/worker-service";
import type { SteppedLayoutParams } from "@/types/custom-tray";
import {
  getBaseHoleFitBlockingReason,
  validateBaseHoleFit,
} from "@/lib/base-hole-rules";

interface UseSteppedCadSplitOrchestrationOptions {
  params: SteppedLayoutParams;
  generateSplitPreview: (
    params: SteppedLayoutParams,
    workerPort: SteppedWorkerPort,
  ) => Promise<SteppedSplitPreviewPart[]>;
  exportSplitParts: (
    snapshot: ModeParamSnapshot<"stepped">,
    workerPort: SteppedWorkerPort,
    downloadPort: DownloadPort,
  ) => Promise<void>;
}

export interface UseSteppedCadSplitOrchestrationReturn {
  splitPreviewParts: SteppedSplitPreviewPart[] | null;
  isGeneratingSplitPreview: boolean;
  handleGenerateSplitPreview: () => Promise<void>;
  clearSplitPreview: () => void;
  handleExportSplitParts: () => Promise<void>;
}

function disposeSplitPreviewParts(
  parts: SteppedSplitPreviewPart[] | null,
): void {
  parts?.forEach((part) => part.threeGeometry.dispose());
}

export function useSteppedCadSplitOrchestration(
  options: UseSteppedCadSplitOrchestrationOptions,
): UseSteppedCadSplitOrchestrationReturn {
  const { params, generateSplitPreview, exportSplitParts } = options;
  const { toast } = useToast();
  const paramsRef = useRef(params);
  const previousParamsRef = useRef(params);
  const splitPreviewPartsRef =
    useRef<SteppedSplitPreviewPart[] | null>(null);
  const [splitPreviewParts, setSplitPreviewParts] = useState<
    SteppedSplitPreviewPart[] | null
  >(null);
  const [isGeneratingSplitPreview, setIsGeneratingSplitPreview] =
    useState(false);
  paramsRef.current = params;

  const replaceSplitPreviewParts = useCallback(
    (next: SteppedSplitPreviewPart[] | null) => {
      disposeSplitPreviewParts(splitPreviewPartsRef.current);
      splitPreviewPartsRef.current = next;
      setSplitPreviewParts(next);
    },
    [],
  );

  const clearSplitPreview = useCallback(() => {
    replaceSplitPreviewParts(null);
  }, [replaceSplitPreviewParts]);

  useEffect(
    () => () => {
      disposeSplitPreviewParts(splitPreviewPartsRef.current);
      splitPreviewPartsRef.current = null;
    },
    [],
  );

  useEffect(() => {
    if (previousParamsRef.current !== params) {
      previousParamsRef.current = params;
      clearSplitPreview();
    }
  }, [clearSplitPreview, params]);

  const handleGenerateSplitPreview = useCallback(async () => {
    if (!paramsRef.current.enableSplitAssembly) {
      toast("error", "请先启用分件与装配");
      return;
    }
    const workerPort = trayWorkerService as SteppedWorkerPort | null;
    if (!workerPort) {
      toast("error", "当前环境无法使用后台建模服务");
      return;
    }

    const currentParams = paramsRef.current;
    const blockingReason = getBaseHoleFitBlockingReason(
      validateBaseHoleFit("stepped", currentParams),
    );
    if (blockingReason) {
      toast("error", blockingReason);
      return;
    }
    if (currentParams.groups.length < 2) {
      toast("error", "至少需要两个分组才能预览拆件");
      return;
    }

    setIsGeneratingSplitPreview(true);
    try {
      const parts = await generateSplitPreview(
        currentParams,
        workerPort,
      );
      replaceSplitPreviewParts(parts);
    } catch (err) {
      console.error("拆件预览生成失败:", err);
      toast(
        "error",
        `拆件预览失败：${err instanceof Error ? err.message : "未知错误"}`,
      );
    } finally {
      setIsGeneratingSplitPreview(false);
    }
  }, [generateSplitPreview, replaceSplitPreviewParts, toast]);

  const handleExportSplitParts = useCallback(async () => {
    if (!paramsRef.current.enableSplitAssembly) {
      toast("error", "请先启用分件与装配");
      return;
    }
    const workerPort = trayWorkerService as SteppedWorkerPort | null;
    if (!workerPort) {
      toast("error", "当前环境无法使用后台建模服务");
      return;
    }

    const currentParams = paramsRef.current;
    const blockingReason = getBaseHoleFitBlockingReason(
      validateBaseHoleFit("stepped", currentParams),
    );
    if (blockingReason) {
      toast("error", blockingReason);
      return;
    }
    if (currentParams.groups.length < 2) {
      toast("error", "至少需要两个分组才能导出分件");
      return;
    }

    try {
      await exportSplitParts(
        captureModeParamSnapshot("stepped", currentParams),
        workerPort,
        browserDownloadPort,
      );
      toast("success", "阶梯分件文件已导出");
    } catch (err) {
      console.error("分件导出失败:", err);
      toast(
        "error",
        `分件导出失败：${err instanceof Error ? err.message : "未知错误"}`,
      );
    }
  }, [exportSplitParts, toast]);

  return {
    splitPreviewParts,
    isGeneratingSplitPreview,
    handleGenerateSplitPreview,
    clearSplitPreview,
    handleExportSplitParts,
  };
}
