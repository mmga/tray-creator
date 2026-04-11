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
import { trayWorkerService } from "@/lib/worker/worker-service";
import { useToast } from "@/hooks/useToast";
import type * as THREE from "three";
import type { Geom3 } from "@jscad/modeling/src/geometries/types";
import type { SymmetryInsertSlot } from "@/lib/layout-symmetry";
import { useSteppedOutlinePreview } from "@/hooks/useSteppedOutlinePreview";
import { buildSteppedBridgeWarning } from "@/lib/stepped-bridge-warning";
import type { BridgeWarning } from "@/lib/stepped-connectivity";
import {
  addSteppedGroup,
  moveSteppedSlotsToGroup,
  removeSteppedGroup,
  reorderSteppedGroups,
  setSteppedActiveGroup,
  updateSteppedGroupDisconnectDistance,
  updateSteppedGroupDisconnectOverride,
  updateSteppedGroupHeight,
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
} from "@/lib/stepped-layout-math";
import {
  exportSteppedModelFiles,
  generateSteppedPreview,
} from "@/lib/stepped-model-service";
import {
  generateSteppedOptimizationProposals,
  type SteppedOptimizationProposal,
} from "@/lib/stepped-global-optimize";

export interface UseSteppedLayoutReturn {
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
  // 分组管理
  addGroup: () => void;
  removeGroup: (groupId: string) => void;
  updateGroupHeight: (groupId: string, height: number) => void;
  updateGroupSmoothingOverride: (groupId: string, enabled: boolean) => void;
  updateGroupSmoothingRadius: (groupId: string, radius: number) => void;
  updateGroupDisconnectOverride: (groupId: string, enabled: boolean) => void;
  updateGroupDisconnectDistance: (groupId: string, distance: number) => void;
  setActiveGroup: (groupId: string) => void;
  moveSelectedSlotsToGroup: (ids: string[], targetGroupId: string) => void;
  reorderGroups: (fromIndex: number, toIndex: number) => void;
  effectiveDimensions: {
    width: number;
    depth: number;
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
  // 历史操作
  saveSnapshot: () => void;
  undo: () => void;
  canUndo: boolean;
  // 3D 相关
  threeGeometry: THREE.BufferGeometry | null;
  volume: number;
  isGenerating: boolean;
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
  handleExportSTL: () => void;
  // 2D 分组轮廓预览
  outlinePreview: GroupOutlinePreview[] | null;
}

export function useSteppedLayout(): UseSteppedLayoutReturn {
  const [params, internalSetParams] = useState<SteppedLayoutParams>(
    STEPPED_LAYOUT_DEFAULTS,
  );
  const [threeGeometry, setThreeGeometry] =
    useState<THREE.BufferGeometry | null>(null);
  const [volume, setVolume] = useState<number>(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [optimizationProposals, setOptimizationProposals] = useState<
    SteppedOptimizationProposal[]
  >([]);
  const [isOptimizingLayout, setIsOptimizingLayout] = useState(false);
  const jscadGeomRef = useRef<Geom3 | null>(null);
  const { toast } = useToast();

  const {
    pushState,
    popState,
    canUndo: canUndoFn,
  } = useUndoHistory<SteppedLayoutParams>();
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const [isPreviewStale, setIsPreviewStale] = useState(false);
  const paramsVersionRef = useRef(0);
  const optimizationProposalsRef = useRef(optimizationProposals);
  const optimizationRequestIdRef = useRef(0);
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

  useEffect(() => {
    return () => {
      cancelPendingOptimization();
    };
  }, [cancelPendingOptimization]);

  const invalidatePreview = useCallback(() => {
    paramsVersionRef.current += 1;
    setIsPreviewStale(true);
    jscadGeomRef.current = null;
    setVolume(0);
    clearOptimizationProposals();
  }, [clearOptimizationProposals]);

  const setParams = useCallback<
    React.Dispatch<React.SetStateAction<SteppedLayoutParams>>
  >(
    (value) => {
      internalSetParams((prev) =>
        typeof value === "function"
          ? (value as (prevState: SteppedLayoutParams) => SteppedLayoutParams)(
              prev,
            )
          : value,
      );
      invalidatePreview();
    },
    [invalidatePreview],
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
      internalSetParams(prev);
      invalidatePreview();
    }
  }, [invalidatePreview, popState]);

