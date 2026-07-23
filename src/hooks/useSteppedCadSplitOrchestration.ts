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
import type {
  SteppedContinuousEditIntent,
  SteppedEditIntent,
} from "@/lib/stepped-edit-intent";
import {
  getBaseHoleFitBlockingReason,
  validateBaseHoleFit,
} from "@/lib/base-hole-rules";

interface UseSteppedCadSplitOrchestrationOptions {
  params: SteppedLayoutParams;
  transactionRevision?: number;
  edit: (intent: SteppedEditIntent) => unknown;
  previewEdit: (intent: SteppedContinuousEditIntent) => unknown;
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
  updateSplitParam: <K extends SteppedSplitParamKey>(
    key: K,
    value: SteppedLayoutParams[K],
  ) => void;
  previewSplitParam: <K extends SteppedSplitParamKey>(
    key: K,
    value: SteppedLayoutParams[K],
  ) => void;
  setSplitGrooveType: (type: SteppedLayoutParams["splitGrooveType"] | "off") => void;
  updateGroupSplitPartTarget: (groupId: string, targetGroupId: string | null) => void;
}

type SteppedSplitParamKey =
  | "enableSplitAssembly"
  | "splitGrooveDepth"
  | "enableSplitRecess"
  | "splitGrooveType"
  | "enableSplitLocators";

function disposeSplitPreviewParts(
  parts: SteppedSplitPreviewPart[] | null,
): void {
  parts?.forEach((part) => part.threeGeometry.dispose());
}

export function useSteppedCadSplitOrchestration(
  options: UseSteppedCadSplitOrchestrationOptions,
): UseSteppedCadSplitOrchestrationReturn {
  const {
    params,
    transactionRevision = 0,
    edit,
    previewEdit,
    generateSplitPreview,
    exportSplitParts,
  } = options;
  const { toast } = useToast();
  const paramsRef = useRef(params);
  const revisionRef = useRef(transactionRevision);
  const previousRevisionRef = useRef(transactionRevision);
  const splitPreviewPartsRef =
    useRef<SteppedSplitPreviewPart[] | null>(null);
  const splitPreviewRequestRef = useRef(0);
  const [splitPreviewParts, setSplitPreviewParts] = useState<
    SteppedSplitPreviewPart[] | null
  >(null);
  const [isGeneratingSplitPreview, setIsGeneratingSplitPreview] =
    useState(false);
  paramsRef.current = params;
  revisionRef.current = transactionRevision;

  const updateSplitParam = useCallback(<K extends SteppedSplitParamKey>(
    key: K,
    value: SteppedLayoutParams[K],
  ) => {
    edit({ type: "param.update", key, value } as SteppedEditIntent);
  }, [edit]);
  const previewSplitParam = useCallback(<K extends SteppedSplitParamKey>(
    key: K,
    value: SteppedLayoutParams[K],
  ) => {
    previewEdit({ type: "param.update", key, value } as SteppedContinuousEditIntent);
  }, [previewEdit]);
  const setSplitGrooveType = useCallback((
    type: SteppedLayoutParams["splitGrooveType"] | "off",
  ) => {
    edit({
      type: "params.patch",
      patch: type === "off"
        ? { enableSplitRecess: false }
        : { enableSplitRecess: true, splitGrooveType: type },
    });
  }, [edit]);
  const updateGroupSplitPartTarget = useCallback((
    groupId: string,
    targetGroupId: string | null,
  ) => {
    edit({ type: "group.split-target", groupId, targetGroupId });
  }, [edit]);

  const replaceSplitPreviewParts = useCallback(
    (next: SteppedSplitPreviewPart[] | null) => {
      disposeSplitPreviewParts(splitPreviewPartsRef.current);
      splitPreviewPartsRef.current = next;
      setSplitPreviewParts(next);
    },
    [],
  );

  const clearSplitPreview = useCallback(() => {
    splitPreviewRequestRef.current += 1;
    setIsGeneratingSplitPreview(false);
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
    if (previousRevisionRef.current !== transactionRevision) {
      previousRevisionRef.current = transactionRevision;
      clearSplitPreview();
    }
  }, [clearSplitPreview, transactionRevision]);

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
    const generationRevision = revisionRef.current;
    const requestId = splitPreviewRequestRef.current + 1;
    splitPreviewRequestRef.current = requestId;
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
      if (
        revisionRef.current !== generationRevision ||
        splitPreviewRequestRef.current !== requestId
      ) {
        disposeSplitPreviewParts(parts);
        return;
      }
      replaceSplitPreviewParts(parts);
    } catch (err) {
      if (splitPreviewRequestRef.current !== requestId) return;
      console.error("拆件预览生成失败:", err);
      toast(
        "error",
        `拆件预览失败：${err instanceof Error ? err.message : "未知错误"}`,
      );
    } finally {
      if (splitPreviewRequestRef.current === requestId) {
        setIsGeneratingSplitPreview(false);
      }
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
    updateSplitParam,
    previewSplitParam,
    setSplitGrooveType,
    updateGroupSplitPartTarget,
  };
}
