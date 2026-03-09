"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import type {
  SteppedLayoutParams,
  SteppedSlot,
  FreeSlot,
} from "@/types/custom-tray";
import {
  STEPPED_LAYOUT_DEFAULTS,
  STEPPED_SLOT_DEFAULTS,
  getSlotTolerance,
} from "@/lib/config";
import { jscadToThreeGeometry } from "@/lib/jscad-to-three";
import { useUndoHistory } from "@/hooks/useUndoHistory";
import { trayWorkerService } from "@/lib/worker/worker-service";
import { useToast } from "@/hooks/useToast";
import type * as THREE from "three";
import type { Geom3 } from "@jscad/modeling/src/geometries/types";

export interface UseSteppedLayoutReturn {
  params: SteppedLayoutParams;
  setParams: React.Dispatch<React.SetStateAction<SteppedLayoutParams>>;
  updateParam: <K extends keyof SteppedLayoutParams>(
    key: K,
    value: SteppedLayoutParams[K],
  ) => void;
  addSlot: (width: number, height?: number) => void;
  removeSlot: (id: string) => void;
  updateSlotPosition: (id: string, x: number, y: number) => void;
  updateMultipleSlots: (
    updates: { id: string; x: number; y: number }[],
  ) => void;
  updateSlotRotation: (id: string, rotation: number) => void;
  duplicateSlots: (ids: string[]) => void;
  trimBaseplate: () => void;
  updateSlotBottomHeight: (id: string, bottomHeight: number) => void;
  updateSelectedSlotsBottomHeight: (
    ids: string[],
    bottomHeight: number,
  ) => void;
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
  handleGenerate: () => void;
  handleExportSTL: () => void;
}

