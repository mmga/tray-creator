"use client";

import type { FreeSlot } from "@/types/custom-tray";

interface CanvasStatusBarProps {
    trayWidth: number;
    trayDepth: number;
    zoom: number;
    selectedIds: Set<string>;
    slots: FreeSlot[];
    collisionErrorCount?: number;
}

export function CanvasStatusBar({
    trayWidth,
    trayDepth,
    zoom,
    selectedIds,
    slots,
    collisionErrorCount = 0,
}: CanvasStatusBarProps) {
    return (
        <div className="absolute bottom-2 left-2 right-12 flex items-end justify-between pointer-events-none px-2 pb-1">
            <div className="text-[10px] text-muted-foreground/60 font-mono flex gap-4">
                <span>
                    CANVAS: {trayWidth}mm × {trayDepth}mm
                </span>
                <span>ZOOM: {Math.round(zoom * 100)}%</span>
                <span className={collisionErrorCount > 0 ? "text-red-400" : "text-emerald-400"}>
                    ERRORS: {collisionErrorCount}
                </span>

                {selectedIds.size === 1 &&
                    (() => {
                        const s = slots.find((slot) => slot.id === Array.from(selectedIds)[0]);
                        if (!s) return null;
                        return (
                            <span className="text-orange-400">
                                ID:{s.id.slice(0, 4)} | X:{s.x.toFixed(1)} Y:{s.y.toFixed(1)} | W:{s.width} H:
                                {s.height} | R:{Math.round(s.rotation)}°
                            </span>
                        );
                    })()}

                {selectedIds.size > 1 && (
                    <span className="text-orange-400">{selectedIds.size} ITEMS SELECTED</span>
                )}
            </div>
        </div>
    );
}