  const updateParam = useCallback(
    <K extends keyof SteppedLayoutParams>(
      key: K,
      value: SteppedLayoutParams[K],
    ) => {
      pushState(paramsRef.current);
      internalSetParams((prev) => updateSteppedLayoutParam(prev, key, value));
      invalidatePreview();
    },
    [invalidatePreview, pushState],
  );

  const addSlot = useCallback(
    (width: number) => {
      internalSetParams((prev) => {
        pushState(prev);
        return addSteppedSlot(prev, randomIdFactory, width);
      });
      invalidatePreview();
    },
    [invalidatePreview, pushState],
  );

  const removeSlot = useCallback(
    (id: string) => {
      pushState(paramsRef.current);
      internalSetParams((prev) => removeSteppedSlot(prev, id));
      invalidatePreview();
    },
    [invalidatePreview, pushState],
  );

  const updateSlotPosition = useCallback(
    (id: string, x: number, y: number) => {
      internalSetParams((prev) => updateSteppedSlotPosition(prev, id, x, y));
      invalidatePreview();
    },
    [invalidatePreview],
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

        return applySteppedSlotUpdates(prev, updates);
      });
      invalidatePreview();
    },
    [invalidatePreview, pushState],
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
      internalSetParams((prev) => updateSteppedSlotRotation(prev, id, rotation));
      invalidatePreview();
    },
    [invalidatePreview],
  );

  const insertSlots = useCallback(
    (slotsToInsert: SymmetryInsertSlot[]) => {
      if (slotsToInsert.length === 0) return;

      internalSetParams((prev) => {
        pushState(prev);
        return insertSteppedSlots(prev, randomIdFactory, slotsToInsert);
      });
      invalidatePreview();
    },
    [invalidatePreview, pushState],
  );

  const duplicateSlots = useCallback(
    (ids: string[]): string[] => {
      const current = paramsRef.current;
      pushState(current);
      const result = duplicateSteppedSlots(current, randomIdFactory, ids);
      internalSetParams(result.params);
      invalidatePreview();
      return result.newIds;
    },
    [invalidatePreview, pushState],
  );

  const addGroup = useCallback(() => {
    internalSetParams((prev) => {
      pushState(prev);
      return addSteppedGroup(prev, randomIdFactory);
    });
    invalidatePreview();
  }, [invalidatePreview, pushState]);

  const removeGroup = useCallback(
    (groupId: string) => {
      internalSetParams((prev) => {
        const next = removeSteppedGroup(prev, groupId);
        if (next === prev) {
          return prev;
        }
        pushState(prev);
        return next;
      });
      invalidatePreview();
    },
    [invalidatePreview, pushState],
  );

  const updateGroupHeight = useCallback(
    (groupId: string, height: number) => {
      pushState(paramsRef.current);
      internalSetParams((prev) => updateSteppedGroupHeight(prev, groupId, height));
      invalidatePreview();
    },
    [invalidatePreview, pushState],
  );

  const updateGroupSmoothingOverride = useCallback(
    (groupId: string, enabled: boolean) => {
      pushState(paramsRef.current);
      internalSetParams((prev) =>
        updateSteppedGroupSmoothingOverride(prev, groupId, enabled),
      );
      invalidatePreview();
    },
    [invalidatePreview, pushState],
  );

  const updateGroupSmoothingRadius = useCallback(
    (groupId: string, radius: number) => {
      pushState(paramsRef.current);
      internalSetParams((prev) =>
        updateSteppedGroupSmoothingRadius(prev, groupId, radius),
      );
      invalidatePreview();
    },
    [invalidatePreview, pushState],
  );

  const updateGroupDisconnectOverride = useCallback(
    (groupId: string, enabled: boolean) => {
      pushState(paramsRef.current);
      internalSetParams((prev) =>
        updateSteppedGroupDisconnectOverride(prev, groupId, enabled),
      );
      invalidatePreview();
    },
    [invalidatePreview, pushState],
  );

  const updateGroupDisconnectDistance = useCallback(
    (groupId: string, distance: number) => {
      pushState(paramsRef.current);
      internalSetParams((prev) =>
        updateSteppedGroupDisconnectDistance(prev, groupId, distance),
      );
      invalidatePreview();
    },
    [invalidatePreview, pushState],
  );

  const setActiveGroup = useCallback((groupId: string) => {
    internalSetParams((prev) => setSteppedActiveGroup(prev, groupId));
  }, []);

  const moveSelectedSlotsToGroup = useCallback(
    (ids: string[], targetGroupId: string) => {
      pushState(paramsRef.current);
      internalSetParams((prev) =>
        moveSteppedSlotsToGroup(prev, ids, targetGroupId),
      );
      invalidatePreview();
    },
    [invalidatePreview, pushState],
  );

  const reorderGroups = useCallback(
    (fromIndex: number, toIndex: number) => {
      internalSetParams((prev) => {
        const next = reorderSteppedGroups(prev, fromIndex, toIndex);
        if (next === prev) {
          return prev;
        }
        pushState(prev);
        return next;
      });
      clearOptimizationProposals();
    },
    [clearOptimizationProposals, pushState],
  );

  const trimBaseplate = useCallback(() => {
    internalSetParams((prev) => {
      if (prev.slots.length === 0) return prev;
      pushState(prev);
      const dims = calculateSteppedEffectiveDimensions(prev);
      return trimSteppedBaseplate(prev, dims);
    });
    invalidatePreview();
  }, [invalidatePreview, pushState]);

  const handleGenerate = useCallback(async () => {
    if (!trayWorkerService) return;
    const requestVersion = paramsVersionRef.current;
    setIsGenerating(true);
    try {
      const result = await generateSteppedPreview(
        paramsRef.current,
        trayWorkerService,
      );
      if (requestVersion !== paramsVersionRef.current) {
        return;
      }
      jscadGeomRef.current = result.geometry;
      setVolume(result.volume);
      setThreeGeometry((prev) => {
        prev?.dispose();
        return result.threeGeometry;
      });
      setIsPreviewStale(false);
    } catch (err) {
      console.error("生成失败:", err);
      toast(
        "error",
        `模型生成失败：${err instanceof Error ? err.message : "未知错误"}`,
      );
    } finally {
      setIsGenerating(false);
    }
  }, [toast]);

  const handleExportSTL = useCallback(async () => {
    if (isPreviewStale) {
      toast("error", "参数已变更，请先点击开始锻造生成最新模型");
      return;
    }
    if (!jscadGeomRef.current || !trayWorkerService) {
      toast("error", "当前没有可导出的模型，请先点击开始锻造");
      return;
    }
    const currentParams = paramsRef.current;
    try {
      await exportSteppedModelFiles(
        currentParams,
        effectiveDimensions,
        jscadGeomRef.current,
        trayWorkerService,
        browserDownloadPort,
      );
    } catch (err) {
      console.error("STL导出失败:", err);
      toast(
        "error",
        `STL 导出失败：${err instanceof Error ? err.message : "未知错误"}`,
      );
    }
  }, [
    effectiveDimensions,
    isPreviewStale,
    toast,
  ]);

  const bridgeWarning = useMemo<BridgeWarning | null>(() => {
    return buildSteppedBridgeWarning(params);
  }, [params]);

  const generateOptimizationProposalsForCurrentParams = useCallback(() => {
    cancelPendingOptimization();
    setIsOptimizingLayout(true);
    setOptimizationProposals([]);
    const requestId = optimizationRequestIdRef.current + 1;
    optimizationRequestIdRef.current = requestId;
    optimizationTimeoutRef.current = setTimeout(() => {
      optimizationTimeoutRef.current = null;
      try {
        const proposals = generateSteppedOptimizationProposals(paramsRef.current);
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
      internalSetParams(proposal.params);
      invalidatePreview();
    },
    [invalidatePreview, pushState],
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
    setActiveGroup,
    moveSelectedSlotsToGroup,
    reorderGroups,
    effectiveDimensions,
    saveSnapshot,
    undo,
    canUndo: canUndoFn(),
    threeGeometry,
    volume,
    isGenerating,
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
    handleExportSTL,
    outlinePreview,
  };
}
