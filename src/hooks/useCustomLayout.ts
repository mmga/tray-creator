"use client";

import { useState, useCallback, useRef } from "react";
import type { CustomLayoutParams, FreeSlot } from "@/types/custom-tray";
import { CUSTOM_LAYOUT_DEFAULTS, HOLE_TOLERANCE } from "@/lib/config";
import { createCustomTrayModel } from "@/lib/custom-tray-model";
import { jscadToThreeGeometry } from "@/lib/jscad-to-three";
import { exportToSTL, generateCustomSTLFilename } from "@/lib/stl-export";
import { useUndoHistory } from "@/hooks/useUndoHistory";
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
  // 历史操作
  saveSnapshot: () => void;
  undo: () => void;
  canUndo: boolean;
  // 3D 相关
  threeGeometry: THREE.BufferGeometry | null;
  isGenerating: boolean;
  handleGenerate: () => void;
  handleExportSTL: () => void;
}

export function useCustomLayout(): UseCustomLayoutReturn {
  const [params, setParams] = useState<CustomLayoutParams>(CUSTOM_LAYOUT_DEFAULTS);
  const [threeGeometry, setThreeGeometry] = useState<THREE.BufferGeometry | null>(null);
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
        diameter: width, // 兼容旧代码
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

  // 手动触发生成 3D 模型
  const handleGenerate = useCallback(() => {
    setIsGenerating(true);
    setTimeout(() => {
      try {
        const jscadGeom = createCustomTrayModel(params);
        jscadGeomRef.current = jscadGeom;
        const threeGeom = jscadToThreeGeometry(jscadGeom);
        setThreeGeometry((prev) => {
          prev?.dispose();
          return threeGeom;
        });
      } catch (e) {
        console.error("Failed to generate custom model:", e);
      } finally {
        setIsGenerating(false);
      }
    }, 50);
  }, [params]);

  // 导出 STL
  const handleExportSTL = useCallback(() => {
    if (!jscadGeomRef.current) return;
    const filename = generateCustomSTLFilename(
      params.trayWidth,
      params.trayDepth,
      params.slots.length
    );
    exportToSTL(jscadGeomRef.current, filename);
  }, [params]);

  return {
    params,
    setParams,
    updateParam,
    addSlot,
    removeSlot,
    updateSlotPosition,
    updateSlotRotation,
    saveSnapshot,
    undo,
    canUndo: canUndoFn(),
    threeGeometry,
    isGenerating,
    handleGenerate,
    handleExportSTL,
  };
}

