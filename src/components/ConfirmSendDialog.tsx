"use client";

import { useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, X, Send } from "lucide-react";

interface ConfirmSendDialogProps {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    jsonData: string;
    isSending: boolean;
}

export function ConfirmSendDialog({
    open,
    onClose,
    onConfirm,
    jsonData,
    isSending,
}: ConfirmSendDialogProps) {
    // ESC 关闭
    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (e.key === "Escape" && !isSending) onClose();
        },
        [onClose, isSending],
    );

    useEffect(() => {
        if (open) {
            document.addEventListener("keydown", handleKeyDown);
            document.body.style.overflow = "hidden";
        }
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            document.body.style.overflow = "";
        };
    }, [open, handleKeyDown]);

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            onClick={(e) => {
                if (e.target === e.currentTarget && !isSending) onClose();
            }}
        >
            {/* 遮罩 */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

            {/* 弹窗 */}
            <div className="relative w-[90vw] max-w-[600px] max-h-[80vh] flex flex-col bg-[#0e0d0b] border border-[#2e2a24] shadow-2xl shadow-black/50 rounded-sm animate-fade-in">
                {/* 标题栏 */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#2e2a24]">
                    <h2 className="text-sm font-bold tracking-wider text-primary">
                        确认发送配置
                    </h2>
                    <button
                        onClick={onClose}
                        disabled={isSending}
                        className="p-1 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* JSON 预览 */}
                <div className="flex-1 overflow-auto p-4">
                    <p className="text-xs text-muted-foreground mb-2">
                        以下数据将被发送到服务器：
                    </p>
                    <pre className="p-3 bg-[#1c1a16] border border-[#2e2a24] rounded-sm text-xs font-mono text-[#8cb880] overflow-auto max-h-[50vh] whitespace-pre-wrap break-all leading-relaxed">
                        {jsonData}
                    </pre>
                </div>

                {/* 底部按钮 */}
                <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[#2e2a24]">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={isSending}
                        className="h-9 text-sm border-[#2e2a24] text-muted-foreground cursor-pointer hover:bg-[#1c1a16] hover:text-foreground/80"
                    >
                        取消
                    </Button>
                    <Button
                        onClick={onConfirm}
                        disabled={isSending}
                        className="h-9 text-sm bg-[#1e2a3a] hover:bg-[#283848] text-[#7eb8d8] font-semibold cursor-pointer border border-[#3a5a7a] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSending ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <Send className="w-4 h-4 mr-2" />
                        )}
                        {isSending ? "发送中..." : "确认发送"}
                    </Button>
                </div>
            </div>
        </div>
    );
}
