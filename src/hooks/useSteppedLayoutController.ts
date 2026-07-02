"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { browserDownloadPort } from "@/lib/download-port";
import { randomIdFactory } from "@/lib/id-factory";
import type {
  SteppedLayoutParams,
  GroupOutlinePreview,
} from "@/types/custom-tray";
import { STEPPED_LAYOUT_DEFAULTS } from "@/lib/stepped-config";
import { useUndoHistory } from "@/hooks/useUndoHistory";
import { usePreviewLifecycle } from "@/hooks/usePreviewLifecycle";
import { useToast } from "@/hooks/useToast";
import { trayWorkerService } from "@/lib/worker/worker-service";
import type * as THREE from "three";
import type { SymmetryInsertSlot } from "@/lib/layout-symmetry";
import { useSteppedOutlinePreview } from "@/hooks/useSteppedOutlinePreview";
import { buildSteppedBridgeWarning } from "@/lib/stepped-bridge-warning";
import type { BridgeWarning } from "@/lib/stepped-connectivity";
import { applySteppedBaseHoleDerivedFields } from "@/lib/stepped-base-hole";
import {
  addSteppedGroup,
  moveSteppedSlotsToGroup,
  removeSteppedGroup,
  reorderSteppedGroups,
  setSteppedActiveGroup,
  updateSteppedGroupDisconnectDistance,
  updateSteppedGroupDisconnectOverride,
  updateSteppedGroupHeight,
  updateSteppedGroupSplitPartTarget,
  updateSteppedGroupSmoothingOverride,
  updateSteppedGroupSmoothingRadius,
} from "@/lib/stepped-layout-group-actions";
import {
  addSteppedSlot,
  applySteppedSlotUpdates,
  duplicateSteppedSlots,
  insertSteppedSlots,
  removeSteppedSlot,
  trimSteppedBaseplate,
  updateSteppedLayoutParam,
  updateSteppedSlotPosition,
  updateSteppedSlotRotation,
  type SteppedSlotUpdate,
} from "@/lib/stepped-layout-slot-actions";
import {
  calculateSteppedEffectiveDimensions,
  type SteppedLayoutExtents,
} from "@/lib/stepped-layout-math";
import type {
  DownloadPort,
  STLExportWorkerPort,
  SteppedOutlinePreviewPort,
} from "@/lib/model-ports";
import type { Geom3 } from "@jscad/modeling/src/geometries/types";
import {
  generateSteppedOptimizationProposals,
  type SteppedOptimizationProposal,
} from "@/lib/stepped-global-optimize";
import type {
  SteppedPreviewResult,
  SteppedSplitPreviewPart,
} from "@/lib/stepped-model-service";

export interface UseSteppedLayoutControllerReturn {
  params: SteppedLayoutParams;
  setParams: React.Dispatch<React.SetStateAction<SteppedLayoutParams>>;
  updateParam: <K extends keyof SteppedLayoutParams>(
    key: K,
    value: SteppedLayoutParams[K],
  ) => void;
  addSlot: (width: number) => void;
  removeSlot: (id: string) => void;
  updateSlotPosition: (id: string, x: number, y: number) => void;
  updateMultipleSlots: (
    updates: { id: string; x: number; y: number; rotation?: number }[],
  ) => void;
  updateMultipleSlotsLive: (
    updates: { id: string; x: number; y: number; rotation?: number }[],
  ) => void;
  updateSlotRotation: (id: string, rotation: number) => void;
  insertSlots: (slots: SymmetryInsertSlot[]) => void;
  duplicateSlots: (ids: string[]) => string[];
  trimBaseplate: () => void;
  addGroup: () => void;
  removeGroup: (groupId: string) => void;
  updateGroupHeight: (groupId: string, height: number) => void;
  updateGroupSmoothingOverride: (groupId: string, enabled: boolean) => void;
  updateGroupSmoothingRadius: (groupId: string, radius: number) => void;
  updateGroupDisconnectOverride: (groupId: string, enabled: boolean) => void;
  updateGroupDisconnectDistance: (groupId: string, distance: number) => void;
  updateGroupSplitPartTarget: (
    groupId: string,
    targetGroupId: string | null,
  ) => void;
  setActiveGroup: (groupId: string) => void;
  moveSelectedSlotsToGroup: (ids: string[], targetGroupId: string) => void;
  reorderGroups: (fromIndex: number, toIndex: number) => void;
  effectiveDimensions: SteppedLayoutExtents;
  saveSnapshot: () => void;
  undo: () => void;
  canUndo: boolean;
  threeGeometry: THREE.BufferGeometry | null;
  splitPreviewParts: SteppedSplitPreviewPart[] | null;
  volume: number;
  isGenerating: boolean;
  isGeneratingSplitPreview: boolean;
  isPreviewStale: boolean;
  bridgeWarning: BridgeWarning | null;
  optimizationProposals: SteppedOptimizationProposal[];
  isOptimizingLayout: boolean;
  generateOptimizationProposals: () => void;
  applyOptimizationProposal: (proposalId: SteppedOptimizationProposal["id"]) => void;
  clearOptimizationProposals: () => void;
  pauseOutlinePreview: () => void;
  resumeOutlinePreview: () => void;
  handleGenerate: () => void;
  handleGenerateSplitPreview: () => void;
  clearSplitPreview: () => void;
  handleExportSTL: () => void;
  handleExportSplitParts: () => void;
  outlinePreview: GroupOutlinePreview[] | null;
}

