"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type * as THREE from "three";
import { useEditableParams } from "@/hooks/useEditableParams";
import { useRequestSequence } from "@/hooks/useRequestSequence";
import { useToast } from "@/hooks/useToast";
import { browserDownloadPort } from "@/lib/download-port";
import { randomIdFactory } from "@/lib/id-factory";
import type { IdFactory } from "@/lib/model-ports";
import {
  captureModeParamSnapshot,
  type ModeParamSnapshot,
} from "@/lib/mode-param-snapshot";
import type {
  DownloadPort,
  StorageSteppedPartResult,
  StorageSteppedWorkerPort,
} from "@/lib/model-ports";
import { createFreeSlotInstance } from "@/lib/slot-instance-factory";
import type { EllipseSlotInstanceConfig } from "@/lib/slot-instance-factory";
import { loadThreeGeometry } from "@/lib/three-geometry-loader";
import {
  STORAGE_STEPPED_BODY_PART_ID,
  createDefaultStorageSteppedParams,
  copyStorageSteppedTrayConfig,
  createStorageSteppedTrayConfig,
  getStorageSteppedTray,
  storageSteppedPartLabel,
  storageSteppedTrayPartId,
  withStorageSteppedHeightSpec,
} from "@/lib/storage-stepped-config";
import {
  addStorageSteppedTraySlot,
  applyStorageSteppedTraySlotUpdates,
  duplicateStorageSteppedTraySlots,
  insertStorageSteppedTraySlots,
  removeStorageSteppedTraySlots,
  updateStorageSteppedTrayBaseHole,
  updateStorageSteppedTrayHoleDepth,
  updateStorageSteppedTraySlotRotation,
  type StorageTrayBaseHolePatch,
  type StorageTraySlotUpdate,
} from "@/lib/storage-stepped-layout";
import {
  exportStorageSteppedAllParts,
  exportStorageSteppedPart,
} from "@/lib/storage-stepped-model-service";
import {
  applyStorageSteppedLayoutImport,
  prepareStorageSteppedLayoutImport,
  type StorageSteppedLayoutImportReport,
} from "@/lib/storage-stepped-layout-import";
import { applyStorageSteppedTrayPreset } from "@/lib/storage-stepped-presets";
import {
  deriveStorageSteppedPlan,
  getStorageSteppedBlockingReason,
  getStorageSteppedExpectedPartIds,
  getStorageSteppedPartBlockingReason,
  getStorageSteppedPartFingerprint,
  getStorageSteppedTrayAssemblyOffset,
  validateStorageSteppedParams,
  type StorageSteppedPlan,
  type StorageSteppedValidation,
} from "@/lib/storage-stepped-plan";
import type {
  StorageSteppedHeightSpecId,
  StorageSteppedInterfaceParams,
  StorageSteppedParams,
  StorageSteppedTrayConfig,
} from "@/types/storage-stepped";
import type { SymmetryInsertSlot } from "@/lib/layout-symmetry";
import { VIEW_PALETTE } from "@/lib/config";
import type { CanvasSlotUpdate } from "@/lib/canvas-types";

interface CachedPart extends StorageSteppedPartResult {
  fingerprint: string;
  threeGeometry: THREE.BufferGeometry;
}

export interface StorageSteppedViewPart {
  partId: string;
  label: string;
  kind: "body" | "tray";
  stepIndex: number | null;
  threeGeometry: THREE.BufferGeometry;
  assemblyOffset: [number, number, number];
  volume: number;
  stale: boolean;
  blockingReason: string | null;
  color: string;
}

export interface UseStorageSteppedOptions {
  workerPort?: StorageSteppedWorkerPort | null;
  downloadPort?: DownloadPort;
  /** 测试或宿主可注入确定性的槽位标识；生产默认 randomUUID。 */
  idFactory?: IdFactory;
}

