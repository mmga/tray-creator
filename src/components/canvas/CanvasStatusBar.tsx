"use client";

import { useSyncExternalStore } from "react";
import type { FreeSlot } from "@/types/custom-tray";
import { getEllipseBoundingBox } from "@/lib/canvas-slot-geometry";
import {
    getPerfMetricsSnapshot,
    subscribePerfMetrics,
    type PerfMetricName,
} from "@/lib/perf";
import { getFreeSlotProfileGeometry } from "@/lib/slot-definitions";

interface CanvasStatusBarProps {
    trayWidth: number;
    trayDepth: number;
    zoom: number;
    selectedIds: Set<string>;
    slots: FreeSlot[];
    collisionErrorCount?: number;
    footprintWarnings?: readonly string[];
}

const PERF_LABELS: Record<PerfMetricName, string> = {
    "canvas.pointermove": "MOVE",
    "canvas.collision": "COLL",
    "stepped.outline": "OUTL",
};

function formatPerfMs(value: number) {
    return value >= 10 ? value.toFixed(1) : value.toFixed(2);
}

function getSlotBounds(slot: FreeSlot) {
    const profile = getFreeSlotProfileGeometry(slot);
    const { halfW, halfH } = getEllipseBoundingBox(
        profile.width,
        profile.height,
        slot.rotation,
        slot.shape,
        profile.profileExponent,
        profile.outerOffset,
    );

    return {
        minX: slot.x - halfW,
        maxX: slot.x + halfW,
        minY: slot.y - halfH,
        maxY: slot.y + halfH,
    };
}

function getAxisBoundaryGap(
    firstMin: number,
    firstMax: number,
    secondMin: number,
    secondMax: number,
) {
    if (firstMax < secondMin) {
        return secondMin - firstMax;
    }

    if (secondMax < firstMin) {
        return firstMin - secondMax;
    }

    return 0;
}

function getTwoSlotBoundaryDistance(slots: FreeSlot[]) {
    if (slots.length !== 2) {
        return null;
    }

    const first = getSlotBounds(slots[0]);
    const second = getSlotBounds(slots[1]);
    const gapX = getAxisBoundaryGap(first.minX, first.maxX, second.minX, second.maxX);
    const gapY = getAxisBoundaryGap(first.minY, first.maxY, second.minY, second.maxY);

    return {
        gapX,
        gapY,
        distance: Math.hypot(gapX, gapY),
    };
}

export function CanvasStatusBar({
    trayWidth,
    trayDepth,
    zoom,
    selectedIds,
    slots,
    collisionErrorCount = 0,
    footprintWarnings = [],
}: CanvasStatusBarProps) {
    const perfState = useSyncExternalStore(
        subscribePerfMetrics,
        getPerfMetricsSnapshot,
        getPerfMetricsSnapshot,
    );
    const selectedId = selectedIds.size === 1 ? Array.from(selectedIds)[0] : null;
    const selectedSlot = selectedId
        ? slots.find((slot) => slot.id === selectedId) ?? null
        : null;
    const selectedSlots =
        selectedIds.size === 2
            ? Array.from(selectedIds)
                .map((id) => slots.find((slot) => slot.id === id))
                .filter((slot): slot is FreeSlot => Boolean(slot))
            : [];
    const boundaryDistance = getTwoSlotBoundaryDistance(selectedSlots);

    return (
        <div className="pointer-events-none absolute bottom-2 left-1 right-12 flex min-w-0 items-end justify-between gap-2 px-2 pb-1 lg:left-2 lg:gap-4">
            <div className="flex min-w-0 flex-1 flex-wrap gap-x-2 gap-y-1 font-mono text-[10px] text-muted-foreground/60 lg:gap-x-4">
                <span className="hidden sm:inline">
                    CANVAS: {trayWidth}mm × {trayDepth}mm
                </span>
                <span>ZOOM: {Math.round(zoom * 100)}%</span>
                <span
                    role="status"
                    aria-live="polite"
                    aria-label={`布局碰撞错误：${collisionErrorCount}`}
                    className={collisionErrorCount > 0 ? "text-red-400" : "text-emerald-400"}
                >
                    ERRORS: {collisionErrorCount}
                </span>
                {footprintWarnings.length > 0 ? (
                    <span role="status" aria-live="polite" className="contents">
                        {footprintWarnings.map((warning, index) => (
                            <span key={`${warning}-${index}`} className="text-amber-300">
                                贴合轮廓警告：{warning}
                            </span>
                        ))}
                    </span>
                ) : null}

                {selectedSlot && (
                    <span className="max-w-full truncate text-orange-400">
                        ID:{selectedSlot.id.slice(0, 4)} | X:{selectedSlot.x.toFixed(1)} Y:{selectedSlot.y.toFixed(1)} | W:{selectedSlot.width} H:
                        {selectedSlot.height} | R:{Math.round(selectedSlot.rotation)}°
                    </span>
                )}

                {selectedIds.size > 1 && (
                    <span className="max-w-full truncate text-orange-400">
                        {selectedIds.size} ITEMS SELECTED
                        {boundaryDistance
                            ? ` | EDGE GAP: ${boundaryDistance.distance.toFixed(1)}mm | X:${boundaryDistance.gapX.toFixed(1)} Y:${boundaryDistance.gapY.toFixed(1)}`
                            : ""}
                    </span>
                )}
            </div>

            {perfState.enabled && perfState.metrics.length > 0 && (
                <div className="hidden shrink-0 flex-wrap justify-end gap-3 font-mono text-[10px] text-slate-300/80 md:flex">
                    <span className="text-slate-500">PERF last/avg/max</span>
                    {perfState.metrics.map((metric) => (
                        <span key={metric.name} className="text-sky-300/90">
                            {PERF_LABELS[metric.name]} {formatPerfMs(metric.last)}/{formatPerfMs(metric.avg)}/{formatPerfMs(metric.max)}ms
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}
