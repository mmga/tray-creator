"use client";

import { useEffect, useEffectEvent, useId, useRef } from "react";
import { X } from "lucide-react";

interface KeyboardHintsOverlayProps {
    showHints: boolean;
    onClose: () => void;
}

export function KeyboardHintsOverlay({ showHints, onClose }: KeyboardHintsOverlayProps) {
    const titleId = useId();
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const closeOverlay = useEffectEvent(() => onClose());

    useEffect(() => {
        if (!showHints) return;

        const previouslyFocused = document.activeElement;
        closeButtonRef.current?.focus();

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Tab") {
                event.preventDefault();
                closeButtonRef.current?.focus();
                return;
            }
            if (event.key !== "Escape") return;
            event.preventDefault();
            closeOverlay();
        };
        window.addEventListener("keydown", handleKeyDown);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            if (
                previouslyFocused instanceof HTMLElement
                && document.contains(previouslyFocused)
            ) {
                previouslyFocused.focus();
            }
        };
    }, [showHints]);

    if (!showHints) return null;

    return (
        <div
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-auto"
            role="presentation"
            onClick={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className="relative bg-[#12110e] border border-[#2e2a24] rounded-sm p-6 max-w-sm shadow-xl"
            >
                <button
                    ref={closeButtonRef}
                    type="button"
                    aria-label="关闭快捷键帮助"
                    onClick={onClose}
                    className="absolute right-2 top-2 flex size-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-[#1c1a16] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                >
                    <X aria-hidden="true" className="size-4" />
                </button>
                <h3 id={titleId} className="text-sm font-bold text-primary tracking-[0.15em] mb-4 text-center">
                    快捷键
                </h3>
                <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[11px]">
                    <kbd className="px-1.5 py-0.5 bg-[#1c1a16] border border-[#2e2a24] rounded text-center font-mono text-primary/80">
                        Delete
                    </kbd>
                    <span className="text-muted-foreground">删除选中凹槽</span>
                    <kbd className="px-1.5 py-0.5 bg-[#1c1a16] border border-[#2e2a24] rounded text-center font-mono text-primary/80">
                        Ctrl+Z
                    </kbd>
                    <span className="text-muted-foreground">撤销</span>
                    <kbd className="px-1.5 py-0.5 bg-[#1c1a16] border border-[#2e2a24] rounded text-center font-mono text-primary/80">
                        ↑ ↓ ← →
                    </kbd>
                    <span className="text-muted-foreground">微调位置（1mm）</span>
                    <kbd className="px-1.5 py-0.5 bg-[#1c1a16] border border-[#2e2a24] rounded text-center font-mono text-primary/80">
                        Space + 拖
                    </kbd>
                    <span className="text-muted-foreground">平移画布</span>
                    <kbd className="px-1.5 py-0.5 bg-[#1c1a16] border border-[#2e2a24] rounded text-center font-mono text-primary/80">
                        滚轮
                    </kbd>
                    <span className="text-muted-foreground">缩放画布</span>
                    <kbd className="px-1.5 py-0.5 bg-[#1c1a16] border border-[#2e2a24] rounded text-center font-mono text-primary/80">
                        Esc
                    </kbd>
                    <span className="text-muted-foreground">取消选择</span>
                    <kbd className="px-1.5 py-0.5 bg-[#1c1a16] border border-[#2e2a24] rounded text-center font-mono text-primary/80">
                        框选
                    </kbd>
                    <span className="text-muted-foreground">空白处拖拽选择多个</span>
                </div>
                <p className="text-[10px] text-muted-foreground/50 text-center mt-4">
                    按 Esc、? 或点击外部关闭
                </p>
            </div>
        </div>
    );
}
