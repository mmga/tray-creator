"use client";

import { useState, useCallback, useRef } from "react";

interface UseCanvasZoomOptions {
  /** 画布基准宽度 (mm) */
  baseW: number;
  /** 画布基准高度 (mm) */
  baseH: number;
  /** 托盘宽度 (mm) */
  trayWidth: number;
  /** 托盘深度 (mm) */
  trayDepth: number;
}

/** 触摸点的最小接口（兼容 React.Touch 和 DOM Touch） */
interface TouchPoint {
  clientX: number;
  clientY: number;
}

/** 计算两个触摸点之间的距离 */
function getTouchDistance(t1: TouchPoint, t2: TouchPoint) {
  const dx = t1.clientX - t2.clientX;
  const dy = t1.clientY - t2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

/** 计算两个触摸点的中心 */
function getTouchCenter(t1: TouchPoint, t2: TouchPoint) {
  return {
    x: (t1.clientX + t2.clientX) / 2,
    y: (t1.clientY + t2.clientY) / 2,
  };
}

/** 画布缩放 & 平移 hook（支持鼠标滚轮 + 双指手势） */
export function useCanvasZoom({
  baseW,
  baseH,
  trayWidth,
  trayDepth,
}: UseCanvasZoomOptions) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });

  // 双指手势状态
  const pinchRef = useRef<{
    initialDist: number;
    initialZoom: number;
    lastCenter: { x: number; y: number };
  } | null>(null);

  const viewW = baseW / zoom;
  const viewH = baseH / zoom;
  const minX = trayWidth / 2 - viewW / 2 - pan.x;
  const minY = trayDepth / 2 - viewH / 2 - pan.y;
  const viewBox = `${minX} ${minY} ${viewW} ${viewH}`;

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) e.preventDefault();
    const delta = -e.deltaY;
    const factor = 0.1;
    setZoom((z) => {
      const newZoom = z + (delta > 0 ? factor : -factor);
      return Math.min(Math.max(0.5, newZoom), 5);
    });
  }, []);

  /** 双指触摸开始 */
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dist = getTouchDistance(e.touches[0], e.touches[1]);
        const center = getTouchCenter(e.touches[0], e.touches[1]);
        pinchRef.current = {
          initialDist: dist,
          initialZoom: zoom,
          lastCenter: center,
        };
      }
    },
    [zoom],
  );

  /** 双指触摸移动（缩放 + 平移） */
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault();
      const dist = getTouchDistance(e.touches[0], e.touches[1]);
      const center = getTouchCenter(e.touches[0], e.touches[1]);

      // 缩放
      const scale = dist / pinchRef.current.initialDist;
      const newZoom = Math.min(
        Math.max(0.5, pinchRef.current.initialZoom * scale),
        5,
      );
      setZoom(newZoom);

      // 双指平移
      const dx = center.x - pinchRef.current.lastCenter.x;
      const dy = center.y - pinchRef.current.lastCenter.y;
      // 将屏幕像素差转换为 SVG 坐标差（近似）
      const svgScale = newZoom; // viewBox 缩放因子
      setPan((prev) => ({
        x: prev.x + dx / (svgScale * 2),
        y: prev.y + dy / (svgScale * 2),
      }));
      pinchRef.current.lastCenter = center;
    }
  }, []);

  /** 双指触摸结束 */
  const handleTouchEnd = useCallback(() => {
    pinchRef.current = null;
  }, []);

  const adjustZoom = (amount: number) => {
    setZoom((z) => Math.min(Math.max(0.5, z + amount), 5));
  };

  const resetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  return {
    zoom,
    pan,
    setPan,
    viewBox,
    viewW,
    viewH,
    isSpacePressed,
    setIsSpacePressed,
    isPanning,
    setIsPanning,
    panStartRef,
    handleWheel,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    adjustZoom,
    resetZoom,
    minX,
    minY,
  };
}
