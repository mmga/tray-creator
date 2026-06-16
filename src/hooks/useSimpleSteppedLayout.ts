"use client";

import { useCallback, useMemo, useState } from "react";
import type * as THREE from "three";
import type {
  CustomLayoutParams,
  FreeSlot,
  SimpleSteppedLayoutParams,
} from "@/types/custom-tray";
import { browserDownloadPort } from "@/lib/download-port";
import {
  projectSimpleSteppedToFreeSlot,
} from "@/lib/slot-instance-factory";
import { SIMPLE_STEPPED_LAYOUT_DEFAULTS } from "@/lib/simple-stepped-config";
import {
  calculateSimpleSteppedDimensions,
  deriveSimpleSteppedLayout,
  normalizeSimpleSteppedParams,
  type SimpleSteppedDerivedLayout,
} from "@/lib/simple-stepped-projection";
import {
  addSimpleSteppedRow,
  clearSimpleSteppedRow,
  removeSimpleSteppedRow,
  renameSimpleSteppedRow,
  reorderSimpleSteppedRows,
} from "@/lib/simple-stepped-row-actions";
import {
  addSimpleSteppedSlotToRow,
  applySimpleSteppedSlotUpdates,
  duplicateSimpleSteppedSlots,
  removeSimpleSteppedSlot,
  trimSimpleSteppedBaseplate,
} from "@/lib/simple-stepped-slot-actions";
import type { CanvasSlotUpdate } from "@/lib/canvas-types";
import { jscadToThreeGeometry } from "@/lib/jscad-to-three";
import { generateSimpleSteppedSTLFilename } from "@/lib/stl-export";
import { useEditableParams } from "@/hooks/useEditableParams";
import { trayWorkerService } from "@/lib/worker/worker-service";
import { downloadParamFile } from "@/lib/param-io";

export interface UseSimpleSteppedLayoutReturn {
  params: SimpleSteppedLayoutParams;
  setParams: React.Dispatch<React.SetStateAction<SimpleSteppedLayoutParams>>;
  updateParam: <K extends keyof SimpleSteppedLayoutParams>(
    key: K,
    value: SimpleSteppedLayoutParams[K],
  ) => void;
  activeRowId: string | null;
  setActiveRow: (rowId: string | null) => void;
  addRow: () => void;
  removeRow: (rowId: string) => void;
  renameRow: (rowId: string, name: string) => void;
  clearRow: (rowId: string) => void;
  reorderRows: (fromIndex: number, toIndex: number) => void;
  addSlotToRow: (rowId: string, diameter: number) => void;
  removeSlot: (id: string) => void;
  updateSlotPosition: (id: string, x: number, y: number) => void;
  updateMultipleSlots: (updates: CanvasSlotUpdate[]) => void;
  updateMultipleSlotsLive: (updates: CanvasSlotUpdate[]) => void;
  updateSlotRotation: (id: string, rotation: number) => void;
  duplicateSlots: (ids: string[]) => string[];
  derivedLayout: SimpleSteppedDerivedLayout;
  canvasParams: CustomLayoutParams;
  effectiveDimensions: {
    width: number;
    depth: number;
    height: number;
  };
  saveSnapshot: () => void;
  undo: () => void;
  canUndo: boolean;
  resizeTray: (width: number, depth: number) => void;
  trimTray: () => void;
  threeGeometry: THREE.BufferGeometry | null;
  volume: number;
  isGenerating: boolean;
  isPreviewStale: boolean;
  handleGenerate: () => void;
  handleExportSTL: () => void;
}

