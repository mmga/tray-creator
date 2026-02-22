"use client";

import type { FreeSlot } from "@/types/custom-tray";

interface CanvasContextMenuProps {
    contextMenu: { x: number; y: number; slotId: string } | null;
    slots: FreeSlot[];
    onRotationChange: (e: React.ChangeEvent<HTMLInputElement>, id: string) => void;
    onDelete: () => void;
    onClose: (e: React.MouseEvent) => void;
}

export function CanvasContextMenu({
    contextMenu,
    slots,
    onRotationChange,
    onDelete,
    onClose,
}: CanvasContextMenuProps) {
    if (!contextMenu) return null;

    return (
        <div
            className="fixed bg-[#2a2a2e] border border-[#444] rounded shadow-xl z-50 overflow-hidden min-w-[140px] flex flex-col"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(e) => {
                e.stopPropagation();
                onClose(e);
            }}
        >
            <div className="px-3 py-2 border-b border-[#444] bg-[#222]">
                <label className="text-[10px] text-muted-foreground block mb-1">Rotation (°)</label>
                <div className="flex items-center gap-1">
                    <input
                        type="number"
                        className="w-full h-6 bg-[#111] border border-[#555] rounded px-1 text-xs text-secondary-foreground"
                        value={Math.round(
                            slots.find((s) => s.id === contextMenu.slotId)?.rotation || 0,
                        )}
                        onChange={(e) => onRotationChange(e, contextMenu.slotId)}
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            </div>

            <button
                className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-[#3e3e42] hover:text-red-300 transition-colors cursor-pointer"
                onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                }}
            >
                Delete
            </button>
        </div>
    );
}
