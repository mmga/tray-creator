"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import type {
  SteppedLayoutParams,
  SteppedSlot,
  FreeSlot,
  SlotGroup,
  GroupOutlinePreview,
} from "@/types/custom-tray";
import {
  STEPPED_LAYOUT_DEFAULTS,
  GROUP_COLORS,
  getSlotTolerance,
} from "@/lib/config";
import { jscadToThreeGeometry } from "@/lib/jscad-to-three";
import { useUndoHistory } from "@/hooks/useUndoHistory";
import { trayWorkerService } from "@/lib/worker/worker-service";
import { useToast } from "@/hooks/useToast";
import type * as THREE from "three";
import type { Geom3 } from "@jscad/modeling/src/geometries/types";
import { generateOutline, type OutlineCircle } from "@/lib/outline-geometry";

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
    updates: { id: string; x: number; y: number }[],
  ) => void;
  updateSlotRotation: (id: string, rotation: number) => void;
  duplicateSlots: (ids: string[]) => void;
  trimBaseplate: () => void;
  // 分组管理
  addGroup: () => void;
  removeGroup: (groupId: string) => void;
  updateGroupHeight: (groupId: string, height: number) => void;
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
  handleGenerate: () => void;
  handleExportSTL: () => void;
  // 2D 分组轮廓预览
  outlinePreview: GroupOutlinePreview[] | null;
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
    const boundarySpacing = current.spacing;
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
  }, [getSlotBoundingHalfSize]);

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
          return { ...prev, spacing: nextSpacing };
        }

        return { ...prev, [key]: value };
      });
      setIsPreviewStale(true);
    },
    [pushState],
  );

  const addSlot = useCallback(
    (width: number) => {
      setParams((prev) => {
        pushState(prev);
        const newSlotHalfW = (width + getSlotTolerance(width)) / 2;

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
          shape: "circle",
          width,
          height: width,
          rotation: 0,
          groupId: prev.activeGroupId,
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

  const addGroup = useCallback(() => {
    setParams((prev) => {
      pushState(prev);
      const usedColors = prev.groups.map((g) => g.color);
      const nextColor =
        GROUP_COLORS.find((c) => !usedColors.includes(c)) ??
        GROUP_COLORS[prev.groups.length % GROUP_COLORS.length];
      const newGroup: SlotGroup = {
        id: crypto.randomUUID(),
        name: `组 ${prev.groups.length + 1}`,
        color: nextColor,
        bottomHeight:
          Math.max(...prev.groups.map((g) => g.bottomHeight), 0) + 5,
      };
      return {
        ...prev,
        groups: [...prev.groups, newGroup],
        activeGroupId: newGroup.id,
      };
    });
  }, [pushState]);

  const removeGroup = useCallback(
    (groupId: string) => {
      setParams((prev) => {
        if (prev.groups.length <= 1) return prev; // 不能删除最后一个组
        pushState(prev);
        const newGroups = prev.groups.filter((g) => g.id !== groupId);
        const newSlots = prev.slots.filter((s) => s.groupId !== groupId);
        const newActiveGroupId =
          prev.activeGroupId === groupId
            ? (newGroups[0]?.id ?? "")
            : prev.activeGroupId;
        return {
          ...prev,
          groups: newGroups,
          slots: newSlots,
          activeGroupId: newActiveGroupId,
        };
      });
      setIsPreviewStale(true);
    },
    [pushState],
  );

  const updateGroupHeight = useCallback(
    (groupId: string, height: number) => {
      pushState(paramsRef.current);
      setParams((prev) => ({
        ...prev,
        groups: prev.groups.map((g) =>
          g.id === groupId ? { ...g, bottomHeight: height } : g,
        ),
      }));
      setIsPreviewStale(true);
    },
    [pushState],
  );

  const setActiveGroup = useCallback((groupId: string) => {
    setParams((prev) => ({ ...prev, activeGroupId: groupId }));
  }, []);

  const moveSelectedSlotsToGroup = useCallback(
    (ids: string[], targetGroupId: string) => {
      pushState(paramsRef.current);
      const idSet = new Set(ids);
      setParams((prev) => ({
        ...prev,
        slots: prev.slots.map((s) =>
          idSet.has(s.id) ? { ...s, groupId: targetGroupId } : s,
        ),
      }));
      setIsPreviewStale(true);
    },
    [pushState],
  );

  const reorderGroups = useCallback(
    (fromIndex: number, toIndex: number) => {
      setParams((prev) => {
        if (
          fromIndex < 0 ||
          fromIndex >= prev.groups.length ||
          toIndex < 0 ||
          toIndex >= prev.groups.length ||
          fromIndex === toIndex
        ) {
          return prev;
        }
        pushState(prev);
        const newGroups = [...prev.groups];
        const [moved] = newGroups.splice(fromIndex, 1);
        newGroups.splice(toIndex, 0, moved);
        return { ...prev, groups: newGroups };
      });
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

  // 自动计算分组轮廓预览（每组纳入更高组作上下文，匹配 3D 建模逻辑）
  const outlinePreviewAuto = useMemo<GroupOutlinePreview[] | null>(() => {
    if (params.slots.length === 0 || params.groups.length === 0) return null;

    const result: GroupOutlinePreview[] = [];

    for (const group of params.groups) {
      const ownSlots = params.slots.filter((s) => s.groupId === group.id);
      if (ownSlots.length === 0) continue;

      // 纳入所有高度严格更高的组的凹槽作为轮廓上下文（与 3D 建模保持一致）
      // 这样低组的轮廓自然包裹更高组的圆柱脚印，体现平滑过渡效果
      const higherSlots = params.slots.filter((s) => {
        if (s.groupId === group.id) return false;
        const otherGroup = params.groups.find((g) => g.id === s.groupId);
        return otherGroup && otherGroup.bottomHeight > group.bottomHeight;
      });

      const circles: OutlineCircle[] = [...ownSlots, ...higherSlots].map(
        (slot) => ({
          cx: slot.x,
          cy: slot.y,
          rOuter:
            (slot.width + getSlotTolerance(slot.width)) / 2 + params.spacing,
        }),
      );

      const outline = generateOutline(circles, params.smoothingRadius, 64);
      if (outline && outline.points.length >= 3) {
        result.push({
          groupId: group.id,
          color: group.color,
          bottomHeight: group.bottomHeight,
          points: outline.points,
        });
      }
    }

    // 按高度升序排列：低组先渲染，高组后渲染覆盖，重叠处显示最高组颜色
    result.sort((a, b) => a.bottomHeight - b.bottomHeight);

    return result.length > 0 ? result : null;
  }, [params]);

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
    addGroup,
    removeGroup,
    updateGroupHeight,
    setActiveGroup,
    moveSelectedSlotsToGroup,
    reorderGroups,
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
    outlinePreview: outlinePreviewAuto,
  };
}
