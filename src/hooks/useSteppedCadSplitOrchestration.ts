"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { browserDownloadPort } from "@/lib/download-port";
import { useToast } from "@/hooks/useToast";
import type {
  DownloadPort,
  SteppedCadWorkerPort,
} from "@/lib/model-ports";
import type { SteppedCadSplitPreviewPart } from "@/lib/stepped-cad-model-service";
import {
  captureModeParamSnapshot,
  type ModeParamSnapshot,
} from "@/lib/mode-param-snapshot";
import { trayWorkerService } from "@/lib/worker/worker-service";
import type { SteppedLayoutParams } from "@/types/custom-tray";

interface UseSteppedCadSplitOrchestrationOptions {
  params: SteppedLayoutParams;
  generateSplitPreview: (
    params: SteppedLayoutParams,
    workerPort: SteppedCadWorkerPort,
  ) => Promise<SteppedCadSplitPreviewPart[]>;
  exportSplitParts: (
    snapshot: ModeParamSnapshot<"stepped-cad">,
    workerPort: SteppedCadWorkerPort,
    downloadPort: DownloadPort,
  ) => Promise<void>;
}

export interface UseSteppedCadSplitOrchestrationReturn {
  splitPreviewParts: SteppedCadSplitPreviewPart[] | null;
  isGeneratingSplitPreview: boolean;
  handleGenerateSplitPreview: () => Promise<void>;
  clearSplitPreview: () => void;
  handleExportSplitParts: () => Promise<void>;
}

function disposeSplitPreviewParts(
  parts: SteppedCadSplitPreviewPart[] | null,
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
    useRef<SteppedCadSplitPreviewPart[] | null>(null);
  const [splitPreviewParts, setSplitPreviewParts] = useState<
    SteppedCadSplitPreviewPart[] | null
  >(null);
  const [isGeneratingSplitPreview, setIsGeneratingSplitPreview] =
    useState(false);
  paramsRef.current = params;

  const replaceSplitPreviewParts = useCallback(
    (next: SteppedCadSplitPreviewPart[] | null) => {
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
    const workerPort = trayWorkerService as SteppedCadWorkerPort | null;
    if (!workerPort) {
      toast("error", "当前环境无法使用后台建模服务");
      return;
    }

    const currentParams = paramsRef.current;
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
    const workerPort = trayWorkerService as SteppedCadWorkerPort | null;
    if (!workerPort) {
      toast("error", "当前环境无法使用后台建模服务");
      return;
    }

    const currentParams = paramsRef.current;
    if (currentParams.groups.length < 2) {
      toast("error", "至少需要两个分组才能导出分件");
      return;
    }

    try {
      await exportSplitParts(
        captureModeParamSnapshot("stepped-cad", currentParams),
        workerPort,
        browserDownloadPort,
      );
      toast("success", "分件 STL、定位孔清单和参数文件已导出");
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
