"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type * as THREE from "three";
import type { Geom3 } from "@jscad/modeling/src/geometries/types";
import type {
  CustomLayoutParams,
  FreeSlot,
  SimpleSteppedLayoutParams,
  SimpleSteppedRow,
  SimpleSteppedSlot,
} from "@/types/custom-tray";
import {
  MAX_BUILD_SIZE,
  SIMPLE_STEPPED_LAYOUT_DEFAULTS,
} from "@/lib/config";
import {
  calculateSimpleSteppedMinimumTraySize,
  calculateSimpleSteppedDimensions,
  clampSimpleSteppedSlotUpdates,
  deriveSimpleSteppedLayout,
  getSimpleSteppedEffectiveDiameter,
  type SimpleSteppedDerivedLayout,
  type SimpleSteppedSlotUpdate,
} from "@/lib/simple-stepped-layout";
import { jscadToThreeGeometry } from "@/lib/jscad-to-three";
import { generateSimpleSteppedSTLFilename } from "@/lib/stl-export";
import { useUndoHistory } from "@/hooks/useUndoHistory";
import { trayWorkerService } from "@/lib/worker/worker-service";
import { useToast } from "@/hooks/useToast";
import { downloadParamFile } from "@/lib/param-io";

type CanvasSlotUpdate = { id: string; x: number; y: number; rotation?: number };

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
  const { toast } = useToast();
  const [params, internalSetParams] = useState<SimpleSteppedLayoutParams>(
    SIMPLE_STEPPED_LAYOUT_DEFAULTS,
  );
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const [threeGeometry, setThreeGeometry] =
    useState<THREE.BufferGeometry | null>(null);
  const [volume, setVolume] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPreviewStale, setIsPreviewStale] = useState(false);
  const jscadGeomRef = useRef<Geom3 | null>(null);
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const paramsVersionRef = useRef(0);

  const {
    pushState,
    popState,
    canUndo: canUndoFn,
  } = useUndoHistory<SimpleSteppedLayoutParams>();

  const invalidatePreview = useCallback(() => {
    paramsVersionRef.current += 1;
    jscadGeomRef.current = null;
    setVolume(0);
    setIsPreviewStale(true);
  }, []);

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

  const setParams = useCallback<
    React.Dispatch<React.SetStateAction<SimpleSteppedLayoutParams>>
  >(
    (value) => {
      internalSetParams((prev) =>
        normalizeParams(
          typeof value === "function"
            ? (value as (prevState: SimpleSteppedLayoutParams) => SimpleSteppedLayoutParams)(prev)
            : value,
        ),
      );
      invalidatePreview();
    },
    [invalidatePreview, normalizeParams],
  );

  useEffect(() => {
    const rowIds = new Set(params.rows.map((row) => row.id));
    setActiveRowId((prev) => {
      if (prev && rowIds.has(prev)) {
        return prev;
      }
      return params.rows[0]?.id ?? null;
    });
  }, [params.rows]);

  const derivedLayout = useMemo(
    () => deriveSimpleSteppedLayout(params, activeRowId),
    [activeRowId, params],
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
  ]);

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
    <K extends keyof SimpleSteppedLayoutParams>(
      key: K,
      value: SimpleSteppedLayoutParams[K],
    ) => {
      pushState(paramsRef.current);
      internalSetParams((prev) => {
        if (key === "spacing") {
          const nextSpacing = value as SimpleSteppedLayoutParams["spacing"];
          if (!prev.outerMarginIndependent) {
            return normalizeParams({
              ...prev,
              spacing: nextSpacing,
              outerMargin: nextSpacing,
            });
          }
          return normalizeParams({ ...prev, spacing: nextSpacing });
        }

        if (key === "outerMarginIndependent") {
          const independent =
            value as SimpleSteppedLayoutParams["outerMarginIndependent"];
          if (!independent) {
            return normalizeParams({
              ...prev,
              outerMarginIndependent: false,
              outerMargin: prev.spacing,
            });
          }
          return normalizeParams({
            ...prev,
            outerMarginIndependent: true,
            outerMargin: prev.outerMargin ?? prev.spacing,
          });
        }

        return normalizeParams({ ...prev, [key]: value });
      });
      invalidatePreview();
    },
    [invalidatePreview, normalizeParams, pushState],
  );

  const addRow = useCallback(() => {
    const newRow: SimpleSteppedRow = {
      id: crypto.randomUUID(),
      name: `行 ${paramsRef.current.rows.length + 1}`,
      slotIds: [],
    };
    internalSetParams((prev) => {
      pushState(prev);
      return normalizeParams({
        ...prev,
        rows: [...prev.rows, newRow],
      });
    });
    setActiveRowId(newRow.id);
    invalidatePreview();
  }, [invalidatePreview, normalizeParams, pushState]);

  const removeRow = useCallback(
    (rowId: string) => {
      internalSetParams((prev) => {
        pushState(prev);
        return normalizeParams({
          ...prev,
          rows: prev.rows.filter((row) => row.id !== rowId),
          slots: prev.slots.filter((slot) => slot.rowId !== rowId),
        });
      });
      invalidatePreview();
    },
    [invalidatePreview, normalizeParams, pushState],
  );

  const renameRow = useCallback(
    (rowId: string, name: string) => {
      pushState(paramsRef.current);
      internalSetParams((prev) =>
        normalizeParams({
          ...prev,
          rows: prev.rows.map((row) =>
            row.id === rowId ? { ...row, name: name.trim() || row.name } : row,
          ),
        }),
      );
      invalidatePreview();
    },
    [invalidatePreview, normalizeParams, pushState],
  );

  const clearRow = useCallback(
    (rowId: string) => {
      internalSetParams((prev) => {
        pushState(prev);
        return normalizeParams({
          ...prev,
          slots: prev.slots.filter((slot) => slot.rowId !== rowId),
        });
      });
      invalidatePreview();
    },
    [invalidatePreview, normalizeParams, pushState],
  );

  const reorderRows = useCallback(
    (fromIndex: number, toIndex: number) => {
      internalSetParams((prev) => {
        if (
          fromIndex < 0 ||
          fromIndex >= prev.rows.length ||
          toIndex < 0 ||
          toIndex >= prev.rows.length ||
          fromIndex === toIndex
        ) {
          return prev;
        }

        pushState(prev);
        const nextRows = [...prev.rows];
        const [moved] = nextRows.splice(fromIndex, 1);
        nextRows.splice(toIndex, 0, moved);
        return normalizeParams({
          ...prev,
          rows: nextRows,
        });
      });
      invalidatePreview();
    },
    [invalidatePreview, normalizeParams, pushState],
  );

  const addSlotToRow = useCallback(
    (rowId: string, diameter: number) => {
      internalSetParams((prev) => {
        const rowExists = prev.rows.some((row) => row.id === rowId);
        if (!rowExists) {
          return prev;
        }

        pushState(prev);
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

        const newSlot: SimpleSteppedSlot = {
          id: crypto.randomUUID(),
          rowId,
          shape: "circle",
          diameter,
          x,
          y: 0,
        };

        return normalizeParams({
          ...prev,
          slots: [...prev.slots, newSlot],
        });
      });
      invalidatePreview();
    },
    [invalidatePreview, normalizeParams, pushState],
  );

  const removeSlot = useCallback(
    (id: string) => {
      pushState(paramsRef.current);
      internalSetParams((prev) =>
        normalizeParams({
          ...prev,
          slots: prev.slots.filter((slot) => slot.id !== id),
        }),
      );
      invalidatePreview();
    },
    [invalidatePreview, normalizeParams, pushState],
  );

  const mapCanvasUpdatesToLocal = useCallback(
    (
      current: SimpleSteppedLayoutParams,
      updates: CanvasSlotUpdate[],
    ): SimpleSteppedSlotUpdate[] => {
      const derived = deriveSimpleSteppedLayout(current);
      const rowById = new Map(derived.activeRows.map((row) => [row.id, row]));
      const slotById = new Map(current.slots.map((slot) => [slot.id, slot]));

      return updates
        .map((update) => {
          const slot = slotById.get(update.id);
          if (!slot) {
            return null;
          }
          const row = rowById.get(slot.rowId);
          if (!row) {
            return null;
          }

          return {
            id: update.id,
            x: update.x - derived.trayWidth / 2 + row.holeCenterX,
            y: update.y - row.centerY,
          };
        })
        .filter((update): update is SimpleSteppedSlotUpdate => Boolean(update));
    },
    [],
  );

  const applyMultipleCanvasSlotUpdates = useCallback(
    (updates: CanvasSlotUpdate[], saveHistory: boolean) => {
      internalSetParams((prev) => {
        if (saveHistory) {
          pushState(prev);
        }

        const localUpdates = clampSimpleSteppedSlotUpdates(
          prev,
          mapCanvasUpdatesToLocal(prev, updates),
        );
        const updatesMap = new Map(localUpdates.map((update) => [update.id, update]));

        return normalizeParams({
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
        });
      });
      invalidatePreview();
    },
    [invalidatePreview, mapCanvasUpdatesToLocal, normalizeParams, pushState],
  );

  const updateSlotPosition = useCallback(
    (id: string, x: number, y: number) => {
      applyMultipleCanvasSlotUpdates([{ id, x, y }], false);
    },
    [applyMultipleCanvasSlotUpdates],
  );

  const updateMultipleSlots = useCallback(
    (updates: CanvasSlotUpdate[]) => {
      applyMultipleCanvasSlotUpdates(updates, true);
    },
    [applyMultipleCanvasSlotUpdates],
  );

  const updateMultipleSlotsLive = useCallback(
    (updates: CanvasSlotUpdate[]) => {
      applyMultipleCanvasSlotUpdates(updates, false);
    },
    [applyMultipleCanvasSlotUpdates],
  );

  const updateSlotRotation = useCallback((_id: string, _rotation: number) => {
    // 第一版仅支持圆形槽，旋转无意义；保留接口兼容 LayoutCanvas。
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
      internalSetParams((prev) => {
        pushState(prev);
        const nextSlots = [...prev.slots];

        targets.forEach((slot, index) => {
          nextSlots.push({
            ...slot,
            id: newIds[index],
            x: slot.x + getSimpleSteppedEffectiveDiameter(slot) + prev.spacing,
          });
        });

        return normalizeParams({
          ...prev,
          slots: nextSlots,
        });
      });
      invalidatePreview();
      return newIds;
    },
    [invalidatePreview, normalizeParams, pushState],
  );

  const handleGenerate = useCallback(async () => {
    if (!trayWorkerService) {
      return;
    }

    const requestVersion = paramsVersionRef.current;
    setIsGenerating(true);
    try {
      const result = await trayWorkerService.generateSimpleStepped(paramsRef.current);
      if (requestVersion !== paramsVersionRef.current) {
        return;
      }

      jscadGeomRef.current = result.geometry;
      setVolume(result.volume);
      const threeGeom = jscadToThreeGeometry(result.geometry);
      setThreeGeometry((prev) => {
        prev?.dispose();
        return threeGeom;
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
    const currentDerived = deriveSimpleSteppedLayout(currentParams);
    const filename = generateSimpleSteppedSTLFilename(
      Math.round(currentDerived.trayWidth),
      Math.round(currentDerived.trayDepth),
      currentDerived.activeRows.length,
      currentParams.slots.length,
    );

    try {
      const result = await trayWorkerService.exportSTL(
        jscadGeomRef.current,
        filename,
      );
      const url = URL.createObjectURL(result.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      const jsonFilename = filename.replace(/\.stl$/i, ".json");
      downloadParamFile("simple-stepped", currentParams, jsonFilename);
    } catch (err) {
      console.error("STL导出失败:", err);
      toast(
        "error",
        `STL 导出失败：${err instanceof Error ? err.message : "未知错误"}`,
      );
    }
  }, [isPreviewStale, toast]);

  const resizeTray = useCallback(
    (width: number, depth: number) => {
      internalSetParams((prev) =>
        normalizeParams({
          ...prev,
          trayWidth: width,
          trayDepth: depth,
        }),
      );
      invalidatePreview();
    },
    [invalidatePreview, normalizeParams],
  );

  const trimTray = useCallback(() => {
    let didTrim = false;
    internalSetParams((prev) => {
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

      pushState(prev);
      didTrim = true;
      return normalizeParams({
        ...prev,
        trayWidth: minimumDims.width,
        trayDepth: minimumDims.depth,
      });
    });
    if (didTrim) {
      invalidatePreview();
    }
  }, [invalidatePreview, normalizeParams, pushState]);

  return {
    params,
    setParams,
    updateParam,
    activeRowId,
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
    canUndo: canUndoFn(),
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
