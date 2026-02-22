"use client";

import { Maximize } from "lucide-react";

interface CanvasZoomControlsProps {
    onResetZoom: () => void;
    onShowHints: () => void;
}

export function CanvasZoomControls({ onResetZoom, onShowHints }: CanvasZoomControlsProps) {
    return (
        <div className="absolute bottom-4 right-4 flex gap-1.5 bg-[#1c1a16] border border-[#2e2a24] p-1.5 rounded shadow-lg z-10">
            <button
                className="p-1.5 hover:bg-[#2e2a24] text-muted-foreground hover:text-primary rounded transition-colors flex items-center justify-center cursor-pointer"
                onClick={onShowHints}
                title="快捷键帮助"
            >
                <span className="w-4 h-4 text-[13px] font-mono leading-none flex items-center justify-center font-bold">
                    ?
                </span>
            </button>
            <button
                className="p-1.5 hover:bg-[#2e2a24] text-muted-foreground hover:text-primary rounded transition-colors flex items-center justify-center cursor-pointer"
                onClick={onResetZoom}
                title="重置视图"
            >
                <Maximize className="w-4 h-4" />
            </button>
        </div>
    );
}