interface UseSteppedLayoutControllerOptions<
  TWorkerPort extends STLExportWorkerPort & SteppedOutlinePreviewPort,
> {
  generatePreview: (
    params: SteppedLayoutParams,
    workerPort: TWorkerPort,
  ) => Promise<SteppedPreviewResult>;
  exportModel: (
    params: SteppedLayoutParams,
    effectiveDimensions: SteppedLayoutExtents,
    geometry: Geom3,
    workerPort: TWorkerPort,
    downloadPort: DownloadPort,
  ) => Promise<void>;
  generateSplitPreview?: (
    params: SteppedLayoutParams,
    workerPort: TWorkerPort,
  ) => Promise<SteppedSplitPreviewPart[]>;
  exportSplitParts?: (
    params: SteppedLayoutParams,
    effectiveDimensions: SteppedLayoutExtents,
    workerPort: TWorkerPort,
    downloadPort: DownloadPort,
  ) => Promise<void>;
}

export function useSteppedLayoutController<
  TWorkerPort extends STLExportWorkerPort & SteppedOutlinePreviewPort,
>({
  generatePreview,
  exportModel,
  generateSplitPreview,
  exportSplitParts,
}: UseSteppedLayoutControllerOptions<TWorkerPort>): UseSteppedLayoutControllerReturn {
  const { toast } = useToast();
  const [params, internalSetParams] = useState<SteppedLayoutParams>(
    () => applySteppedBaseHoleDerivedFields(STEPPED_LAYOUT_DEFAULTS),
  );
  const [optimizationProposals, setOptimizationProposals] = useState<
    SteppedOptimizationProposal[]
  >([]);
  const [isOptimizingLayout, setIsOptimizingLayout] = useState(false);
  const [splitPreviewParts, setSplitPreviewParts] = useState<
    SteppedSplitPreviewPart[] | null
  >(null);
  const [isGeneratingSplitPreview, setIsGeneratingSplitPreview] =
    useState(false);

  const {
    pushState,
    popState,
    canUndo: canUndoFn,
  } = useUndoHistory<SteppedLayoutParams>();
  const paramsRef = useRef(params);
  useEffect(() => {
    paramsRef.current = params;
  }, [params]);
  const optimizationProposalsRef = useRef(optimizationProposals);
  const optimizationRequestIdRef = useRef(0);
  const optimizationVariantRef = useRef(0);
  const optimizationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  optimizationProposalsRef.current = optimizationProposals;

  const cancelPendingOptimization = useCallback(() => {
    optimizationRequestIdRef.current += 1;
    if (optimizationTimeoutRef.current !== null) {
      clearTimeout(optimizationTimeoutRef.current);
      optimizationTimeoutRef.current = null;
    }
  }, []);

  const clearOptimizationProposals = useCallback(() => {
    cancelPendingOptimization();
    setOptimizationProposals([]);
    setIsOptimizingLayout(false);
  }, [cancelPendingOptimization]);

  const normalizeParams = useCallback(
    (nextParams: SteppedLayoutParams) =>
      applySteppedBaseHoleDerivedFields(nextParams),
    [],
  );

  const clearSplitPreview = useCallback(() => {
    setSplitPreviewParts((prev) => {
      prev?.forEach((part) => part.threeGeometry.dispose());
      return null;
    });
  }, []);

  useEffect(() => {
    return () => {
      cancelPendingOptimization();
      splitPreviewParts?.forEach((part) => part.threeGeometry.dispose());
    };
  }, [cancelPendingOptimization, splitPreviewParts]);

  const {
    threeGeometry,
    volume,
    isGenerating,
    isPreviewStale,
    invalidatePreview,
    handleGenerate,
    handleExportSTL,
  } = usePreviewLifecycle({
    getParams: () => paramsRef.current,
    generatePreview: async (currentParams) => {
      const workerPort = trayWorkerService as unknown as TWorkerPort | null;
      if (!workerPort) {
        return null;
      }
      return generatePreview(currentParams, workerPort);
    },
    exportModel: async (currentParams, geometry) => {
      const workerPort = trayWorkerService as unknown as TWorkerPort | null;
      if (!workerPort) {
        return;
      }
      await exportModel(
        currentParams,
        calculateSteppedEffectiveDimensions(currentParams),
        geometry,
        workerPort,
        browserDownloadPort,
      );
    },
    onInvalidate: () => {
      optimizationVariantRef.current = 0;
      clearOptimizationProposals();
      clearSplitPreview();
    },
  });

  const handleGenerateSplitPreview = useCallback(async () => {
    if (!generateSplitPreview) {
      toast("error", "CAD 阶梯模式暂不支持拆件预览");
      return;
    }

    const workerPort = trayWorkerService as unknown as TWorkerPort | null;
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
      const parts = await generateSplitPreview(currentParams, workerPort);
      setSplitPreviewParts((prev) => {
        prev?.forEach((part) => part.threeGeometry.dispose());
        return parts;
      });
    } catch (err) {
      console.error("拆件预览生成失败:", err);
      toast(
        "error",
        `拆件预览失败：${err instanceof Error ? err.message : "未知错误"}`,
      );
    } finally {
      setIsGeneratingSplitPreview(false);
    }
  }, [generateSplitPreview, toast]);

  const handleExportSplitParts = useCallback(async () => {
    if (!exportSplitParts) {
      toast("error", "CAD 阶梯模式暂不支持分件导出");
      return;
    }

    const workerPort = trayWorkerService as unknown as TWorkerPort | null;
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
        currentParams,
        calculateSteppedEffectiveDimensions(currentParams),
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

  const setParams = useCallback<
    React.Dispatch<React.SetStateAction<SteppedLayoutParams>>
  >(
    (value) => {
      internalSetParams((prev) =>
        normalizeParams(typeof value === "function"
          ? (value as (prevState: SteppedLayoutParams) => SteppedLayoutParams)(
              prev,
            )
          : value),
      );
      invalidatePreview();
    },
    [invalidatePreview, normalizeParams],
  );

  const calculateEffectiveDimensions = useCallback(
    (current: SteppedLayoutParams = paramsRef.current) => {
      return calculateSteppedEffectiveDimensions(current);
    },
    [],
  );

  const effectiveDimensions = useMemo(
    () => calculateEffectiveDimensions(params),
    [calculateEffectiveDimensions, params],
  );

  const saveSnapshot = useCallback(() => {
    pushState(paramsRef.current);
  }, [pushState]);

  const undo = useCallback(() => {
    const prev = popState();
    if (prev) {
      internalSetParams(normalizeParams(prev));
      invalidatePreview();
    }
  }, [invalidatePreview, normalizeParams, popState]);

  const updateParam = useCallback(
    <K extends keyof SteppedLayoutParams>(
      key: K,
      value: SteppedLayoutParams[K],
    ) => {
      pushState(paramsRef.current);
      internalSetParams((prev) =>
        normalizeParams(updateSteppedLayoutParam(prev, key, value)),
      );
      invalidatePreview();
    },
    [invalidatePreview, normalizeParams, pushState],
  );

  const addSlot = useCallback(
    (width: number) => {
      internalSetParams((prev) => {
        pushState(prev);
        return normalizeParams(addSteppedSlot(prev, randomIdFactory, width));
      });
      invalidatePreview();
    },
    [invalidatePreview, normalizeParams, pushState],
  );

  const removeSlot = useCallback(
    (id: string) => {
      pushState(paramsRef.current);
      internalSetParams((prev) => normalizeParams(removeSteppedSlot(prev, id)));
      invalidatePreview();
    },
    [invalidatePreview, normalizeParams, pushState],
  );

  const updateSlotPosition = useCallback(
    (id: string, x: number, y: number) => {
      internalSetParams((prev) =>
        normalizeParams(updateSteppedSlotPosition(prev, id, x, y)),
      );
      invalidatePreview();
    },
    [invalidatePreview, normalizeParams],
  );

  const {
    outlinePreview,
    pauseOutlinePreview,
    resumeOutlinePreview,
  } = useSteppedOutlinePreview(params, trayWorkerService);

  const applyMultipleSlotUpdates = useCallback(
    (
      updates: SteppedSlotUpdate[],
      saveHistory: boolean,
    ) => {
      internalSetParams((prev) => {
        if (saveHistory) {
          pushState(prev);
        }

        return normalizeParams(applySteppedSlotUpdates(prev, updates));
      });
      invalidatePreview();
    },
    [invalidatePreview, normalizeParams, pushState],
  );

  const updateMultipleSlots = useCallback(
    (updates: SteppedSlotUpdate[]) => {
      applyMultipleSlotUpdates(updates, true);
    },
    [applyMultipleSlotUpdates],
  );

  const updateMultipleSlotsLive = useCallback(
    (updates: SteppedSlotUpdate[]) => {
      applyMultipleSlotUpdates(updates, false);
    },
    [applyMultipleSlotUpdates],
  );

  const updateSlotRotation = useCallback(
    (id: string, rotation: number) => {
      internalSetParams((prev) =>
        normalizeParams(updateSteppedSlotRotation(prev, id, rotation)),
      );
      invalidatePreview();
    },
    [invalidatePreview, normalizeParams],
  );

  const insertSlots = useCallback(
    (slotsToInsert: SymmetryInsertSlot[]) => {
      if (slotsToInsert.length === 0) return;

      internalSetParams((prev) => {
        pushState(prev);
        return normalizeParams(
          insertSteppedSlots(prev, randomIdFactory, slotsToInsert),
        );
      });
      invalidatePreview();
    },
    [invalidatePreview, normalizeParams, pushState],
  );

  const duplicateSlots = useCallback(
    (ids: string[]): string[] => {
      const current = paramsRef.current;
      pushState(current);
      const result = duplicateSteppedSlots(current, randomIdFactory, ids);
      internalSetParams(normalizeParams(result.params));
      invalidatePreview();
      return result.newIds;
    },
    [invalidatePreview, normalizeParams, pushState],
  );

  const addGroup = useCallback(() => {
    internalSetParams((prev) => {
      pushState(prev);
      return normalizeParams(addSteppedGroup(prev, randomIdFactory));
    });
    invalidatePreview();
  }, [invalidatePreview, normalizeParams, pushState]);

  const removeGroup = useCallback(
    (groupId: string) => {
      internalSetParams((prev) => {
        const next = removeSteppedGroup(prev, groupId);
        if (next === prev) {
          return prev;
        }
        pushState(prev);
        return normalizeParams(next);
      });
      invalidatePreview();
    },
    [invalidatePreview, normalizeParams, pushState],
  );

  const updateGroupHeight = useCallback(
    (groupId: string, height: number) => {
      pushState(paramsRef.current);
      internalSetParams((prev) =>
        normalizeParams(updateSteppedGroupHeight(prev, groupId, height)),
      );
      invalidatePreview();
    },
    [invalidatePreview, normalizeParams, pushState],
  );

  const updateGroupSmoothingOverride = useCallback(
    (groupId: string, enabled: boolean) => {
      pushState(paramsRef.current);
      internalSetParams((prev) =>
        normalizeParams(
          updateSteppedGroupSmoothingOverride(prev, groupId, enabled),
        ),
      );
      invalidatePreview();
    },
    [invalidatePreview, normalizeParams, pushState],
  );

  const updateGroupSmoothingRadius = useCallback(
    (groupId: string, radius: number) => {
      pushState(paramsRef.current);
      internalSetParams((prev) =>
        normalizeParams(updateSteppedGroupSmoothingRadius(prev, groupId, radius)),
      );
      invalidatePreview();
    },
    [invalidatePreview, normalizeParams, pushState],
  );

  const updateGroupDisconnectOverride = useCallback(
    (groupId: string, enabled: boolean) => {
      pushState(paramsRef.current);
      internalSetParams((prev) =>
        normalizeParams(
          updateSteppedGroupDisconnectOverride(prev, groupId, enabled),
        ),
      );
      invalidatePreview();
    },
    [invalidatePreview, normalizeParams, pushState],
  );

  const updateGroupDisconnectDistance = useCallback(
    (groupId: string, distance: number) => {
      pushState(paramsRef.current);
      internalSetParams((prev) =>
        normalizeParams(
          updateSteppedGroupDisconnectDistance(prev, groupId, distance),
        ),
      );
      invalidatePreview();
    },
    [invalidatePreview, normalizeParams, pushState],
  );

  const updateGroupSplitPartTarget = useCallback(
    (groupId: string, targetGroupId: string | null) => {
      pushState(paramsRef.current);
      internalSetParams((prev) =>
        normalizeParams(
          updateSteppedGroupSplitPartTarget(prev, groupId, targetGroupId),
        ),
      );
      invalidatePreview();
    },
    [invalidatePreview, normalizeParams, pushState],
  );

  const setActiveGroup = useCallback((groupId: string) => {
    internalSetParams((prev) =>
      normalizeParams(setSteppedActiveGroup(prev, groupId)),
    );
  }, [normalizeParams]);

  const moveSelectedSlotsToGroup = useCallback(
    (ids: string[], targetGroupId: string) => {
      pushState(paramsRef.current);
      internalSetParams((prev) =>
        normalizeParams(moveSteppedSlotsToGroup(prev, ids, targetGroupId)),
      );
      invalidatePreview();
    },
    [invalidatePreview, normalizeParams, pushState],
  );

  const reorderGroups = useCallback(
    (fromIndex: number, toIndex: number) => {
      internalSetParams((prev) => {
        const next = reorderSteppedGroups(prev, fromIndex, toIndex);
        if (next === prev) {
          return prev;
        }
        pushState(prev);
        return normalizeParams(next);
      });
      clearOptimizationProposals();
    },
    [clearOptimizationProposals, normalizeParams, pushState],
  );

  const trimBaseplate = useCallback(() => {
    internalSetParams((prev) => {
      if (prev.slots.length === 0) return prev;
      pushState(prev);
      const dims = calculateSteppedEffectiveDimensions(prev);
      return normalizeParams(trimSteppedBaseplate(prev, dims));
    });
    invalidatePreview();
  }, [invalidatePreview, normalizeParams, pushState]);

  const bridgeWarning = useMemo<BridgeWarning | null>(() => {
    return buildSteppedBridgeWarning(params);
  }, [params]);

  const generateOptimizationProposalsForCurrentParams = useCallback(() => {
    cancelPendingOptimization();
    setIsOptimizingLayout(true);
    setOptimizationProposals([]);
    const variantIndex = optimizationVariantRef.current;
    optimizationVariantRef.current += 1;
    const requestId = optimizationRequestIdRef.current + 1;
    optimizationRequestIdRef.current = requestId;
    optimizationTimeoutRef.current = setTimeout(() => {
      optimizationTimeoutRef.current = null;
      try {
        const proposals = generateSteppedOptimizationProposals(
          paramsRef.current,
          { variantIndex },
        );
        if (optimizationRequestIdRef.current !== requestId) {
          return;
        }
        setOptimizationProposals(proposals);
      } finally {
        if (optimizationRequestIdRef.current === requestId) {
          setIsOptimizingLayout(false);
        }
      }
    }, 0);
  }, [cancelPendingOptimization]);

  const applyOptimizationProposal = useCallback(
    (proposalId: SteppedOptimizationProposal["id"]) => {
      const proposal = optimizationProposalsRef.current.find(
        (entry) => entry.id === proposalId,
      );
      if (!proposal) {
        return;
      }

      pushState(paramsRef.current, { force: true });
      internalSetParams(normalizeParams(proposal.params));
      invalidatePreview();
    },
    [invalidatePreview, normalizeParams, pushState],
  );

  return {
    params,
    setParams,
    updateParam,
    addSlot,
    removeSlot,
    updateSlotPosition,
    updateMultipleSlots,
    updateMultipleSlotsLive,
    updateSlotRotation,
    insertSlots,
    duplicateSlots,
    trimBaseplate,
    addGroup,
    removeGroup,
    updateGroupHeight,
    updateGroupSmoothingOverride,
    updateGroupSmoothingRadius,
    updateGroupDisconnectOverride,
    updateGroupDisconnectDistance,
    updateGroupSplitPartTarget,
    setActiveGroup,
    moveSelectedSlotsToGroup,
    reorderGroups,
    effectiveDimensions,
    saveSnapshot,
    undo,
    canUndo: canUndoFn(),
    threeGeometry,
    splitPreviewParts,
    volume,
    isGenerating,
    isGeneratingSplitPreview,
    isPreviewStale,
    bridgeWarning,
    optimizationProposals,
    isOptimizingLayout,
    generateOptimizationProposals: generateOptimizationProposalsForCurrentParams,
    applyOptimizationProposal,
    clearOptimizationProposals,
    pauseOutlinePreview,
    resumeOutlinePreview,
    handleGenerate,
    handleGenerateSplitPreview,
    clearSplitPreview,
    handleExportSTL,
    handleExportSplitParts,
    outlinePreview,
  };
}
