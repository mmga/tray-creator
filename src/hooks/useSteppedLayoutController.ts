"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { browserDownloadPort } from "@/lib/download-port";
import { randomIdFactory } from "@/lib/id-factory";
import type {
  SteppedLayoutParams,
  GroupOutlinePreview,
} from "@/types/custom-tray";
import { STEPPED_LAYOUT_DEFAULTS } from "@/lib/stepped-config";
import {
  useEditableParams,
  type EditTransactionOutcome,
} from "@/hooks/useEditableParams";
import { trayWorkerService } from "@/lib/worker/worker-service";
import type * as THREE from "three";
import type { SymmetryInsertSlot } from "@/lib/layout-symmetry";
import type { EllipseSlotInstanceConfig } from "@/lib/slot-instance-factory";
import { useSteppedOutlinePreview } from "@/hooks/useSteppedOutlinePreview";
import { buildSteppedBridgeWarning } from "@/lib/stepped-bridge-warning";
import type { BridgeWarning } from "@/lib/stepped-connectivity";
import { applySteppedBaseHoleDerivedFields } from "@/lib/stepped-base-hole";
import {
  applySteppedEditIntent,
  type SteppedContinuousEditIntent,
  type SteppedEditIntent,
  type SteppedSlotUpdate,
} from "@/lib/stepped-edit-intent";
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
import type { SteppedPreviewResult } from "@/lib/stepped-model-service";
import {
  captureModeParamSnapshot,
  createModelGeometryFingerprint,
  type ModeParamSnapshot,
} from "@/lib/mode-param-snapshot";
import {
  getBaseHoleFitBlockingReason,
  validateBaseHoleFit,
  type BaseHoleFitViolation,
} from "@/lib/base-hole-rules";
import { useSteppedContouredFootprint } from "@/hooks/useSteppedContouredFootprint";
import type { ContouredFootprintState } from "@/lib/contoured-footprint-state";
import type { ConstructedSteppedContouredFootprints } from "@/lib/stepped-contoured-footprint";

export interface UseSteppedLayoutControllerReturn {
  params: SteppedLayoutParams;
  persistedParams: SteppedLayoutParams;
  transactionRevision: number;
  edit: (intent: SteppedEditIntent) => SteppedEditResult;
  previewEdit: (intent: SteppedContinuousEditIntent) => EditTransactionOutcome;
  setParams: React.Dispatch<React.SetStateAction<SteppedLayoutParams>>;
  updateParam: <K extends keyof SteppedLayoutParams>(
    key: K,
    value: SteppedLayoutParams[K],
  ) => void;
  previewParam: <K extends keyof SteppedLayoutParams>(
    key: K,
    value: SteppedLayoutParams[K],
  ) => void;
  addSlot: (
    width: number,
    height?: number,
    ellipseConfig?: EllipseSlotInstanceConfig,
    targetGroupId?: string,
  ) => void;
  removeSlot: (id: string) => void;
  removeSlots: (ids: string[]) => void;
  updateSlotPosition: (id: string, x: number, y: number) => void;
  updateMultipleSlots: (
    updates: { id: string; x: number; y: number; rotation?: number }[],
  ) => void;
  updateMultipleSlotsLive: (
    updates: { id: string; x: number; y: number; rotation?: number }[],
  ) => void;
  updateSlotRotation: (id: string, rotation: number) => void;
  insertSlots: (slots: SymmetryInsertSlot[], targetGroupId?: string) => void;
  duplicateSlots: (ids: string[]) => string[];
  trimBaseplate: () => void;
  addGroup: () => string | null;
  removeGroup: (groupId: string) => void;
  updateGroupHeight: (groupId: string, height: number) => void;
  updateGroupSmoothingOverride: (groupId: string, enabled: boolean) => void;
  updateGroupSmoothingRadius: (groupId: string, radius: number) => void;
  updateGroupDisconnectOverride: (groupId: string, enabled: boolean) => void;
  updateGroupDisconnectDistance: (groupId: string, distance: number) => void;
  previewGroupHeight: (groupId: string, height: number) => void;
  previewGroupSmoothingRadius: (groupId: string, radius: number) => void;
  previewGroupDisconnectDistance: (groupId: string, distance: number) => void;
  moveSelectedSlotsToGroup: (ids: string[], targetGroupId: string) => void;
  reorderGroups: (fromIndex: number, toIndex: number) => void;
  effectiveDimensions: SteppedLayoutExtents;
  beginContinuousEdit: () => boolean;
  commitContinuousEdit: () => void;
  cancelContinuousEdit: () => void;
  undo: () => void;
  canUndo: boolean;
  threeGeometry: THREE.BufferGeometry | null;
  volume: number;
  isGenerating: boolean;
  isPreviewStale: boolean;
  baseHoleFitViolations: BaseHoleFitViolation[];
  baseHoleFitBlockingReason: string | null;
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
  outlinePreview: GroupOutlinePreview[] | null;
  contouredFootprintState: ContouredFootprintState<ConstructedSteppedContouredFootprints>;
  workingContouredFootprintState: ContouredFootprintState<ConstructedSteppedContouredFootprints>;
  setContouredWorkingPreviewEnabled: (enabled: boolean) => void;
}

