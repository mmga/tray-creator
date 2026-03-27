"use client";

import React, { createContext, useCallback, useContext, useState, useRef } from "react";

type ToastType = "success" | "error" | "info";

interface ToastItem {
    id: string;
    type: ToastType;
    message: string;
}

interface ToastContextValue {
    toasts: ToastItem[];
    toast: (type: ToastType, message: string) => void;
    dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_DURATION = 4000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<ToastItem[]>([]);
    const idCounter = useRef(0);

    const dismiss = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const toast = useCallback(
        (type: ToastType, message: string) => {
            const id = `toast_${++idCounter.current}`;
            setToasts((prev) => [...prev, { id, type, message }]);
            setTimeout(() => dismiss(id), TOAST_DURATION);
        },
        [dismiss]
    );

    return (
        <ToastContext.Provider value={{ toasts, toast, dismiss }}>
            {children}
        </ToastContext.Provider>
    );
}

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) {
        // 在 provider 外部调用时回退到 console
        return {
            toast: (type: ToastType, message: string) => {
                if (type === "error") console.error(message);
                else console.log(`[${type}] ${message}`);
            },
        };
    }
    return { toast: ctx.toast };
}

const typeStyles: Record<ToastType, string> = {
    success: "border-[#4a6741] bg-[#1a2518] text-[#8cb880]",
    error: "border-[#6b3030] bg-[#201515] text-[#d18888]",
    info: "border-[#2e2a24] bg-[#1a1816] text-[#c8b89a]",
};

const typeIcons: Record<ToastType, string> = {
    success: "✓",
    error: "✕",
    info: "ℹ",
};

export function Toaster() {
    const ctx = useContext(ToastContext);
    if (!ctx) return null;

    return (
        <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm">
            {ctx.toasts.map((t) => (
                <div
                    key={t.id}
                    className={`flex items-start gap-2 px-4 py-3 rounded-lg border shadow-lg text-sm animate-in slide-in-from-right-full duration-300 ${typeStyles[t.type]}`}
                    role="alert"
                >
                    <span className="font-bold text-base leading-none mt-0.5">{typeIcons[t.type]}</span>
                    <span className="flex-1 break-words">{t.message}</span>
                    <button
                        onClick={() => ctx.dismiss(t.id)}
                        className="opacity-50 hover:opacity-100 transition-opacity text-xs ml-2 mt-0.5"
                        aria-label="关闭"
                    >
                        ✕
                    </button>
                </div>
            ))}
        </div>
    );
}
