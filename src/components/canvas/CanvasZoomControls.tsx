"use client";

import { RotateCcw } from "lucide-react";

interface CanvasZoomControlsProps {
    onResetZoom: () => void;
    onShowHints: () => void;
}

export function CanvasZoomControls({ onResetZoom, onShowHints }: CanvasZoomControlsProps) {
    return (
        <div className="absolute bottom-4 right-4 flex gap-1.5 bg-[#1c1a16] border border-[#2e2a24] p-1.5 rounded shadow-lg z-10">
            <button
                aria-label="快捷键帮助"
                className="p-2.5 lg:p-1.5 hover:bg-[#2e2a24] text-muted-foreground hover:text-primary rounded transition-colors flex items-center justify-center cursor-pointer min-w-[44px] min-h-[44px] lg:min-w-0 lg:min-h-0"
                onClick={onShowHints}
                title="快捷键帮助"
            >
                <span className="w-4 h-4 text-[13px] font-mono leading-none flex items-center justify-center font-bold">
                    ?
                </span>
            </button>
            <button
                aria-label="复原缩放"
                className="gap-1.5 p-2.5 lg:p-1.5 hover:bg-[#2e2a24] text-muted-foreground hover:text-primary rounded transition-colors flex items-center justify-center cursor-pointer min-h-[44px] lg:min-h-0"
                onClick={onResetZoom}
                title="复原缩放（恢复至 100%）"
            >
                <RotateCcw className="w-4 h-4" aria-hidden="true" />
                <span className="text-xs font-medium whitespace-nowrap">复原缩放</span>
            </button>
        </div>
    );
}
