"use client";

import { startTransition, useState, useCallback, useRef, useMemo, useDeferredValue, useEffect } from "react";
import type {
  SteppedLayoutParams,
  FreeSlot,
  SteppedSlot,
  SlotGroup,
  GroupOutlinePreview,
} from "@/types/custom-tray";
import {
  getSlotTolerance,
} from "@/lib/config";
import { GROUP_COLORS, STEPPED_LAYOUT_DEFAULTS } from "@/lib/stepped-config";
import { jscadToThreeGeometry } from "@/lib/jscad-to-three";
import { recordPerfSample } from "@/lib/perf";
import { useUndoHistory } from "@/hooks/useUndoHistory";
import { trayWorkerService } from "@/lib/worker/worker-service";
import { useToast } from "@/hooks/useToast";
import type * as THREE from "three";
import type { Geom3 } from "@jscad/modeling/src/geometries/types";
import { downloadParamFile } from "@/lib/param-io";
import type { SymmetryInsertSlot } from "@/lib/layout-symmetry";
import {
  analyzeBridgeWarning,
  getConnectivityRadius,
  type BridgeWarning,
  type ConnectivityCircle,
} from "@/lib/stepped-connectivity";
import {
  createGroupStructureOverrides,
  getEffectiveGroupStructureParams,
} from "@/lib/stepped-group-params";
import { buildSteppedOutlinePreview } from "@/lib/stepped-outline-preview";

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
    updates: { id: string; x: number; y: number; rotation?: number }[],
  ) => void;
  updateMultipleSlotsLive: (
    updates: { id: string; x: number; y: number; rotation?: number }[],
  ) => void;
  updateSlotRotation: (id: string, rotation: number) => void;
  insertSlots: (slots: SymmetryInsertSlot[]) => void;
  duplicateSlots: (ids: string[]) => string[];
  trimBaseplate: () => void;
  // 分组管理
  addGroup: () => void;
  removeGroup: (groupId: string) => void;
  updateGroupHeight: (groupId: string, height: number) => void;
  updateGroupSmoothingOverride: (groupId: string, enabled: boolean) => void;
  updateGroupSmoothingRadius: (groupId: string, radius: number) => void;
  updateGroupDisconnectOverride: (groupId: string, enabled: boolean) => void;
  updateGroupDisconnectDistance: (groupId: string, distance: number) => void;
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
  bridgeWarning: BridgeWarning | null;
  pauseOutlinePreview: () => void;
  resumeOutlinePreview: () => void;
  handleGenerate: () => void;
  handleExportSTL: () => void;
  // 2D 分组轮廓预览
  outlinePreview: GroupOutlinePreview[] | null;
}

