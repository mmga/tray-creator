"use client";

import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

type ToastType = "success" | "error" | "info";

interface ToastItem {
    id: string;
    type: ToastType;
    message: string;
}

interface ToastActions {
    toast: (type: ToastType, message: string) => void;
    dismiss: (id: string) => void;
}

const ToastStateContext = createContext<ToastItem[] | null>(null);
const ToastActionsContext = createContext<ToastActions | null>(null);

const TOAST_DURATION = 4000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<ToastItem[]>([]);
    const idCounter = useRef(0);
    const timersRef = useRef(new Map<string, number>());

    const dismiss = useCallback((id: string) => {
        const timer = timersRef.current.get(id);
        if (timer !== undefined) {
            window.clearTimeout(timer);
            timersRef.current.delete(id);
        }
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    useEffect(
        () => () => {
            timersRef.current.forEach((timer) => window.clearTimeout(timer));
            timersRef.current.clear();
        },
        [],
    );

    const toast = useCallback(
        (type: ToastType, message: string) => {
            const id = `toast_${++idCounter.current}`;
            setToasts((prev) => [...prev, { id, type, message }]);
            const timer = window.setTimeout(() => dismiss(id), TOAST_DURATION);
            timersRef.current.set(id, timer);
        },
        [dismiss]
    );
    const actions = useMemo(() => ({ toast, dismiss }), [dismiss, toast]);

    return (
        <ToastActionsContext.Provider value={actions}>
            <ToastStateContext.Provider value={toasts}>
                {children}
            </ToastStateContext.Provider>
        </ToastActionsContext.Provider>
    );
}

export function useToast() {
    const actions = useContext(ToastActionsContext);
    if (!actions) {
        // 在 provider 外部调用时回退到 console
        return {
            toast: (type: ToastType, message: string) => {
                if (type === "error") console.error(message);
                else console.log(`[${type}] ${message}`);
            },
        };
    }
    return { toast: actions.toast };
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
    const toasts = useContext(ToastStateContext);
    const actions = useContext(ToastActionsContext);
    if (!toasts || !actions) return null;

    return (
        <div
            className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm"
            aria-label="通知"
        >
            {toasts.map((t) => (
                <div
                    key={t.id}
                    className={`flex items-start gap-2 px-4 py-3 rounded-lg border shadow-lg text-sm animate-in slide-in-from-right-full duration-300 ${typeStyles[t.type]}`}
                    role={t.type === "error" ? "alert" : "status"}
                    aria-atomic="true"
                >
                    <span aria-hidden="true" className="font-bold text-base leading-none mt-0.5">{typeIcons[t.type]}</span>
                    <span className="flex-1 break-words">{t.message}</span>
                    <button
                        type="button"
                        onClick={() => actions.dismiss(t.id)}
                        className="rounded opacity-50 hover:opacity-100 transition-opacity text-xs ml-2 mt-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
                        aria-label={`关闭通知：${t.message}`}
                    >
                        <span aria-hidden="true">✕</span>
                    </button>
                </div>
            ))}
        </div>
    );
}
