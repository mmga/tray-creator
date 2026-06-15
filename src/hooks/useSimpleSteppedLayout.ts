"use client";

import { useCallback, useMemo, useState } from "react";
import type * as THREE from "three";
import type {
  CustomLayoutParams,
  FreeSlot,
  SimpleSteppedLayoutParams,
  SimpleSteppedRow,
  SimpleSteppedSlot,
} from "@/types/custom-tray";
import { MAX_BUILD_SIZE } from "@/lib/config";
import { browserDownloadPort } from "@/lib/download-port";
import { createSimpleSteppedSlotInstance } from "@/lib/slot-instance-factory";
import { SIMPLE_STEPPED_LAYOUT_DEFAULTS } from "@/lib/simple-stepped-config";
import {
  calculateSimpleSteppedMinimumTraySize,
  calculateSimpleSteppedDimensions,
  clampSimpleSteppedSlotUpdates,
  deriveSimpleSteppedLayout,
  getSimpleSteppedEffectiveDiameter,
  mapSimpleSteppedCanvasUpdatesToLocal,
  type SimpleSteppedDerivedLayout,
} from "@/lib/simple-stepped-projection";
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

function rebuildRowSlotIds(
  rows: SimpleSteppedRow[],
  slots: SimpleSteppedSlot[],
): SimpleSteppedRow[] {
  return rows.map((row) => ({
    ...row,
    slotIds: slots.filter((slot) => slot.rowId === row.id).map((slot) => slot.id),
  }));
}

function normalizeSimpleSteppedTraySize(
  requestedSize: number,
  minimumSize: number,
  fallbackSize: number,
) {
  const safeRequestedSize =
    Number.isFinite(requestedSize) && requestedSize > 0
      ? requestedSize
      : fallbackSize;

  if (minimumSize > MAX_BUILD_SIZE) {
    return Math.max(safeRequestedSize, minimumSize);
  }

  return Math.min(
    Math.max(safeRequestedSize, minimumSize),
    MAX_BUILD_SIZE,
  );
}

