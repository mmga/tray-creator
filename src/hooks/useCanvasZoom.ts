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

/** 画布缩放 & 平移 hook */
export function useCanvasZoom({ baseW, baseH, trayWidth, trayDepth }: UseCanvasZoomOptions) {
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isSpacePressed, setIsSpacePressed] = useState(false);
    const [isPanning, setIsPanning] = useState(false);
    const panStartRef = useRef({ x: 0, y: 0 });

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
        adjustZoom,
        resetZoom,
        minX,
        minY,
    };
}
