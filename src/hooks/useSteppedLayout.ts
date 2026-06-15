"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { browserDownloadPort } from "@/lib/download-port";
import { randomIdFactory } from "@/lib/id-factory";
import type {
  SteppedLayoutParams,
  GroupOutlinePreview,
} from "@/types/custom-tray";
import { STEPPED_LAYOUT_DEFAULTS } from "@/lib/stepped-config";
import { useEditableParams } from "@/hooks/useEditableParams";
import { trayWorkerService } from "@/lib/worker/worker-service";
import type * as THREE from "three";
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
  const [optimizationProposals, setOptimizationProposals] = useState<
    SteppedOptimizationProposal[]
  >([]);
  const [isOptimizingLayout, setIsOptimizingLayout] = useState(false);

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

  useEffect(() => {
    return () => {
      cancelPendingOptimization();
    };
  }, [cancelPendingOptimization]);

  const {
    params,
    paramsRef,
    setParams,
    applyChange,
    saveSnapshot,
    undo,
    canUndo,
    invalidatePreview,
    threeGeometry,
    volume,
    isGenerating,
    isPreviewStale,
    handleGenerate,
    handleExportSTL,
  } = useEditableParams<SteppedLayoutParams>({
    initialState: STEPPED_LAYOUT_DEFAULTS,
    guard: () => trayWorkerService !== null,
    generatePreview: async (currentParams) =>
      generateSteppedPreview(currentParams, trayWorkerService!),
    exportModel: async (currentParams, geometry) => {
      await exportSteppedModelFiles(
        currentParams,
        calculateSteppedEffectiveDimensions(currentParams),
        geometry,
        trayWorkerService!,
        browserDownloadPort,
      );
    },
    onInvalidate: () => {
      optimizationVariantRef.current = 0;
      clearOptimizationProposals();
    },
  });

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

  const updateParam = useCallback(
    <K extends keyof SteppedLayoutParams>(
      key: K,
      value: SteppedLayoutParams[K],
    ) => {
      applyChange((prev) => updateSteppedLayoutParam(prev, key, value));
    },
    [applyChange],
  );

  const addSlot = useCallback(
    (width: number) => {
      applyChange((prev) => addSteppedSlot(prev, randomIdFactory, width));
    },
    [applyChange],
  );

  const removeSlot = useCallback(
    (id: string) => {
      applyChange((prev) => removeSteppedSlot(prev, id));
    },
    [applyChange],
  );

  const updateSlotPosition = useCallback(
    (id: string, x: number, y: number) => {
      applyChange(
        (prev) => updateSteppedSlotPosition(prev, id, x, y),
        { history: "live" },
      );
    },
    [applyChange],
  );

  const {
    outlinePreview,
    pauseOutlinePreview,
    resumeOutlinePreview,
  } = useSteppedOutlinePreview(params, trayWorkerService);

  const updateMultipleSlots = useCallback(
    (updates: SteppedSlotUpdate[]) => {
      applyChange((prev) => applySteppedSlotUpdates(prev, updates));
    },
    [applyChange],
  );

  const updateMultipleSlotsLive = useCallback(
    (updates: SteppedSlotUpdate[]) => {
      applyChange(
        (prev) => applySteppedSlotUpdates(prev, updates),
        { history: "live" },
      );
    },
    [applyChange],
  );

  const updateSlotRotation = useCallback(
    (id: string, rotation: number) => {
      applyChange(
        (prev) => updateSteppedSlotRotation(prev, id, rotation),
        { history: "live" },
      );
    },
    [applyChange],
  );

  const insertSlots = useCallback(
    (slotsToInsert: SymmetryInsertSlot[]) => {
      if (slotsToInsert.length === 0) return;
      applyChange((prev) =>
        insertSteppedSlots(prev, randomIdFactory, slotsToInsert),
      );
    },
    [applyChange],
  );

  const duplicateSlots = useCallback(
    (ids: string[]): string[] => {
      const current = paramsRef.current;
      const result = duplicateSteppedSlots(current, randomIdFactory, ids);
      applyChange(() => result.params, { force: true });
      return result.newIds;
    },
    [applyChange, paramsRef],
  );

  const addGroup = useCallback(() => {
    applyChange((prev) => addSteppedGroup(prev, randomIdFactory));
  }, [applyChange]);

  const removeGroup = useCallback(
    (groupId: string) => {
      applyChange((prev) => removeSteppedGroup(prev, groupId));
    },
    [applyChange],
  );

  const updateGroupHeight = useCallback(
    (groupId: string, height: number) => {
      applyChange((prev) => updateSteppedGroupHeight(prev, groupId, height));
    },
    [applyChange],
  );

  const updateGroupSmoothingOverride = useCallback(
    (groupId: string, enabled: boolean) => {
      applyChange((prev) =>
        updateSteppedGroupSmoothingOverride(prev, groupId, enabled),
      );
    },
    [applyChange],
  );

  const updateGroupSmoothingRadius = useCallback(
    (groupId: string, radius: number) => {
      applyChange((prev) =>
        updateSteppedGroupSmoothingRadius(prev, groupId, radius),
      );
    },
    [applyChange],
  );

  const updateGroupDisconnectOverride = useCallback(
    (groupId: string, enabled: boolean) => {
      applyChange((prev) =>
        updateSteppedGroupDisconnectOverride(prev, groupId, enabled),
      );
    },
    [applyChange],
  );

  const updateGroupDisconnectDistance = useCallback(
    (groupId: string, distance: number) => {
      applyChange((prev) =>
        updateSteppedGroupDisconnectDistance(prev, groupId, distance),
      );
    },
    [applyChange],
  );

  const setActiveGroup = useCallback((groupId: string) => {
    // setActiveGroup 不需要历史记录也不失效预览（仅切换活跃分组高亮）
    applyChange(
      (prev) => setSteppedActiveGroup(prev, groupId),
      { history: "skip" },
    );
  }, [applyChange]);

  const moveSelectedSlotsToGroup = useCallback(
    (ids: string[], targetGroupId: string) => {
      applyChange((prev) =>
        moveSteppedSlotsToGroup(prev, ids, targetGroupId),
      );
    },
    [applyChange],
  );

  const reorderGroups = useCallback(
    (fromIndex: number, toIndex: number) => {
      // 特例：reorderGroups 用 clearOptimizationProposals 替代 invalidatePreview，
      // 不通过 applyChange 以避免触发预览失效（保持原行为）
      applyChange(
        (prev) => reorderSteppedGroups(prev, fromIndex, toIndex),
        { history: "skip" },
      );
      clearOptimizationProposals();
    },
    [applyChange, clearOptimizationProposals],
  );

  const trimBaseplate = useCallback(() => {
    applyChange((prev) => {
      if (prev.slots.length === 0) return prev;
      const dims = calculateSteppedEffectiveDimensions(prev);
      return trimSteppedBaseplate(prev, dims);
    });
  }, [applyChange]);

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

      applyChange(() => proposal.params, { force: true });
    },
    [applyChange],
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
    canUndo,
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