export function useSimpleSteppedLayout(): UseSimpleSteppedLayoutReturn {
  const [activeRowId, setActiveRowId] = useState<string | null>(null);

  const {
    params,
    paramsRef,
    setParams,
    applyChange,
    saveSnapshot,
    undo,
    canUndo,
    threeGeometry,
    volume,
    isGenerating,
    isPreviewStale,
    handleGenerate,
    handleExportSTL,
  } = useEditableParams<SimpleSteppedLayoutParams>({
    initialState: SIMPLE_STEPPED_LAYOUT_DEFAULTS,
    normalize: normalizeSimpleSteppedParams,
    guard: () => trayWorkerService !== null,
    generatePreview: async (currentParams) => {
      const result = await trayWorkerService!.generateSimpleStepped(currentParams);
      if (!result) {
        return null;
      }
      return {
        geometry: result.geometry,
        threeGeometry: jscadToThreeGeometry(result.geometry),
        volume: result.volume,
      };
    },
    exportModel: async (currentParams, geometry) => {
      const currentDerived = deriveSimpleSteppedLayout(currentParams);
      const filename = generateSimpleSteppedSTLFilename(
        Math.round(currentDerived.trayWidth),
        Math.round(currentDerived.trayDepth),
        currentDerived.activeRows.length,
        currentParams.slots.length,
      );
      const result = await trayWorkerService!.exportSTL(geometry, filename);
      browserDownloadPort.downloadBlob(result.blob, filename);

      const jsonFilename = filename.replace(/\.stl$/i, ".json");
      downloadParamFile("simple-stepped", currentParams, jsonFilename);
    },
  });

  const resolvedActiveRowId = useMemo(() => {
    if (activeRowId && params.rows.some((row) => row.id === activeRowId)) {
      return activeRowId;
    }
    return params.rows[0]?.id ?? null;
  }, [activeRowId, params.rows]);

  const derivedLayout = useMemo(
    () => deriveSimpleSteppedLayout(params, resolvedActiveRowId),
    [params, resolvedActiveRowId],
  );

  const effectiveDimensions = useMemo(
    () => calculateSimpleSteppedDimensions(params),
    [params],
  );

  const canvasParams = useMemo<CustomLayoutParams>(() => {
    const sourceSlotById = new Map(
      params.slots.map((slot) => [slot.id, slot] as const),
    );
    const slots: FreeSlot[] = derivedLayout.activeRows.flatMap((row) =>
      row.slots.map((slot) => {
        const source = sourceSlotById.get(slot.id);
        if (!source) {
          // 派生槽位无对应原始槽位时回退到手搓（理论上不应发生）
          return {
            id: slot.id,
            x: slot.globalX,
            y: slot.globalY,
            shape: "circle" as const,
            width: slot.diameter,
            height: slot.diameter,
            slotWidth: slot.effectiveDiameter,
            slotHeight: slot.effectiveDiameter,
            rotation: 0,
          };
        }
        return projectSimpleSteppedToFreeSlot(slot, source);
      }),
    );

    return {
      trayWidth: derivedLayout.trayWidth,
      trayDepth: derivedLayout.trayDepth,
      slots,
      spacing: params.spacing,
      boundarySpacing: params.outerMarginIndependent
        ? params.outerMargin
        : params.spacing,
      boundarySpacingIndependent: params.outerMarginIndependent,
      baseThickness: params.firstRowHeight,
      holeDepth: params.holeDepth,
      cornerRadius: params.cornerRadius,
      enableBaseHole: false,
      baseHoleSize: "25",
    };
  }, [
    derivedLayout,
    params.cornerRadius,
    params.firstRowHeight,
    params.holeDepth,
    params.outerMarginIndependent,
    params.outerMargin,
    params.spacing,
    params.slots,
  ]);

  const updateParam = useCallback(
    <K extends keyof SimpleSteppedLayoutParams>(
      key: K,
      value: SimpleSteppedLayoutParams[K],
    ) => {
      applyChange((prev) => {
        if (key === "spacing") {
          const nextSpacing = value as SimpleSteppedLayoutParams["spacing"];
          if (!prev.outerMarginIndependent) {
            return {
              ...prev,
              spacing: nextSpacing,
              outerMargin: nextSpacing,
            } as SimpleSteppedLayoutParams;
          }
          return { ...prev, spacing: nextSpacing } as SimpleSteppedLayoutParams;
        }

        if (key === "outerMarginIndependent") {
          const independent =
            value as SimpleSteppedLayoutParams["outerMarginIndependent"];
          if (!independent) {
            return {
              ...prev,
              outerMarginIndependent: false,
              outerMargin: prev.spacing,
            } as SimpleSteppedLayoutParams;
          }
          return {
            ...prev,
            outerMarginIndependent: true,
            outerMargin: prev.outerMargin ?? prev.spacing,
          } as SimpleSteppedLayoutParams;
        }

        return { ...prev, [key]: value } as SimpleSteppedLayoutParams;
      });
    },
    [applyChange],
  );

  const addRow = useCallback(() => {
    const rowId = crypto.randomUUID();
    applyChange((prev) => addSimpleSteppedRow(prev, rowId));
    setActiveRowId(rowId);
  }, [applyChange]);

  const removeRow = useCallback(
    (rowId: string) => {
      applyChange((prev) => removeSimpleSteppedRow(prev, rowId));
    },
    [applyChange],
  );

  const renameRow = useCallback(
    (rowId: string, name: string) => {
      applyChange((prev) => renameSimpleSteppedRow(prev, rowId, name));
    },
    [applyChange],
  );

  const clearRow = useCallback(
    (rowId: string) => {
      applyChange((prev) => clearSimpleSteppedRow(prev, rowId));
    },
    [applyChange],
  );

  const reorderRows = useCallback(
    (fromIndex: number, toIndex: number) => {
      applyChange((prev) => reorderSimpleSteppedRows(prev, fromIndex, toIndex));
    },
    [applyChange],
  );

  const addSlotToRow = useCallback(
    (rowId: string, diameter: number) => {
      applyChange((prev) =>
        addSimpleSteppedSlotToRow(prev, crypto.randomUUID(), rowId, diameter),
      );
    },
    [applyChange],
  );

  const removeSlot = useCallback(
    (id: string) => {
      applyChange((prev) => removeSimpleSteppedSlot(prev, id));
    },
    [applyChange],
  );

  const updateSlotPosition = useCallback(
    (id: string, x: number, y: number) => {
      applyChange(
        (prev) => applySimpleSteppedSlotUpdates(prev, [{ id, x, y }]),
        { history: "live" },
      );
    },
    [applyChange],
  );

  const updateMultipleSlots = useCallback(
    (updates: CanvasSlotUpdate[]) => {
      applyChange((prev) => applySimpleSteppedSlotUpdates(prev, updates));
    },
    [applyChange],
  );

  const updateMultipleSlotsLive = useCallback(
    (updates: CanvasSlotUpdate[]) => {
      applyChange(
        (prev) => applySimpleSteppedSlotUpdates(prev, updates),
        { history: "live" },
      );
    },
    [applyChange],
  );

  const updateSlotRotation = useCallback((id: string, rotation: number) => {
    // 第一版仅支持圆形槽，旋转无意义；保留接口兼容 LayoutCanvas。
    void id;
    void rotation;
  }, []);

  const duplicateSlots = useCallback(
    (ids: string[]) => {
      const targets = paramsRef.current.slots.filter((slot) => ids.includes(slot.id));
      if (targets.length === 0) {
        return [];
      }

      const newIds = targets.map(() => crypto.randomUUID());
      applyChange(
        (prev) => duplicateSimpleSteppedSlots(prev, ids, newIds),
        { force: true },
      );
      return newIds;
    },
    [applyChange, paramsRef],
  );

  const resizeTray = useCallback(
    (width: number, depth: number) => {
      applyChange(
        (prev) => ({ ...prev, trayWidth: width, trayDepth: depth }),
        { history: "skip" },
      );
    },
    [applyChange],
  );

  const trimTray = useCallback(() => {
    applyChange((prev) => trimSimpleSteppedBaseplate(prev));
  }, [applyChange]);

  return {
    params,
    setParams,
    updateParam,
    activeRowId: resolvedActiveRowId,
    setActiveRow: setActiveRowId,
    addRow,
    removeRow,
    renameRow,
    clearRow,
    reorderRows,
    addSlotToRow,
    removeSlot,
    updateSlotPosition,
    updateMultipleSlots,
    updateMultipleSlotsLive,
    updateSlotRotation,
    duplicateSlots,
    derivedLayout,
    canvasParams,
    effectiveDimensions,
    saveSnapshot,
    undo,
    canUndo,
    resizeTray,
    trimTray,
    threeGeometry,
    volume,
    isGenerating,
    isPreviewStale,
    handleGenerate,
    handleExportSTL,
  };
}
