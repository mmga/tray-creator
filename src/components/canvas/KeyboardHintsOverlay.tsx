"use client";

interface KeyboardHintsOverlayProps {
    showHints: boolean;
    onClose: () => void;
}

export function KeyboardHintsOverlay({ showHints, onClose }: KeyboardHintsOverlayProps) {
    if (!showHints) return null;

    return (
        <div
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-auto"
            onClick={onClose}
        >
            <div
                className="bg-[#12110e] border border-[#2e2a24] rounded-sm p-6 max-w-sm shadow-xl"
                onClick={(e) => e.stopPropagation()}
            >
                <h3 className="text-sm font-bold text-primary tracking-[0.15em] mb-4 text-center">
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
                    按 ? 或点击外部关闭
                </p>
            </div>
        </div>
    );
}
