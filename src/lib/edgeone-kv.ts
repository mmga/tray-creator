import type { TrayParams } from "@/types/tray";
import type { CustomLayoutParams, AppMode } from "@/types/custom-tray";

// ═══════════════════════════════════════════
// EdgeOne KV 配置发送工具
// ═══════════════════════════════════════════

/** Edge Function URL；同域部署时留空即可使用相对路径 */
const EDGE_FUNCTION_URL =
    process.env.NEXT_PUBLIC_EDGEONE_KV_URL || "/api/orders";

interface SendResult {
    success: boolean;
    orderId?: string;
    error?: string;
}

/**
 * 将当前参数配置发送到 EdgeOne KV 存储
 */
export async function sendConfigToKV(
    mode: AppMode,
    params: TrayParams | CustomLayoutParams,
): Promise<SendResult> {
    const url = EDGE_FUNCTION_URL;

    if (!url) {
        return { success: false, error: "EdgeOne KV URL 未配置" };
    }

    // 序列化：复用 param-io.ts 的精度截断逻辑
    const payload = {
        version: 1,
        mode,
        params,
        submittedAt: new Date().toISOString(),
    };

    const body = JSON.stringify(payload, (_key, value) => {
        if (typeof value === "number") {
            return Math.round(value * 1000) / 1000;
        }
        return value;
    });

    try {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
            return {
                success: false,
                error: data.error || `HTTP ${res.status}`,
            };
        }

        return { success: true, orderId: data.orderId };
    } catch (e) {
        return {
            success: false,
            error: e instanceof Error ? e.message : "网络错误",
        };
    }
}