export function useSimpleSteppedLayout(): UseSimpleSteppedLayoutReturn {
  const [activeRowId, setActiveRowId] = useState<string | null>(null);

  const normalizeParams = useCallback((next: SimpleSteppedLayoutParams) => {
    const rebuiltRows = rebuildRowSlotIds(next.rows, next.slots);
    const normalizedSlots = next.slots.map((slot) => ({
      ...slot,
      y: Number.isFinite(slot.y) ? slot.y : 0,
    }));
    const withRowIds = {
      ...next,
      rows: rebuiltRows,
      slots: normalizedSlots,
      outerMarginIndependent: Boolean(next.outerMarginIndependent),
      outerMargin: next.outerMarginIndependent ? next.outerMargin : next.spacing,
    };
    const minimumDims = calculateSimpleSteppedMinimumTraySize(withRowIds);
    const fallbackWidth =
      Number.isFinite(withRowIds.trayWidth) && withRowIds.trayWidth > 0
        ? withRowIds.trayWidth
        : SIMPLE_STEPPED_LAYOUT_DEFAULTS.trayWidth;
    const fallbackDepth =
      Number.isFinite(withRowIds.trayDepth) && withRowIds.trayDepth > 0
        ? withRowIds.trayDepth
        : SIMPLE_STEPPED_LAYOUT_DEFAULTS.trayDepth;

    return {
      ...withRowIds,
      trayWidth: normalizeSimpleSteppedTraySize(
        withRowIds.trayWidth,
        minimumDims.width,
        fallbackWidth,
      ),
      trayDepth: normalizeSimpleSteppedTraySize(
        withRowIds.trayDepth,
        minimumDims.depth,
        fallbackDepth,
      ),
    };
  }, []);

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
    normalize: normalizeParams,
    guard: () => trayWorkerService !== null,
    generatePreview: async (currentParams) => {
      const result = await trayWorkerService!.generateSimpleStepped(currentParams);
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
    const slots: FreeSlot[] = derivedLayout.activeRows.flatMap((row) =>
      row.slots.map((slot) => ({
        id: slot.id,
        x: slot.globalX,
        y: slot.globalY,
        shape: "circle" as const,
        width: slot.diameter,
        height: slot.diameter,
        slotDefinitionId: params.slots.find((item) => item.id === slot.id)
          ?.slotDefinitionId,
        slotWidth: slot.effectiveDiameter,
        slotHeight: slot.effectiveDiameter,
        rotation: 0,
      })),
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
    const newRow: SimpleSteppedRow = {
      id: crypto.randomUUID(),
      name: `行 ${paramsRef.current.rows.length + 1}`,
      slotIds: [],
    };
    applyChange((prev) => ({
      ...prev,
      rows: [...prev.rows, newRow],
    }));
    setActiveRowId(newRow.id);
  }, [applyChange, paramsRef]);

  const removeRow = useCallback(
    (rowId: string) => {
      applyChange((prev) => ({
        ...prev,
        rows: prev.rows.filter((row) => row.id !== rowId),
        slots: prev.slots.filter((slot) => slot.rowId !== rowId),
      }));
    },
    [applyChange],
  );

  const renameRow = useCallback(
    (rowId: string, name: string) => {
      applyChange((prev) => ({
        ...prev,
        rows: prev.rows.map((row) =>
          row.id === rowId ? { ...row, name: name.trim() || row.name } : row,
        ),
      }));
    },
    [applyChange],
  );

  const clearRow = useCallback(
    (rowId: string) => {
      applyChange((prev) => ({
        ...prev,
        slots: prev.slots.filter((slot) => slot.rowId !== rowId),
      }));
    },
    [applyChange],
  );

  const reorderRows = useCallback(
    (fromIndex: number, toIndex: number) => {
      applyChange((prev) => {
        if (
          fromIndex < 0 ||
          fromIndex >= prev.rows.length ||
          toIndex < 0 ||
          toIndex >= prev.rows.length ||
          fromIndex === toIndex
        ) {
          return prev;
        }

        const nextRows = [...prev.rows];
        const [moved] = nextRows.splice(fromIndex, 1);
        nextRows.splice(toIndex, 0, moved);
        return { ...prev, rows: nextRows };
      });
    },
    [applyChange],
  );

  const addSlotToRow = useCallback(
    (rowId: string, diameter: number) => {
      applyChange((prev) => {
        const rowExists = prev.rows.some((row) => row.id === rowId);
        if (!rowExists) {
          return prev;
        }

        const rowSlots = prev.slots.filter((slot) => slot.rowId === rowId);
        const effectiveDiameter = getSimpleSteppedEffectiveDiameter({ diameter });
        const x =
          rowSlots.length === 0
            ? 0
            : Math.max(
                ...rowSlots.map((slot) => slot.x + getSimpleSteppedEffectiveDiameter(slot) / 2),
              ) +
              prev.spacing +
              effectiveDiameter / 2;

        const newSlot = createSimpleSteppedSlotInstance({
          id: crypto.randomUUID(),
          rowId,
          diameter,
          x,
        });

        return { ...prev, slots: [...prev.slots, newSlot] };
      });
    },
    [applyChange],
  );

  const removeSlot = useCallback(
    (id: string) => {
      applyChange((prev) => ({
        ...prev,
        slots: prev.slots.filter((slot) => slot.id !== id),
      }));
    },
    [applyChange],
  );

  const updateSlotPosition = useCallback(
    (id: string, x: number, y: number) => {
      applyChange(
        (prev) => {
          const localUpdates = clampSimpleSteppedSlotUpdates(
            prev,
            mapSimpleSteppedCanvasUpdatesToLocal(prev, [{ id, x, y }]),
          );
          const updatesMap = new Map(
            localUpdates.map((update) => [update.id, update] as const),
          );
          return {
            ...prev,
            slots: prev.slots.map((slot) =>
              updatesMap.has(slot.id)
                ? {
                    ...slot,
                    x: updatesMap.get(slot.id)?.x ?? slot.x,
                    y: updatesMap.get(slot.id)?.y ?? slot.y,
                  }
                : slot,
            ),
          };
        },
        { history: "live" },
      );
    },
    [applyChange],
  );

  const updateMultipleSlots = useCallback(
    (updates: CanvasSlotUpdate[]) => {
      applyChange((prev) => {
        const localUpdates = clampSimpleSteppedSlotUpdates(
          prev,
          mapSimpleSteppedCanvasUpdatesToLocal(prev, updates),
        );
        const updatesMap = new Map(
          localUpdates.map((update) => [update.id, update] as const),
        );
        return {
          ...prev,
          slots: prev.slots.map((slot) =>
            updatesMap.has(slot.id)
              ? {
                  ...slot,
                  x: updatesMap.get(slot.id)?.x ?? slot.x,
                  y: updatesMap.get(slot.id)?.y ?? slot.y,
                }
              : slot,
          ),
        };
      });
    },
    [applyChange],
  );

  const updateMultipleSlotsLive = useCallback(
    (updates: CanvasSlotUpdate[]) => {
      applyChange(
        (prev) => {
          const localUpdates = clampSimpleSteppedSlotUpdates(
            prev,
            mapSimpleSteppedCanvasUpdatesToLocal(prev, updates),
          );
          const updatesMap = new Map(
            localUpdates.map((update) => [update.id, update] as const),
          );
          return {
            ...prev,
            slots: prev.slots.map((slot) =>
              updatesMap.has(slot.id)
                ? {
                    ...slot,
                    x: updatesMap.get(slot.id)?.x ?? slot.x,
                    y: updatesMap.get(slot.id)?.y ?? slot.y,
                  }
                : slot,
            ),
          };
        },
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
      const current = paramsRef.current;
      const idSet = new Set(ids);
      const targets = current.slots.filter((slot) => idSet.has(slot.id));
      if (targets.length === 0) {
        return [];
      }

      const newIds = targets.map(() => crypto.randomUUID());
      applyChange(
        (prev) => {
          const nextSlots = [...prev.slots];
          targets.forEach((slot, index) => {
            nextSlots.push({
              ...slot,
              id: newIds[index],
              x: slot.x + getSimpleSteppedEffectiveDiameter(slot) + prev.spacing,
            });
          });
          return { ...prev, slots: nextSlots };
        },
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
    applyChange((prev) => {
      const minimumDims = calculateSimpleSteppedMinimumTraySize(prev);
      if (minimumDims.width <= 0 || minimumDims.depth <= 0) {
        return prev;
      }
      if (
        Math.abs(prev.trayWidth - minimumDims.width) < 0.001 &&
        Math.abs(prev.trayDepth - minimumDims.depth) < 0.001
      ) {
        return prev;
      }
      return {
        ...prev,
        trayWidth: minimumDims.width,
        trayDepth: minimumDims.depth,
      };
    });
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