export function useSteppedLayout(): UseSteppedLayoutReturn {
  const [params, internalSetParams] = useState<SteppedLayoutParams>(
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
  const paramsVersionRef = useRef(0);
  const [isOutlinePreviewPaused, setIsOutlinePreviewPaused] = useState(false);
  const [outlinePreviewParams, setOutlinePreviewParams] =
    useState<SteppedLayoutParams>(STEPPED_LAYOUT_DEFAULTS);
  const deferredOutlineParams = useDeferredValue(outlinePreviewParams);
  const [outlinePreview, setOutlinePreview] =
    useState<GroupOutlinePreview[] | null>(null);
  const outlinePreviewRequestSeqRef = useRef(0);

  const invalidatePreview = useCallback(() => {
    paramsVersionRef.current += 1;
    setIsPreviewStale(true);
    jscadGeomRef.current = null;
    setVolume(0);
  }, []);

  const setParams = useCallback<
    React.Dispatch<React.SetStateAction<SteppedLayoutParams>>
  >(
    (value) => {
      internalSetParams((prev) =>
        typeof value === "function"
          ? (value as (prevState: SteppedLayoutParams) => SteppedLayoutParams)(
              prev,
            )
          : value,
      );
      invalidatePreview();
    },
    [invalidatePreview],
  );

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

  const calculateEffectiveDimensions = useCallback(
    (current: SteppedLayoutParams = paramsRef.current) => {
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
    },
    [getSlotBoundingHalfSize],
  );

  const effectiveDimensions = useMemo(
    () => calculateEffectiveDimensions(params),
    [calculateEffectiveDimensions, params],
  );

  const saveSnapshot = useCallback(() => {
    pushState(paramsRef.current);
  }, [pushState]);

  const undo = useCallback(() => {
    const prev = popState();
    if (prev) {
      setParams(prev);
    }
  }, [popState, setParams]);

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
    },
    [pushState, setParams],
  );

  const addSlot = useCallback(
    (width: number) => {
      internalSetParams((prev) => {
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
      invalidatePreview();
    },
    [getSlotBoundingHalfSize, invalidatePreview, pushState],
  );

  const removeSlot = useCallback(
    (id: string) => {
      pushState(paramsRef.current);
      internalSetParams((prev) => ({
        ...prev,
        slots: prev.slots.filter((s) => s.id !== id),
      }));
      invalidatePreview();
    },
    [invalidatePreview, pushState],
  );

  const updateSlotPosition = useCallback(
    (id: string, x: number, y: number) => {
      internalSetParams((prev) => ({
        ...prev,
        slots: prev.slots.map((s) => (s.id === id ? { ...s, x, y } : s)),
      }));
      invalidatePreview();
    },
    [invalidatePreview],
  );

  useEffect(() => {
    if (isOutlinePreviewPaused) {
      return;
    }

    setOutlinePreviewParams(params);
  }, [isOutlinePreviewPaused, params]);

  const pauseOutlinePreview = useCallback(() => {
    setIsOutlinePreviewPaused(true);
  }, []);

  const resumeOutlinePreview = useCallback(() => {
    setIsOutlinePreviewPaused(false);
  }, []);

  const applyMultipleSlotUpdates = useCallback(
    (
      updates: { id: string; x: number; y: number; rotation?: number }[],
      saveHistory: boolean,
    ) => {
      internalSetParams((prev) => {
        if (saveHistory) {
          pushState(prev);
        }

        const updatesMap = new Map(updates.map((u) => [u.id, u]));
        return {
          ...prev,
          slots: prev.slots.map((s) => {
            const u = updatesMap.get(s.id);
            return u
              ? {
                  ...s,
                  x: u.x,
                  y: u.y,
                  rotation: u.rotation ?? s.rotation,
                }
              : s;
          }),
        };
      });
      invalidatePreview();
    },
    [invalidatePreview, pushState],
  );

  const updateMultipleSlots = useCallback(
    (updates: { id: string; x: number; y: number; rotation?: number }[]) => {
      applyMultipleSlotUpdates(updates, true);
    },
    [applyMultipleSlotUpdates],
  );

  const updateMultipleSlotsLive = useCallback(
    (updates: { id: string; x: number; y: number; rotation?: number }[]) => {
      applyMultipleSlotUpdates(updates, false);
    },
    [applyMultipleSlotUpdates],
  );

  const updateSlotRotation = useCallback(
    (id: string, rotation: number) => {
      internalSetParams((prev) => ({
        ...prev,
        slots: prev.slots.map((s) => (s.id === id ? { ...s, rotation } : s)),
      }));
      invalidatePreview();
    },
    [invalidatePreview],
  );

  const insertSlots = useCallback(
    (slotsToInsert: SymmetryInsertSlot[]) => {
      if (slotsToInsert.length === 0) return;

      internalSetParams((prev) => {
        pushState(prev);
        const newSlots: SteppedSlot[] = slotsToInsert.map((slot) => ({
          id: crypto.randomUUID(),
          x: slot.x,
          y: slot.y,
          shape: slot.shape,
          width: slot.width,
          height: slot.height,
          rotation: slot.rotation,
          groupId: slot.groupId ?? prev.activeGroupId,
        }));

        return {
          ...prev,
          slots: [...prev.slots, ...newSlots],
        };
      });
      invalidatePreview();
    },
    [invalidatePreview, pushState],
  );

  const duplicateSlots = useCallback(
    (ids: string[]): string[] => {
      const newIds: string[] = [];
      ids.forEach(() => {
        newIds.push(crypto.randomUUID());
      });
      internalSetParams((prev) => {
        pushState(prev);
        const newSlots = [...prev.slots];

        ids.forEach((id, i) => {
          const slotToCopy = prev.slots.find((s) => s.id === id);
          if (slotToCopy) {
            newSlots.push({
              ...slotToCopy,
              id: newIds[i],
              x: slotToCopy.x + 10,
              y: slotToCopy.y - 10,
            });
          }
        });

        return { ...prev, slots: newSlots };
      });
      invalidatePreview();
      return newIds;
    },
    [invalidatePreview, pushState],
  );

  const addGroup = useCallback(() => {
    internalSetParams((prev) => {
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
        ...createGroupStructureOverrides({
          smoothingRadius: prev.smoothingRadius,
          disconnectDistance: prev.disconnectDistance,
        }),
      };
      return {
        ...prev,
        groups: [...prev.groups, newGroup],
        activeGroupId: newGroup.id,
      };
    });
    invalidatePreview();
  }, [invalidatePreview, pushState]);

  const removeGroup = useCallback(
    (groupId: string) => {
      internalSetParams((prev) => {
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
      invalidatePreview();
    },
    [invalidatePreview, pushState],
  );

  const updateGroupHeight = useCallback(
    (groupId: string, height: number) => {
      pushState(paramsRef.current);
      internalSetParams((prev) => ({
        ...prev,
        groups: prev.groups.map((g) =>
          g.id === groupId ? { ...g, bottomHeight: height } : g,
        ),
      }));
      invalidatePreview();
    },
    [invalidatePreview, pushState],
  );

  const updateGroupSmoothingOverride = useCallback(
    (groupId: string, enabled: boolean) => {
      pushState(paramsRef.current);
      internalSetParams((prev) => ({
        ...prev,
        groups: prev.groups.map((g) =>
          g.id === groupId ? { ...g, useGroupSmoothingRadius: enabled } : g,
        ),
      }));
      invalidatePreview();
    },
    [invalidatePreview, pushState],
  );

  const updateGroupSmoothingRadius = useCallback(
    (groupId: string, radius: number) => {
      pushState(paramsRef.current);
      internalSetParams((prev) => ({
        ...prev,
        groups: prev.groups.map((g) =>
          g.id === groupId ? { ...g, groupSmoothingRadius: radius } : g,
        ),
      }));
      invalidatePreview();
    },
    [invalidatePreview, pushState],
  );

  const updateGroupDisconnectOverride = useCallback(
    (groupId: string, enabled: boolean) => {
      pushState(paramsRef.current);
      internalSetParams((prev) => ({
        ...prev,
        groups: prev.groups.map((g) =>
          g.id === groupId ? { ...g, useGroupDisconnectDistance: enabled } : g,
        ),
      }));
      invalidatePreview();
    },
    [invalidatePreview, pushState],
  );

  const updateGroupDisconnectDistance = useCallback(
    (groupId: string, distance: number) => {
      pushState(paramsRef.current);
      internalSetParams((prev) => ({
        ...prev,
        groups: prev.groups.map((g) =>
          g.id === groupId ? { ...g, groupDisconnectDistance: distance } : g,
        ),
      }));
      invalidatePreview();
    },
    [invalidatePreview, pushState],
  );

  const setActiveGroup = useCallback((groupId: string) => {
    internalSetParams((prev) => ({ ...prev, activeGroupId: groupId }));
  }, []);

  const moveSelectedSlotsToGroup = useCallback(
    (ids: string[], targetGroupId: string) => {
      pushState(paramsRef.current);
      const idSet = new Set(ids);
      internalSetParams((prev) => ({
        ...prev,
        slots: prev.slots.map((s) =>
          idSet.has(s.id) ? { ...s, groupId: targetGroupId } : s,
        ),
      }));
      invalidatePreview();
    },
    [invalidatePreview, pushState],
  );

  const reorderGroups = useCallback(
    (fromIndex: number, toIndex: number) => {
      internalSetParams((prev) => {
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
    internalSetParams((prev) => {
      if (prev.slots.length === 0) return prev;
      pushState(prev);

      const dims = calculateEffectiveDimensions(prev);
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
    invalidatePreview();
  }, [calculateEffectiveDimensions, invalidatePreview, pushState]);

  const handleGenerate = useCallback(async () => {
    if (!trayWorkerService) return;
    const requestVersion = paramsVersionRef.current;
    setIsGenerating(true);
    try {
      const result = await trayWorkerService.generateStepped(paramsRef.current);
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
    const exportWidth =
      effectiveDimensions.width > 0
        ? effectiveDimensions.width
        : currentParams.trayWidth;
    const exportDepth =
      effectiveDimensions.depth > 0
        ? effectiveDimensions.depth
        : currentParams.trayDepth;
    const filename = `tray_stepped_${exportWidth}x${exportDepth}_${currentParams.slots.length}slots.stl`;
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
      downloadParamFile("stepped", currentParams, jsonFilename);
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
    isPreviewStale,
    toast,
  ]);

  useEffect(() => {
    const requestSeq = outlinePreviewRequestSeqRef.current + 1;
    outlinePreviewRequestSeqRef.current = requestSeq;
    if (
      deferredOutlineParams.slots.length === 0 ||
      deferredOutlineParams.groups.length === 0
    ) {
      startTransition(() => {
        setOutlinePreview(null);
      });
      return;
    }

    let isCancelled = false;
    const applyOutlinePreview = (nextPreview: GroupOutlinePreview[] | null) => {
      if (
        isCancelled ||
        outlinePreviewRequestSeqRef.current !== requestSeq
      ) {
        return;
      }

      startTransition(() => {
        setOutlinePreview(nextPreview);
      });
    };

    const runOutlinePreview = async () => {
      try {
        if (trayWorkerService) {
          const result =
            await trayWorkerService.generateSteppedOutlinePreview(
              deferredOutlineParams,
            );
          if (result.durationMs >= 0) {
            recordPerfSample("stepped.outline", result.durationMs);
          }
          applyOutlinePreview(result.outlinePreview);
          return;
        }

        const startedAt =
          typeof performance !== "undefined" ? performance.now() : 0;
        const nextPreview =
          buildSteppedOutlinePreview(deferredOutlineParams);
        if (typeof performance !== "undefined") {
          recordPerfSample(
            "stepped.outline",
            performance.now() - startedAt,
          );
        }
        applyOutlinePreview(nextPreview);
      } catch (err) {
        if (
          isCancelled ||
          outlinePreviewRequestSeqRef.current !== requestSeq
        ) {
          return;
        }

        console.error("轮廓预览生成失败:", err);
      }
    };

    void runOutlinePreview();

    return () => {
      isCancelled = true;
    };
  }, [deferredOutlineParams]);

  const bridgeWarning = useMemo<BridgeWarning | null>(() => {
    const slotsByGroupId = new Map<string, SteppedSlot[]>();

    params.slots.forEach((slot) => {
      const groupedSlots = slotsByGroupId.get(slot.groupId);
      if (groupedSlots) {
        groupedSlots.push(slot);
      } else {
        slotsByGroupId.set(slot.groupId, [slot]);
      }
    });

    const higherSlotsByGroupId = new Map<string, SteppedSlot[]>();
    const groupsByHeightDesc = [...params.groups].sort(
      (a, b) => b.bottomHeight - a.bottomHeight,
    );
    let higherSlots: SteppedSlot[] = [];

    for (let index = 0; index < groupsByHeightDesc.length; ) {
      const currentHeight = groupsByHeightDesc[index].bottomHeight;
      const sameHeightGroups: typeof groupsByHeightDesc = [];

      while (
        index < groupsByHeightDesc.length &&
        groupsByHeightDesc[index].bottomHeight === currentHeight
      ) {
        sameHeightGroups.push(groupsByHeightDesc[index]);
        index += 1;
      }

      sameHeightGroups.forEach((group) => {
        higherSlotsByGroupId.set(group.id, higherSlots);
      });

      const sameHeightSlots = sameHeightGroups.flatMap(
        (group) => slotsByGroupId.get(group.id) ?? [],
      );
      higherSlots = [...higherSlots, ...sameHeightSlots];
    }

    const groupsByHeightAsc = [...params.groups].sort(
      (a, b) => a.bottomHeight - b.bottomHeight,
    );

    for (const group of groupsByHeightAsc) {
      const ownSlots = slotsByGroupId.get(group.id) ?? [];
      if (ownSlots.length === 0) continue;

      const effectiveParams = getEffectiveGroupStructureParams(group, params);
      const circles: ConnectivityCircle[] = [
        ...ownSlots,
        ...(higherSlotsByGroupId.get(group.id) ?? []),
      ].map((slot) => ({
        id: slot.id,
        cx: slot.x,
        cy: slot.y,
        rOuter: getConnectivityRadius(
          slot.width,
          slot.height,
          params.spacing,
          getSlotTolerance(slot.width),
          getSlotTolerance(slot.height),
        ),
      }));

      const warning = analyzeBridgeWarning(
        circles,
        effectiveParams.smoothingRadius,
        effectiveParams.disconnectDistance,
        { groupId: group.id, groupName: group.name },
      );

      if (warning) {
        return warning;
      }
    }

    return null;
  }, [params]);

  return {
    params,
    setParams,
    updateParam,
    addSlot,
    removeSlot,
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
    bridgeWarning,
    pauseOutlinePreview,
    resumeOutlinePreview,
    handleGenerate,
    handleExportSTL,
    outlinePreview,
  };
}