export interface SteppedEditResult {
  outcome: EditTransactionOutcome;
  createdIds: string[];
}

interface UseSteppedLayoutControllerOptions<
  M extends "stepped",
  TWorkerPort extends STLExportWorkerPort & SteppedOutlinePreviewPort,
> {
  mode: M;
  generatePreview: (
    params: SteppedLayoutParams,
    workerPort: TWorkerPort,
  ) => Promise<SteppedPreviewResult>;
  exportModel: (
    snapshot: ModeParamSnapshot<M>,
    geometry: Geom3,
    workerPort: TWorkerPort,
    downloadPort: DownloadPort,
    effectiveDimensions: SteppedLayoutExtents,
  ) => Promise<void>;
}

export function useSteppedLayoutController<
  M extends "stepped",
  TWorkerPort extends STLExportWorkerPort & SteppedOutlinePreviewPort,
>({
  mode,
  generatePreview: generatePreviewForMode,
  exportModel,
}: UseSteppedLayoutControllerOptions<M, TWorkerPort>): UseSteppedLayoutControllerReturn {
  const [optimizationProposals, setOptimizationProposals] = useState<
    SteppedOptimizationProposal[]
  >([]);
  const [isOptimizingLayout, setIsOptimizingLayout] = useState(false);
  const [
    contouredWorkingPreviewEnabled,
    setContouredWorkingPreviewEnabled,
  ] = useState(false);
  const contouredFootprintStateRef = useRef<
    ContouredFootprintState<ConstructedSteppedContouredFootprints>
  >({ status: "inactive" });

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
    (nextParams: SteppedLayoutParams) => {
      const normalized = applySteppedBaseHoleDerivedFields(nextParams);
      const persisted = { ...normalized };
      delete persisted.activeGroupId;
      return persisted as SteppedLayoutParams;
    },
    [],
  );

  useEffect(
    () => () => {
      cancelPendingOptimization();
    },
    [cancelPendingOptimization],
  );

  const {
    params: persistedParams,
    viewParams: params,
    workingParams,
    paramsRef,
    replaceParams: setParams,
    applyChange,
    beginContinuousEdit: beginContinuousEditTransaction,
    previewContinuousEdit,
    commitContinuousEdit: commitContinuousEditTransaction,
    cancelContinuousEdit: cancelContinuousEditTransaction,
    hasActiveContinuousEdit,
    transactionRevision,
    sessionEpoch,
    undo,
    canUndo,
    threeGeometry,
    volume,
    isGenerating,
    isPreviewStale,
    handleGenerate: generatePreview,
    handleExportSTL: exportSTL,
  } = useEditableParams<
    SteppedLayoutParams,
    ModeParamSnapshot<M>
  >({
    initialState: () => normalizeParams(STEPPED_LAYOUT_DEFAULTS),
    captureSnapshot: (currentParams) =>
      captureModeParamSnapshot(mode, currentParams),
    fingerprintSnapshot: createModelGeometryFingerprint,
    generatePreview: async (snapshot) => {
      const workerPort = trayWorkerService as unknown as TWorkerPort | null;
      if (!workerPort) {
        return null;
      }
      return generatePreviewForMode(snapshot.params, workerPort);
    },
    exportModel: async (snapshot, geometry) => {
      const workerPort = trayWorkerService as unknown as TWorkerPort | null;
      if (!workerPort) {
        return;
      }
      await exportModel(
        snapshot,
        geometry,
        workerPort,
        browserDownloadPort,
        calculateSteppedEffectiveDimensions(
          snapshot.params,
          contouredFootprintStateRef.current,
        ),
      );
    },
    validateSnapshot: () => null,
    onInvalidate: () => {
      optimizationVariantRef.current = 0;
      clearOptimizationProposals();
    },
    normalize: normalizeParams,
    areEqual: (left, right) => JSON.stringify(left) === JSON.stringify(right),
  });

  const contouredFootprints = useSteppedContouredFootprint({
    persistedParams,
    workingParams,
    sessionEpoch,
    workingEnabled: contouredWorkingPreviewEnabled,
  });
  const contouredFootprintState = contouredFootprints.committed;
  useEffect(() => {
    contouredFootprintStateRef.current = contouredFootprintState;
  }, [contouredFootprintState]);
  const workingContouredFootprintState = contouredFootprints.working;

  const baseHoleFitViolations = useMemo(
    () => validateBaseHoleFit(mode, persistedParams, {
      steppedContouredState: contouredFootprintState,
    }),
    [contouredFootprintState, mode, persistedParams],
  );
  const baseHoleFitBlockingReason =
    (contouredFootprintState.status === "failed"
      ? contouredFootprintState.error.message
      : null) ??
    getBaseHoleFitBlockingReason(baseHoleFitViolations);

  const handleGenerate = useCallback(() => {
    if (baseHoleFitBlockingReason) return Promise.resolve();
    return generatePreview();
  }, [baseHoleFitBlockingReason, generatePreview]);

  const handleExportSTL = useCallback(() => {
    if (baseHoleFitBlockingReason) return Promise.resolve();
    return exportSTL();
  }, [baseHoleFitBlockingReason, exportSTL]);

  const effectiveDimensions = useMemo(
    () => calculateSteppedEffectiveDimensions(
      params,
      workingContouredFootprintState.status !== "inactive"
        ? workingContouredFootprintState
        : contouredFootprintState,
    ),
    [contouredFootprintState, params, workingContouredFootprintState],
  );

  const edit = useCallback((intent: SteppedEditIntent): SteppedEditResult => {
    let createdIds: string[] = [];
    const outcome = applyChange((previous) => {
      const application = applySteppedEditIntent(
        previous,
        intent,
        randomIdFactory,
      );
      createdIds = application.createdIds;
      return application.params;
    });
    return { outcome, createdIds };
  }, [applyChange]);

  const previewEdit = useCallback((intent: SteppedContinuousEditIntent) => (
    previewContinuousEdit((working) =>
      applySteppedEditIntent(working, intent, randomIdFactory).params
    )
  ), [previewContinuousEdit]);

  const updateParam = useCallback(
    <K extends keyof SteppedLayoutParams>(
      key: K,
      value: SteppedLayoutParams[K],
    ) => {
      edit({ type: "param.update", key, value } as SteppedEditIntent);
    },
    [edit],
  );
  const previewParam = useCallback(
    <K extends keyof SteppedLayoutParams>(
      key: K,
      value: SteppedLayoutParams[K],
    ) => {
      previewEdit({ type: "param.update", key, value } as SteppedContinuousEditIntent);
    },
    [previewEdit],
  );

  const addSlot = useCallback(
    (
      width: number,
      height?: number,
      ellipseConfig?: EllipseSlotInstanceConfig,
      targetGroupId?: string,
    ) => {
      edit({ type: "slot.add", width, height, ellipseConfig, targetGroupId });
    },
    [edit],
  );

  const removeSlot = useCallback(
    (id: string) => {
      edit({ type: "slot.remove", id });
    },
    [edit],
  );
  const removeSlots = useCallback((ids: string[]) => {
    edit({ type: "slots.remove", ids });
  }, [edit]);

  const updateSlotPosition = useCallback(
    (id: string, x: number, y: number) => {
      edit({ type: "slot.position", id, x, y });
    },
    [edit],
  );

  const {
    outlinePreview,
    pauseOutlinePreview,
    resumeOutlinePreview,
  } = useSteppedOutlinePreview(
    params,
    workingContouredFootprintState.status !== "inactive"
      ? workingContouredFootprintState
      : contouredFootprintState,
    sessionEpoch,
  );

  const updateMultipleSlots = useCallback(
    (updates: SteppedSlotUpdate[]) => {
      edit({ type: "slots.update", updates });
    },
    [edit],
  );

  const updateMultipleSlotsLive = useCallback(
    (updates: SteppedSlotUpdate[]) => {
      if (!hasActiveContinuousEdit()) {
        beginContinuousEditTransaction();
      }
      previewEdit({ type: "slots.update", updates });
    },
    [beginContinuousEditTransaction, hasActiveContinuousEdit, previewEdit],
  );

  const updateSlotRotation = useCallback(
    (id: string, rotation: number) => {
      edit({ type: "slot.rotation", id, rotation });
    },
    [edit],
  );

  const insertSlots = useCallback(
    (slotsToInsert: SymmetryInsertSlot[], targetGroupId?: string) => {
      if (slotsToInsert.length === 0) return;

      edit({ type: "slots.insert", slots: slotsToInsert, targetGroupId });
    },
    [edit],
  );

  const duplicateSlots = useCallback(
    (ids: string[]): string[] => {
      return edit({ type: "slots.duplicate", ids }).createdIds;
    },
    [edit],
  );

  const addGroup = useCallback(() => {
    return edit({ type: "group.add" }).createdIds[0] ?? null;
  }, [edit]);

  const removeGroup = useCallback(
    (groupId: string) => {
      edit({ type: "group.remove", groupId });
    },
    [edit],
  );

  const updateGroupHeight = useCallback(
    (groupId: string, height: number) => {
      edit({ type: "group.height", groupId, height });
    },
    [edit],
  );

  const updateGroupSmoothingOverride = useCallback(
    (groupId: string, enabled: boolean) => {
      edit({ type: "group.smoothing-override", groupId, enabled });
    },
    [edit],
  );

  const updateGroupSmoothingRadius = useCallback(
    (groupId: string, radius: number) => {
      edit({ type: "group.smoothing-radius", groupId, radius });
    },
    [edit],
  );

  const updateGroupDisconnectOverride = useCallback(
    (groupId: string, enabled: boolean) => {
      edit({ type: "group.disconnect-override", groupId, enabled });
    },
    [edit],
  );

  const updateGroupDisconnectDistance = useCallback(
    (groupId: string, distance: number) => {
      edit({ type: "group.disconnect-distance", groupId, distance });
    },
    [edit],
  );
  const previewGroupHeight = useCallback(
    (groupId: string, height: number) => {
      previewEdit({ type: "group.height", groupId, height });
    },
    [previewEdit],
  );
  const previewGroupSmoothingRadius = useCallback(
    (groupId: string, radius: number) => {
      previewEdit({ type: "group.smoothing-radius", groupId, radius });
    },
    [previewEdit],
  );
  const previewGroupDisconnectDistance = useCallback(
    (groupId: string, distance: number) => {
      previewEdit({ type: "group.disconnect-distance", groupId, distance });
    },
    [previewEdit],
  );

  const moveSelectedSlotsToGroup = useCallback(
    (ids: string[], targetGroupId: string) => {
      edit({ type: "slots.move-to-group", ids, targetGroupId });
    },
    [edit],
  );

  const reorderGroups = useCallback(
    (fromIndex: number, toIndex: number) => {
      edit({ type: "group.reorder", fromIndex, toIndex });
    },
    [edit],
  );

  const trimBaseplate = useCallback(() => {
    edit({ type: "baseplate.trim", effectiveDimensions });
  }, [edit, effectiveDimensions]);

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
  }, [cancelPendingOptimization, paramsRef]);

  const applyOptimizationProposal = useCallback(
    (proposalId: SteppedOptimizationProposal["id"]) => {
      const proposal = optimizationProposalsRef.current.find(
        (entry) => entry.id === proposalId,
      );
      if (!proposal) {
        return;
      }

      edit({ type: "params.replace", params: proposal.params });
    },
    [edit],
  );

  const beginContinuousEdit = useCallback(() => {
    return beginContinuousEditTransaction().status === "previewing";
  }, [beginContinuousEditTransaction]);
  const commitContinuousEdit = useCallback(() => {
    commitContinuousEditTransaction();
  }, [commitContinuousEditTransaction]);
  const cancelContinuousEdit = useCallback(() => {
    cancelContinuousEditTransaction();
  }, [cancelContinuousEditTransaction]);

  return {
    params,
    persistedParams,
    transactionRevision,
    edit,
    previewEdit,
    setParams,
    updateParam,
    previewParam,
    addSlot,
    removeSlot,
    removeSlots,
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
    previewGroupHeight,
    previewGroupSmoothingRadius,
    previewGroupDisconnectDistance,
    moveSelectedSlotsToGroup,
    reorderGroups,
    effectiveDimensions,
    beginContinuousEdit,
    commitContinuousEdit,
    cancelContinuousEdit,
    undo,
    canUndo,
    threeGeometry,
    volume,
    isGenerating,
    isPreviewStale,
    baseHoleFitViolations,
    baseHoleFitBlockingReason,
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
    contouredFootprintState,
    workingContouredFootprintState,
    setContouredWorkingPreviewEnabled,
  };
}