export interface UseStorageSteppedReturn {
  params: StorageSteppedParams;
  persistedParams: StorageSteppedParams;
  transactionRevision: number;
  currentStepIndex: number;
  currentTray: StorageSteppedTrayConfig;
  setCurrentStepIndex: (stepIndex: number) => void;
  plan: StorageSteppedPlan;
  validation: StorageSteppedValidation;
  blockingReason: string | null;
  getPartBlockingReason: (partId: string) => string | null;
  parts: StorageSteppedViewPart[];
  missingPartLabels: string[];
  isGenerating: boolean;
  isExporting: boolean;
  isPreviewStale: boolean;
  volume: number;
  workerErrors: Record<string, string>;
  handleGenerate: () => Promise<void>;
  handleExportPart: (partId: string) => Promise<void>;
  handleExportBody: () => Promise<void>;
  handleExportCurrentTray: () => Promise<void>;
  handleExportAll: () => Promise<void>;
  setHeightSpec: (heightSpecId: StorageSteppedHeightSpecId) => void;
  updateInterface: <K extends keyof StorageSteppedInterfaceParams>(
    key: K,
    value: StorageSteppedInterfaceParams[K],
  ) => void;
  updateSlotSpacing: (value: number) => void;
  updateSlotBoundarySpacing: (value: number) => void;
  applyPreset: (presetId: string) => void;
  copyTrayFromStep: (fromStepIndex: number) => void;
  copyTrayToStep: (toStepIndex: number) => void;
  addSlot: (
    width: number,
    height?: number,
    ellipseConfig?: EllipseSlotInstanceConfig,
  ) => void;
  removeSlot: (id: string) => void;
  removeSlots: (ids: string[]) => void;
  updateSlotPosition: (id: string, x: number, y: number) => void;
  updateSlotRotation: (id: string, rotation: number) => void;
  updateMultipleSlots: (updates: StorageTraySlotUpdate[]) => void;
  updateMultipleSlotsLive: (updates: StorageTraySlotUpdate[]) => void;
  insertSlots: (slots: SymmetryInsertSlot[]) => void;
  duplicateSlots: (ids: string[]) => string[];
  undo: () => void;
  canUndo: boolean;
  redo: () => void;
  canRedo: boolean;
  beginContinuousEdit: () => boolean;
  commitContinuousEdit: () => void;
  cancelContinuousEdit: () => void;
  setHoleDepth: (value: number) => void;
  updateBaseHole: (patch: StorageTrayBaseHolePatch) => void;
  prepareLayoutImport: (data: unknown) => StorageSteppedLayoutImportReport;
  applyLayoutImport: (report: StorageSteppedLayoutImportReport) => void;
  liftedStepIndex: number | null;
  setLiftedStepIndex: (stepIndex: number | null) => void;
  viewMode: "assembly" | "single";
  setViewMode: (mode: "assembly" | "single") => void;
  selectedPartId: string;
  setSelectedPartId: (partId: string) => void;
  setParams: React.Dispatch<React.SetStateAction<StorageSteppedParams>>;
}

function partColor(partId: string): string {
  if (partId === STORAGE_STEPPED_BODY_PART_ID) return VIEW_PALETTE[0];
  const stepIndex = Number(/^tray-(\d+)$/.exec(partId)?.[1]) - 1;
  return VIEW_PALETTE[(stepIndex + 1) % VIEW_PALETTE.length];
}

function stepIndexOfPart(partId: string): number | null {
  const match = /^tray-(\d+)$/.exec(partId);
  return match ? Number(match[1]) - 1 : null;
}

/**
 * 阶梯收纳展示台编辑控制器。
 *
 * 参数、撤销与连续编辑事务复用 useEditableParams；主体与三块托盘按各自几何指纹
 * 独立缓存，切换高度只重建主体，修改某阶槽位只重建该托盘。
 */
