"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import type { CustomLayoutParams, FreeSlot } from "@/types/custom-tray";
import { CUSTOM_LAYOUT_DEFAULTS, getSlotTolerance } from "@/lib/config";
import { jscadToThreeGeometry } from "@/lib/jscad-to-three";
import { generateCustomSTLFilename } from "@/lib/stl-export";
import { useUndoHistory } from "@/hooks/useUndoHistory";
import { trayWorkerService } from "@/lib/worker/worker-service";
import { useToast } from "@/hooks/useToast";
import type * as THREE from "three";
import type { Geom3 } from "@jscad/modeling/src/geometries/types";

interface UseCustomLayoutReturn {
  params: CustomLayoutParams;
  setParams: React.Dispatch<React.SetStateAction<CustomLayoutParams>>;
  updateParam: <K extends keyof CustomLayoutParams>(
    key: K,
    value: CustomLayoutParams[K],
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
  calculateEffectiveDimensions: () => {
    width: number;
    depth: number;
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
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
  volume: number; // in mm^3
  isGenerating: boolean;
  isPreviewStale: boolean;
  handleGenerate: () => void;
  handleExportSTL: () => void;
}

export function useCustomLayout(): UseCustomLayoutReturn {
  const [params, setParams] = useState<CustomLayoutParams>(
    CUSTOM_LAYOUT_DEFAULTS,
  );
  const [threeGeometry, setThreeGeometry] =
    useState<THREE.BufferGeometry | null>(null);
  const [volume, setVolume] = useState<number>(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const jscadGeomRef = useRef<Geom3 | null>(null);
  const { toast } = useToast();

  // 撤销历史
  const {
    pushState,
    popState,
    canUndo: canUndoFn,
  } = useUndoHistory<CustomLayoutParams>();
  // 用 ref 追踪最新 params，避免闭包陈旧
  const paramsRef = useRef(params);
  paramsRef.current = params;
  // 追踪预览是否过期
  const [isPreviewStale, setIsPreviewStale] = useState(false);

  const resolveBoundarySpacing = useCallback((current: CustomLayoutParams) => {
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
      return {
        width: 0,
        depth: 0,
        minX: 0,
        maxX: 0,
        minY: 0,
        maxY: 0,
      };
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

  /** 手动保存快照（供拖拽开始时调用） */
  const saveSnapshot = useCallback(() => {
    pushState(paramsRef.current);
  }, [pushState]);

  /** 撤销到上一步 */
  const undo = useCallback(() => {
    const prev = popState();
    if (prev) {
      setParams(prev);
    }
  }, [popState]);

  const updateParam = useCallback(
    <K extends keyof CustomLayoutParams>(
      key: K,
      value: CustomLayoutParams[K],
    ) => {
      pushState(paramsRef.current);
      setParams((prev) => {
        if (key === "spacing") {
          const nextSpacing = value as CustomLayoutParams["spacing"];
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
          const independent = value as CustomLayoutParams["boundarySpacingIndependent"];
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

  /**
   * 添加凹槽 -> 默认放置在画布中心
   */
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

        const newSlot: FreeSlot = {
          id: crypto.randomUUID(),
          x: nextX,
          y: nextY,
          shape: isCircle ? "circle" : "ellipse",
          width,
          height: slotHeight,
          rotation: 0,
        };
        return { ...prev, slots: [...prev.slots, newSlot] };
      });
      setIsPreviewStale(true);
    },
    [getSlotBoundingHalfSize, pushState],
  );

  /**
   * 删除凹槽
   */
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

  /**
   * 更新凹槽位置（拖拽时频繁调用，不自动记录历史）
   */
  const updateSlotPosition = useCallback((id: string, x: number, y: number) => {
    setParams((prev) => ({
      ...prev,
      slots: prev.slots.map((s) => (s.id === id ? { ...s, x, y } : s)),
    }));
    setIsPreviewStale(true);
  }, []);

  /**
   * 更新多个凹槽位置（用于对齐工具等批量操作，自动记录历史）
   */
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

  /**
   * 更新凹槽旋转（旋转时频繁调用，不自动记录历史）
   */
  const updateSlotRotation = useCallback((id: string, rotation: number) => {
    setParams((prev) => ({
      ...prev,
      slots: prev.slots.map((s) => (s.id === id ? { ...s, rotation } : s)),
    }));
    setIsPreviewStale(true);
  }, []);

  /**
   * 复制凹槽
   */
  const duplicateSlots = useCallback(
    (ids: string[]) => {
      setParams((prev) => {
        pushState(prev);
        const newSlots = [...prev.slots];
        const newlyAddedIds: string[] = [];

        ids.forEach((id) => {
          const slotToCopy = prev.slots.find((s) => s.id === id);
          if (slotToCopy) {
            const newId = crypto.randomUUID();
            newlyAddedIds.push(newId);
            newSlots.push({
              ...slotToCopy,
              id: newId,
              x: slotToCopy.x + 10, // Offset slightly to make it visible
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

  /**
   * 裁剪底板：计算当前所有凹槽的最小包围盒，
   * 并将托盘尺寸调整为该包围盒大小 + 边缘间距，
   * 同时自动平移所有凹槽以保持居中。
   */
  const trimBaseplate = useCallback(() => {
    setParams((prev) => {
      if (prev.slots.length === 0) return prev;

      pushState(prev);

      const current = paramsRef.current;
      const dims = calculateEffectiveDimensions();
      if (dims.width <= 0 || dims.depth <= 0) return prev;

      const newTrayWidth = dims.width;
      const newTrayDepth = dims.depth;

      // 4. Calculate shift to center the slots
      // The old bounding box center was ((minX + maxX)/2, (minY + maxY)/2)
      // The new space center is (newTrayWidth/2, newTrayDepth/2)
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
        slots: current.slots.map((s) => ({
          ...s,
          x: s.x + dx,
          y: s.y + dy,
        })),
      };
    });
    setIsPreviewStale(true);
  }, [calculateEffectiveDimensions, pushState]);

  // 异步触发生成 3D 模型
  const handleGenerate = useCallback(async () => {
    if (!trayWorkerService) return;
    setIsGenerating(true);
    try {
      const result = await trayWorkerService.generateCustom(params);
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

  // 导出 STL
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
    const filename = generateCustomSTLFilename(
      exportWidth,
      exportDepth,
      params.slots.length,
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
  }, [
    effectiveDimensions.depth,
    effectiveDimensions.width,
    params.slots.length,
    params.trayDepth,
    params.trayWidth,
    toast,
  ]);

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
    calculateEffectiveDimensions,
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