export function useSteppedLayout(): UseSteppedLayoutReturn {
  const [params, setParams] = useState<SteppedLayoutParams>(
    STEPPED_LAYOUT_DEFAULTS,
  );
  const [threeGeometry, setThreeGeometry] =
    useState<THREE.BufferGeometry | null>(null);
  const [volume, setVolume] = useState<number>(0);
  const [isGenerating, setIsGenerating] = useState(false);
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

  const resolveBoundarySpacing = useCallback((current: SteppedLayoutParams) => {
    if (current.boundarySpacingIndependent) {
      return current.boundarySpacing;
    }
    return current.spacing;
  }, []);

  const getSlotBoundingHalfSize = useCallback((slot: FreeSlot) => {
    const rad = (slot.rotation * Math.PI) / 180;
    const a = (slot.width + getSlotTolerance(slot.width)) / 2;
    const b = (slot.height + getSlotTolerance(slot.height)) / 2;
    const halfW = Math.sqrt(
      Math.pow(a * Math.cos(rad), 2) + Math.pow(b * Math.sin(rad), 2),
    );
    const halfH = Math.sqrt(
      Math.pow(a * Math.sin(rad), 2) + Math.pow(b * Math.cos(rad), 2),
    );
    return { halfW, halfH };
  }, []);

  const calculateEffectiveDimensions = useCallback(() => {
    const current = paramsRef.current;
    const boundarySpacing = resolveBoundarySpacing(current);
    if (current.slots.length === 0) {
      return { width: 0, depth: 0, minX: 0, maxX: 0, minY: 0, maxY: 0 };
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    current.slots.forEach((slot) => {
      const { halfW, halfH } = getSlotBoundingHalfSize(slot);
      minX = Math.min(minX, slot.x - halfW);
      maxX = Math.max(maxX, slot.x + halfW);
      minY = Math.min(minY, slot.y - halfH);
      maxY = Math.max(maxY, slot.y + halfH);
    });

    return {
      width: Math.ceil(maxX - minX + boundarySpacing * 2),
      depth: Math.ceil(maxY - minY + boundarySpacing * 2),
      minX,
      maxX,
      minY,
      maxY,
    };
  }, [getSlotBoundingHalfSize, resolveBoundarySpacing]);

  const effectiveDimensions = useMemo(
    () => calculateEffectiveDimensions(),
    [params, calculateEffectiveDimensions],
  );

  const saveSnapshot = useCallback(() => {
    pushState(paramsRef.current);
  }, [pushState]);

  const undo = useCallback(() => {
    const prev = popState();
    if (prev) {
      setParams(prev);
    }
  }, [popState]);

  const updateParam = useCallback(
    <K extends keyof SteppedLayoutParams>(
      key: K,
      value: SteppedLayoutParams[K],
    ) => {
      pushState(paramsRef.current);
      setParams((prev) => {
        if (key === "spacing") {
          const nextSpacing = value as SteppedLayoutParams["spacing"];
          if (!prev.boundarySpacingIndependent) {
            return {
              ...prev,
              spacing: nextSpacing,
              boundarySpacing: nextSpacing,
            };
          }
          return { ...prev, spacing: nextSpacing };
        }

        if (key === "boundarySpacingIndependent") {
          const independent =
            value as SteppedLayoutParams["boundarySpacingIndependent"];
          if (!independent) {
            return {
              ...prev,
              boundarySpacingIndependent: false,
              boundarySpacing: prev.spacing,
            };
          }
          return {
            ...prev,
            boundarySpacingIndependent: true,
            boundarySpacing: prev.boundarySpacing ?? prev.spacing,
          };
        }

        return { ...prev, [key]: value };
      });
      setIsPreviewStale(true);
    },
    [pushState],
  );

  const addSlot = useCallback(
    (width: number, height?: number) => {
      setParams((prev) => {
        pushState(prev);
        const isCircle = !height || width === height;
        const slotHeight = height || width;
        const newSlotHalfW =
          (width + getSlotTolerance(Math.max(width, slotHeight))) / 2;

        let nextX = prev.trayWidth / 2;
        let nextY = prev.trayDepth / 2;

        if (prev.slots.length > 0) {
          const lastSlot = prev.slots[prev.slots.length - 1];
          const lastHalf = getSlotBoundingHalfSize(lastSlot);
          nextX = lastSlot.x + lastHalf.halfW + prev.spacing + newSlotHalfW;
          nextY = lastSlot.y;
        }

        const newSlot: SteppedSlot = {
          id: crypto.randomUUID(),
          x: nextX,
          y: nextY,
          shape: isCircle ? "circle" : "ellipse",
          width,
          height: slotHeight,
          rotation: 0,
          bottomHeight: STEPPED_SLOT_DEFAULTS.bottomHeight,
        };
        return { ...prev, slots: [...prev.slots, newSlot] };
      });
      setIsPreviewStale(true);
    },
    [getSlotBoundingHalfSize, pushState],
  );

  const removeSlot = useCallback(
    (id: string) => {
      pushState(paramsRef.current);
      setParams((prev) => ({
        ...prev,
        slots: prev.slots.filter((s) => s.id !== id),
      }));
      setIsPreviewStale(true);
    },
    [pushState],
  );

  const updateSlotPosition = useCallback((id: string, x: number, y: number) => {
    setParams((prev) => ({
      ...prev,
      slots: prev.slots.map((s) => (s.id === id ? { ...s, x, y } : s)),
    }));
    setIsPreviewStale(true);
  }, []);

  const updateMultipleSlots = useCallback(
    (updates: { id: string; x: number; y: number }[]) => {
      setParams((prev) => {
        pushState(prev);
        const updatesMap = new Map(updates.map((u) => [u.id, u]));
        return {
          ...prev,
          slots: prev.slots.map((s) => {
            const u = updatesMap.get(s.id);
            return u ? { ...s, x: u.x, y: u.y } : s;
          }),
        };
      });
      setIsPreviewStale(true);
    },
    [pushState],
  );

  const updateSlotRotation = useCallback((id: string, rotation: number) => {
    setParams((prev) => ({
      ...prev,
      slots: prev.slots.map((s) => (s.id === id ? { ...s, rotation } : s)),
    }));
    setIsPreviewStale(true);
  }, []);

  const duplicateSlots = useCallback(
    (ids: string[]) => {
      setParams((prev) => {
        pushState(prev);
        const newSlots = [...prev.slots];

        ids.forEach((id) => {
          const slotToCopy = prev.slots.find((s) => s.id === id);
          if (slotToCopy) {
            newSlots.push({
              ...slotToCopy,
              id: crypto.randomUUID(),
              x: slotToCopy.x + 10,
              y: slotToCopy.y - 10,
            });
          }
        });

        return { ...prev, slots: newSlots };
      });
      setIsPreviewStale(true);
    },
    [pushState],
  );

  const updateSlotBottomHeight = useCallback(
    (id: string, bottomHeight: number) => {
      pushState(paramsRef.current);
      setParams((prev) => ({
        ...prev,
        slots: prev.slots.map((s) =>
          s.id === id ? { ...s, bottomHeight } : s,
        ),
      }));
      setIsPreviewStale(true);
    },
    [pushState],
  );

  const updateSelectedSlotsBottomHeight = useCallback(
    (ids: string[], bottomHeight: number) => {
      pushState(paramsRef.current);
      const idSet = new Set(ids);
      setParams((prev) => ({
        ...prev,
        slots: prev.slots.map((s) =>
          idSet.has(s.id) ? { ...s, bottomHeight } : s,
        ),
      }));
      setIsPreviewStale(true);
    },
    [pushState],
  );

  const trimBaseplate = useCallback(() => {
    setParams((prev) => {
      if (prev.slots.length === 0) return prev;
      pushState(prev);

      const dims = calculateEffectiveDimensions();
      if (dims.width <= 0 || dims.depth <= 0) return prev;

      const newTrayWidth = dims.width;
      const newTrayDepth = dims.depth;

      const oldCx = (dims.minX + dims.maxX) / 2;
      const oldCy = (dims.minY + dims.maxY) / 2;
      const newCx = newTrayWidth / 2;
      const newCy = newTrayDepth / 2;

      const dx = newCx - oldCx;
      const dy = newCy - oldCy;

      return {
        ...prev,
        trayWidth: newTrayWidth,
        trayDepth: newTrayDepth,
        slots: prev.slots.map((s) => ({
          ...s,
          x: s.x + dx,
          y: s.y + dy,
        })),
      };
    });
    setIsPreviewStale(true);
  }, [calculateEffectiveDimensions, pushState]);

  const handleGenerate = useCallback(async () => {
    if (!trayWorkerService) return;
    setIsGenerating(true);
    try {
      const result = await trayWorkerService.generateStepped(params);
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
  }, [params, toast]);

  const handleExportSTL = useCallback(async () => {
    if (!jscadGeomRef.current || !trayWorkerService) return;
    const exportWidth =
      effectiveDimensions.width > 0
        ? effectiveDimensions.width
        : params.trayWidth;
    const exportDepth =
      effectiveDimensions.depth > 0
        ? effectiveDimensions.depth
        : params.trayDepth;
    const filename = `tray_stepped_${exportWidth}x${exportDepth}_${params.slots.length}slots.stl`;
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
      // 同时下载 JSON 参数文件
      const jsonFilename = filename.replace(/\.stl$/i, ".json");
      const jsonBlob = new Blob([JSON.stringify(params, null, 2)], {
        type: "application/json",
      });
      const jsonUrl = URL.createObjectURL(jsonBlob);
      const jsonLink = document.createElement("a");
      jsonLink.href = jsonUrl;
      jsonLink.download = jsonFilename;
      document.body.appendChild(jsonLink);
      jsonLink.click();
      document.body.removeChild(jsonLink);
      URL.revokeObjectURL(jsonUrl);
    } catch (err) {
      console.error("STL导出失败:", err);
      toast(
        "error",
        `STL 导出失败：${err instanceof Error ? err.message : "未知错误"}`,
      );
    }
  }, [effectiveDimensions.depth, effectiveDimensions.width, params, toast]);

  return {
    params,
    setParams,
    updateParam,
    addSlot,
    removeSlot,
    updateSlotPosition,
    updateMultipleSlots,
    updateSlotRotation,
    duplicateSlots,
    trimBaseplate,
    updateSlotBottomHeight,
    updateSelectedSlotsBottomHeight,
    effectiveDimensions,
    saveSnapshot,
    undo,
    canUndo: canUndoFn(),
    threeGeometry,
    volume,
    isGenerating,
    isPreviewStale,
    handleGenerate,
    handleExportSTL,
  };
}