export function useStorageStepped(
  options: UseStorageSteppedOptions = {},
): UseStorageSteppedReturn {
  const { toast } = useToast();
  const workerPort = options.workerPort ?? null;
  const downloadPort = options.downloadPort ?? browserDownloadPort;
  const idFactory = options.idFactory ?? randomIdFactory;

  const editable = useEditableParams<
    StorageSteppedParams,
    ModeParamSnapshot<"storage-stepped">,
    null
  >({
    initialState: () => createDefaultStorageSteppedParams(),
    captureSnapshot: (current) =>
      captureModeParamSnapshot("storage-stepped", current),
    captureExportContext: () => null,
    fingerprintSnapshot: (snapshot) => snapshot.mode,
    generatePreview: async () => null,
    exportModel: async () => {},
    normalize: (value) => value,
    areEqual: (left, right) => JSON.stringify(left) === JSON.stringify(right),
  });

  const { nextSeq, isStale } = useRequestSequence();
  const [partsById, setPartsById] = useState<Record<string, CachedPart>>({});
  const [workerErrors, setWorkerErrors] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [currentStepIndex, setCurrentStepIndexState] = useState(0);
  const latestRequestSeqRef = useRef(0);
  const [liftedStepIndex, setLiftedStepIndex] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"assembly" | "single">("assembly");
  const [selectedPartId, setSelectedPartId] = useState<string>(
    STORAGE_STEPPED_BODY_PART_ID,
  );
  const partsRef = useRef(partsById);
  useEffect(() => {
    partsRef.current = partsById;
  }, [partsById]);

  useEffect(() => {
    // 参数提交或 Session 替换后，让在途 Worker 结果失效，避免旧结果覆盖新参数。
    // loading 状态由请求自身在发现过期后清理，不在 effect 内同步 setState。
    nextSeq();
  }, [editable.transactionRevision, editable.sessionEpoch, nextSeq]);

  useEffect(
    () => () => {
      for (const part of Object.values(partsRef.current)) {
        part.threeGeometry.dispose();
      }
      partsRef.current = {};
      latestRequestSeqRef.current = 0;
      nextSeq();
    },
    [nextSeq],
  );

  const params = editable.viewParams;
  const persistedParams = editable.params;
  const plan = useMemo(() => deriveStorageSteppedPlan(params), [params]);
  const persistedPlan = useMemo(
    () => params === persistedParams ? plan : deriveStorageSteppedPlan(persistedParams),
    [params, persistedParams, plan],
  );
  const validation = useMemo(
    () => validateStorageSteppedParams(params),
    [params],
  );
  const persistedValidation = useMemo(
    () => validateStorageSteppedParams(persistedParams),
    [persistedParams],
  );
  const blockingReason = getStorageSteppedBlockingReason(validation);

  const getPartBlockingReason = useCallback(
    (partId: string) =>
      getStorageSteppedPartBlockingReason(persistedValidation, partId),
    [persistedValidation],
  );

  const currentStepRef = useRef(currentStepIndex);
  useEffect(() => {
    currentStepRef.current = currentStepIndex;
  }, [currentStepIndex]);

  const currentTray = useMemo(
    () =>
      getStorageSteppedTray(params, currentStepIndex) ??
      params.trays[0] ??
      createStorageSteppedTrayConfig(currentStepIndex),
    [currentStepIndex, params],
  );

  const setCurrentStepIndex = useCallback((stepIndex: number) => {
    // 切换阶会更换画布内容；先结束当前连续编辑事务，避免手势跨阶提交。
    editable.cancelContinuousEdit();
    const next = Math.max(0, Math.min(2, stepIndex));
    // 同步更新 ref，保证同一事件中紧随其后的编辑作用于新选的阶。
    currentStepRef.current = next;
    setCurrentStepIndexState(next);
  }, [editable]);

  /** 离散编辑：一次手势/一次点击对应一条撤销记录。 */
  const editTray = useCallback(
    (mutate: (current: StorageSteppedParams, stepIndex: number) => StorageSteppedParams) => {
      editable.applyChange((previous) =>
        mutate(previous, currentStepRef.current),
      );
    },
    [editable],
  );

  const setHeightSpec = useCallback((heightSpecId: StorageSteppedHeightSpecId) => {
    editable.applyChange((previous) =>
      withStorageSteppedHeightSpec(previous, heightSpecId),
    );
  }, [editable]);

  const updateInterface = useCallback(
    <K extends keyof StorageSteppedInterfaceParams>(
      key: K,
      value: StorageSteppedInterfaceParams[K],
    ) => {
      editable.applyChange((previous) => ({
        ...previous,
        interface: { ...previous.interface, [key]: value },
      }));
    },
    [editable],
  );

  const updateSlotSpacing = useCallback(
    (value: number) => {
      editable.applyChange((previous) => ({ ...previous, slotSpacing: value }));
    },
    [editable],
  );
  const updateSlotBoundarySpacing = useCallback(
    (value: number) => {
      editable.applyChange((previous) => ({
        ...previous,
        slotBoundarySpacing: value,
      }));
    },
    [editable],
  );

  const applyPreset = useCallback(
    (presetId: string) => {
      editTray((previous, stepIndex) =>
        applyStorageSteppedTrayPreset(
          previous,
          stepIndex,
          presetId,
          idFactory,
        ),
      );
    },
    [editTray, idFactory],
  );

  const copyTrayFromStep = useCallback(
    (fromStepIndex: number) => {
      editTray((previous, stepIndex) =>
        copyStorageSteppedTrayConfig(
          previous,
          fromStepIndex,
          stepIndex,
          idFactory,
        ),
      );
    },
    [editTray, idFactory],
  );

  const copyTrayToStep = useCallback(
    (toStepIndex: number) => {
      editable.applyChange((previous) =>
        copyStorageSteppedTrayConfig(
          previous,
          currentStepRef.current,
          toStepIndex,
          idFactory,
        ),
      );
    },
    [editable, idFactory],
  );

  const addSlot = useCallback(
    (
      width: number,
      height?: number,
      ellipseConfig?: EllipseSlotInstanceConfig,
    ) => {
      const slot = createFreeSlotInstance({
        id: idFactory.createId(),
        x: plan.trayWidth / 2,
        y: plan.trayDepth / 2,
        width,
        height,
        rotation: 0,
        ellipseConfig,
      });
      editTray((previous, stepIndex) =>
        addStorageSteppedTraySlot(previous, stepIndex, slot),
      );
    },
    [editTray, idFactory, plan.trayDepth, plan.trayWidth],
  );

  const removeSlot = useCallback(
    (id: string) => {
      editTray((previous, stepIndex) =>
        removeStorageSteppedTraySlots(previous, stepIndex, [id]),
      );
    },
    [editTray],
  );

  const removeSlots = useCallback(
    (ids: string[]) => {
      editTray((previous, stepIndex) =>
        removeStorageSteppedTraySlots(previous, stepIndex, ids),
      );
    },
    [editTray],
  );

  const updateSlotPosition = useCallback(
    (id: string, x: number, y: number) => {
      editTray((previous, stepIndex) =>
        applyStorageSteppedTraySlotUpdates(previous, stepIndex, [
          { id, x, y },
        ]),
      );
    },
    [editTray],
  );

  const updateSlotRotation = useCallback(
    (id: string, rotation: number) => {
      editTray((previous, stepIndex) =>
        updateStorageSteppedTraySlotRotation(previous, stepIndex, id, rotation),
      );
    },
    [editTray],
  );

  const updateMultipleSlots = useCallback(
    (updates: StorageTraySlotUpdate[]) => {
      editTray((previous, stepIndex) =>
        applyStorageSteppedTraySlotUpdates(previous, stepIndex, updates),
      );
    },
    [editTray],
  );

  const updateMultipleSlotsLive = useCallback(
    (updates: StorageTraySlotUpdate[]) => {
      if (!editable.hasActiveContinuousEdit()) {
        editable.beginContinuousEdit();
      }
      const stepIndex = currentStepRef.current;
      editable.previewContinuousEdit((working) =>
        applyStorageSteppedTraySlotUpdates(
          working,
          stepIndex,
          updates as CanvasSlotUpdate[],
        ),
      );
    },
    [editable],
  );

  const insertSlots = useCallback(
    (slotsToInsert: SymmetryInsertSlot[]) => {
      if (slotsToInsert.length === 0) return;
      editTray((previous, stepIndex) =>
        insertStorageSteppedTraySlots(
          previous,
          stepIndex,
          slotsToInsert,
          idFactory,
        ),
      );
    },
    [editTray, idFactory],
  );

  const duplicateSlots = useCallback(
    (ids: string[]): string[] => {
      let newIds: string[] = [];
      editTray((previous, stepIndex) => {
        const result = duplicateStorageSteppedTraySlots(
          previous,
          stepIndex,
          ids,
          idFactory,
        );
        newIds = result.newIds;
        return result.params;
      });
      return newIds;
    },
    [editTray, idFactory],
  );

  const setHoleDepth = useCallback(
    (value: number) => {
      editTray((previous, stepIndex) =>
        updateStorageSteppedTrayHoleDepth(previous, stepIndex, value),
      );
    },
    [editTray],
  );

  const updateBaseHole = useCallback(
    (patch: StorageTrayBaseHolePatch) => {
      editTray((previous, stepIndex) =>
        updateStorageSteppedTrayBaseHole(previous, stepIndex, patch),
      );
    },
    [editTray],
  );

  const beginContinuousEdit = useCallback(
    () => editable.beginContinuousEdit().status !== "rejected",
    [editable],
  );
  const commitContinuousEdit = useCallback(() => {
    editable.commitContinuousEdit();
  }, [editable]);
  const cancelContinuousEdit = useCallback(() => {
    editable.cancelContinuousEdit();
  }, [editable]);
  const undo = useCallback(() => {
    editable.undo();
  }, [editable]);

  const prepareLayoutImport = useCallback(
    (data: unknown): StorageSteppedLayoutImportReport =>
      prepareStorageSteppedLayoutImport(data, {
        params: editable.getParams(),
        stepIndex: currentStepRef.current,
        idFactory,
      }),
    [editable, idFactory],
  );

  const applyLayoutImport = useCallback(
    (report: StorageSteppedLayoutImportReport) => {
      editTray((previous, stepIndex) =>
        applyStorageSteppedLayoutImport(previous, stepIndex, report),
      );
    },
    [editTray],
  );

  const expectedPartIds = useMemo(
    () => getStorageSteppedExpectedPartIds(persistedParams),
    [persistedParams],
  );

  const stalePartIds = useMemo(
    () =>
      expectedPartIds.filter((partId) => {
        const cached = partsById[partId];
        return (
          !cached ||
          cached.fingerprint !==
            getStorageSteppedPartFingerprint(persistedParams, partId)
        );
      }),
    [expectedPartIds, partsById, persistedParams],
  );
  const isPreviewStale = stalePartIds.length > 0;

  const parts = useMemo<StorageSteppedViewPart[]>(
    () =>
      expectedPartIds.flatMap((partId) => {
        const cached = partsById[partId];
        if (!cached) return [];
        const stepIndex = stepIndexOfPart(partId);
        return [{
          partId,
          label: storageSteppedPartLabel(partId),
          kind: stepIndex === null ? "body" : "tray",
          stepIndex,
          threeGeometry: cached.threeGeometry,
          assemblyOffset: stepIndex === null
            ? [0, 0, 0]
            : getStorageSteppedTrayAssemblyOffset(persistedPlan, stepIndex),
          volume: cached.volume,
          stale: stalePartIds.includes(partId),
          blockingReason: getStorageSteppedPartBlockingReason(
            persistedValidation,
            partId,
          ),
          color: partColor(partId),
        }];
      }),
    [expectedPartIds, partsById, persistedPlan, persistedValidation, stalePartIds],
  );

  const missingPartLabels = useMemo(
    () =>
      expectedPartIds
        .filter((partId) => !partsById[partId])
        .map((partId) => storageSteppedPartLabel(partId)),
    [expectedPartIds, partsById],
  );

  const volume = useMemo(
    () => parts.reduce((total, part) => total + part.volume, 0),
    [parts],
  );

  const handleGenerate = useCallback(async () => {
    if (!workerPort) {
      toast("error", "后台建模 Worker 当前不可用");
      return;
    }
    const snapshot = captureModeParamSnapshot(
      "storage-stepped",
      editable.getParams(),
    );
    const snapshotValidation = validateStorageSteppedParams(snapshot.params);
    const partIds = getStorageSteppedExpectedPartIds(snapshot.params);
    const targets = partIds.filter((partId) => {
      if (getStorageSteppedPartBlockingReason(snapshotValidation, partId)) {
        return false;
      }
      const cached = partsRef.current[partId];
      return (
        !cached ||
        cached.fingerprint !==
          getStorageSteppedPartFingerprint(snapshot.params, partId)
      );
    });

    if (targets.length === 0) {
      const reason = getStorageSteppedBlockingReason(snapshotValidation);
      if (reason) toast("error", `无法生成：${reason}`);
      return;
    }

    const seq = nextSeq();
    latestRequestSeqRef.current = seq;
    setIsGenerating(true);
    try {
      const settled = await Promise.allSettled(
        targets.map(async (partId) =>
          workerPort.generateStorageSteppedPart(snapshot.params, partId),
        ),
      );
      if (isStale(seq)) return;

      const nextParts: Record<string, CachedPart> = {};
      const nextErrors: Record<string, string> = {};
      const superseded: THREE.BufferGeometry[] = [];
      for (let index = 0; index < settled.length; index += 1) {
        const partId = targets[index];
        const result = settled[index];
        if (result.status !== "fulfilled") {
          nextErrors[partId] = result.reason instanceof Error
            ? result.reason.message
            : "未知错误";
          continue;
        }
        try {
          const threeGeometry = await loadThreeGeometry(result.value.geometry);
          nextParts[partId] = {
            ...result.value,
            fingerprint: getStorageSteppedPartFingerprint(
              snapshot.params,
              partId,
            ),
            threeGeometry,
          };
        } catch (error) {
          nextErrors[partId] = error instanceof Error
            ? error.message
            : "三维几何转换失败";
        }
      }
      if (isStale(seq)) {
        for (const part of Object.values(nextParts)) part.threeGeometry.dispose();
        return;
      }
      setPartsById((previous) => {
        const merged = { ...previous };
        for (const [partId, part] of Object.entries(nextParts)) {
          const previousPart = previous[partId];
          if (previousPart) superseded.push(previousPart.threeGeometry);
          merged[partId] = part;
        }
        return merged;
      });
      for (const geometry of superseded) geometry.dispose();
      setWorkerErrors(nextErrors);
      if (Object.keys(nextErrors).length > 0) {
        const first = Object.entries(nextErrors)[0];
        toast(
          "error",
          `${storageSteppedPartLabel(first[0])}生成失败：${first[1]}`,
        );
      }
    } finally {
      // 参数变化可使任一阶段过期，只有请求的所有者可以结束生成状态。
      if (latestRequestSeqRef.current === seq) setIsGenerating(false);
    }
  }, [editable, isStale, nextSeq, toast, workerPort]);

  const runExport = useCallback(
    async (operation: () => Promise<void>) => {
      if (!workerPort) {
        toast("error", "后台建模 Worker 当前不可用");
        return;
      }
      setIsExporting(true);
      try {
        await operation();
        toast("success", "已触发模型文件下载");
      } catch (error) {
        toast(
          "error",
          `导出失败：${error instanceof Error ? error.message : "未知错误"}`,
        );
      } finally {
        setIsExporting(false);
      }
    },
    [toast, workerPort],
  );

  const handleExportPart = useCallback(
    (partId: string) =>
      runExport(async () => {
        if (!workerPort) return;
        const snapshot = captureModeParamSnapshot(
          "storage-stepped",
          editable.getParams(),
        );
        await exportStorageSteppedPart(
          snapshot,
          partId,
          workerPort,
          downloadPort,
        );
      }),
    [downloadPort, editable, runExport, workerPort],
  );

  const handleExportBody = useCallback(
    () => handleExportPart(STORAGE_STEPPED_BODY_PART_ID),
    [handleExportPart],
  );

  const handleExportCurrentTray = useCallback(
    () => handleExportPart(storageSteppedTrayPartId(currentStepIndex)),
    [currentStepIndex, handleExportPart],
  );

  const handleExportAll = useCallback(
    () =>
      runExport(async () => {
        if (!workerPort) return;
        const snapshot = captureModeParamSnapshot(
          "storage-stepped",
          editable.getParams(),
        );
        await exportStorageSteppedAllParts(snapshot, workerPort, downloadPort);
      }),
    [downloadPort, editable, runExport, workerPort],
  );

  return {
    params,
    persistedParams,
    transactionRevision: editable.transactionRevision,
    currentStepIndex,
    currentTray,
    setCurrentStepIndex,
    plan,
    validation,
    blockingReason,
    getPartBlockingReason,
    parts,
    missingPartLabels,
    isGenerating,
    isExporting,
    isPreviewStale,
    volume,
    workerErrors,
    handleGenerate,
    handleExportPart,
    handleExportBody,
    handleExportCurrentTray,
    handleExportAll,
    setHeightSpec,
    updateInterface,
    updateSlotSpacing,
    updateSlotBoundarySpacing,
    applyPreset,
    copyTrayFromStep,
    copyTrayToStep,
    addSlot,
    removeSlot,
    removeSlots,
    updateSlotPosition,
    updateSlotRotation,
    updateMultipleSlots,
    updateMultipleSlotsLive,
    insertSlots,
    duplicateSlots,
    undo,
    canUndo: editable.canUndo,
    redo: editable.redo,
    canRedo: editable.canRedo,
    beginContinuousEdit,
    commitContinuousEdit,
    cancelContinuousEdit,
    setHoleDepth,
    updateBaseHole,
    prepareLayoutImport,
    applyLayoutImport,
    liftedStepIndex,
    setLiftedStepIndex,
    viewMode,
    setViewMode,
    selectedPartId,
    setSelectedPartId,
    setParams: editable.setParams,
  };
}
