"use client";

import { useState, useCallback, useRef } from "react";
import type { CustomLayoutParams, FreeSlot } from "@/types/custom-tray";
import { CUSTOM_LAYOUT_DEFAULTS, HOLE_TOLERANCE } from "@/lib/config";
import { jscadToThreeGeometry } from "@/lib/jscad-to-three";
import { generateCustomSTLFilename } from "@/lib/stl-export";
import { useUndoHistory } from "@/hooks/useUndoHistory";
import { trayWorkerService } from "@/lib/worker/worker-service";
import type * as THREE from "three";
import type { Geom3 } from "@jscad/modeling/src/geometries/types";

interface UseCustomLayoutReturn {
  params: CustomLayoutParams;
  setParams: React.Dispatch<React.SetStateAction<CustomLayoutParams>>;
  updateParam: <K extends keyof CustomLayoutParams>(key: K, value: CustomLayoutParams[K]) => void;
  // 凹槽操作
  addSlot: (width: number, height?: number) => void;
  removeSlot: (id: string) => void;
  updateSlotPosition: (id: string, x: number, y: number) => void;
  updateSlotRotation: (id: string, rotation: number) => void;
  duplicateSlots: (ids: string[]) => void;
  trimBaseplate: () => void;
  // 历史操作
  saveSnapshot: () => void;
  undo: () => void;
  canUndo: boolean;
  // 3D 相关
  threeGeometry: THREE.BufferGeometry | null;
  volume: number; // in mm^3
  isGenerating: boolean;
  handleGenerate: () => void;
  handleExportSTL: () => void;
}

export function useCustomLayout(): UseCustomLayoutReturn {
  const [params, setParams] = useState<CustomLayoutParams>(CUSTOM_LAYOUT_DEFAULTS);
  const [threeGeometry, setThreeGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [volume, setVolume] = useState<number>(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const jscadGeomRef = useRef<Geom3 | null>(null);

  // 撤销历史
  const { pushState, popState, canUndo: canUndoFn } = useUndoHistory<CustomLayoutParams>();
  // 用 ref 追踪最新 params，避免闭包陈旧
  const paramsRef = useRef(params);
  paramsRef.current = params;

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
    <K extends keyof CustomLayoutParams>(key: K, value: CustomLayoutParams[K]) => {
      pushState(paramsRef.current);
      setParams((prev) => ({ ...prev, [key]: value }));
    },
    [pushState]
  );

  /**
   * 添加凹槽 -> 默认放置在画布中心
   */
  const addSlot = useCallback((width: number, height?: number) => {
    setParams((prev) => {
      pushState(prev);
      const isCircle = !height || width === height;
      const newSlot: FreeSlot = {
        id: crypto.randomUUID(),
        x: prev.trayWidth / 2,
        y: prev.trayDepth / 2,
        shape: isCircle ? 'circle' : 'ellipse',
        width,
        height: height || width,
        rotation: 0,
      };
      return { ...prev, slots: [...prev.slots, newSlot] };
    });
  }, [pushState]);

  /**
   * 删除凹槽
   */
  const removeSlot = useCallback((id: string) => {
    pushState(paramsRef.current);
    setParams((prev) => ({
      ...prev,
      slots: prev.slots.filter((s) => s.id !== id),
    }));
  }, [pushState]);

  /**
   * 更新凹槽位置（拖拽时频繁调用，不自动记录历史）
   */
  const updateSlotPosition = useCallback((id: string, x: number, y: number) => {
    setParams((prev) => ({
      ...prev,
      slots: prev.slots.map((s) => (s.id === id ? { ...s, x, y } : s)),
    }));
  }, []);

  /**
   * 更新凹槽旋转（旋转时频繁调用，不自动记录历史）
   */
  const updateSlotRotation = useCallback((id: string, rotation: number) => {
    setParams((prev) => ({
      ...prev,
      slots: prev.slots.map((s) => (s.id === id ? { ...s, rotation } : s)),
    }));
  }, []);

  /**
   * 复制凹槽
   */
  const duplicateSlots = useCallback((ids: string[]) => {
    setParams((prev) => {
      pushState(prev);
      const newSlots = [...prev.slots];
      const newlyAddedIds: string[] = [];

      ids.forEach(id => {
        const slotToCopy = prev.slots.find(s => s.id === id);
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
  }, [pushState]);

  /**
   * 裁剪底板：计算当前所有凹槽的最小包围盒，
   * 并将托盘尺寸调整为该包围盒大小 + 边缘间距，
   * 同时自动平移所有凹槽以保持居中。
   */
  const trimBaseplate = useCallback(() => {
    setParams((prev) => {
      if (prev.slots.length === 0) return prev;

      pushState(prev);

      // 1. Calculate bounding box of all slots
      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;

      prev.slots.forEach(slot => {
        const rad = (slot.rotation * Math.PI) / 180;
        const a = (slot.width + HOLE_TOLERANCE) / 2;
        const b = (slot.height + HOLE_TOLERANCE) / 2;
        const halfW = Math.sqrt(Math.pow(a * Math.cos(rad), 2) + Math.pow(b * Math.sin(rad), 2));
        const halfH = Math.sqrt(Math.pow(a * Math.sin(rad), 2) + Math.pow(b * Math.cos(rad), 2));

        minX = Math.min(minX, slot.x - halfW);
        maxX = Math.max(maxX, slot.x + halfW);
        minY = Math.min(minY, slot.y - halfH);
        maxY = Math.max(maxY, slot.y + halfH);
      });

      // 2. Calculate raw dimensions needed
      const rawWidth = (maxX - minX) + prev.spacing * 2;
      const rawDepth = (maxY - minY) + prev.spacing * 2;

      // 3. Round up to nearest integer for clean numbers
      const newTrayWidth = Math.ceil(rawWidth);
      const newTrayDepth = Math.ceil(rawDepth);

      // 4. Calculate shift to center the slots
      // The old bounding box center was ((minX + maxX)/2, (minY + maxY)/2)
      // The new space center is (newTrayWidth/2, newTrayDepth/2)
      const oldCx = (minX + maxX) / 2;
      const oldCy = (minY + maxY) / 2;
      const newCx = newTrayWidth / 2;
      const newCy = newTrayDepth / 2;

      const dx = newCx - oldCx;
      const dy = newCy - oldCy;

      return {
        ...prev,
        trayWidth: newTrayWidth,
        trayDepth: newTrayDepth,
        slots: prev.slots.map(s => ({
          ...s,
          x: s.x + dx,
          y: s.y + dy
        }))
      };
    });
  }, [pushState]);

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
    } catch (err) {
      console.error("生成失败:", err);
    } finally {
      setIsGenerating(false);
    }
  }, [params]);

  // 导出 STL
  const handleExportSTL = useCallback(async () => {
    if (!jscadGeomRef.current || !trayWorkerService) return;
    const filename = generateCustomSTLFilename(
      params.trayWidth,
      params.trayDepth,
      params.slots.length
    );
    try {
      const result = await trayWorkerService.exportSTL(jscadGeomRef.current, filename);
      const url = URL.createObjectURL(result.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("STL导出失败:", err);
    }
  }, [params.trayWidth, params.trayDepth, params.slots.length]);

  return {
    params,
    setParams,
    updateParam,
    addSlot,
    removeSlot,
    updateSlotPosition,
    updateSlotRotation,
    duplicateSlots,
    trimBaseplate,
    saveSnapshot,
    undo,
    canUndo: canUndoFn(),
    threeGeometry,
    volume,
    isGenerating,
    handleGenerate,
    handleExportSTL,
  };
}

