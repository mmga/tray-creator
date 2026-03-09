import type { TrayParams } from "@/types/tray";
import type {
  CustomLayoutParams,
  SteppedLayoutParams,
  AppMode,
} from "@/types/custom-tray";

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

// ── Payload 构建 ──────────────────────────

/** JSON 精度截断 replacer */
function precisionReplacer(_key: string, value: unknown) {
  if (typeof value === "number") {
    return Math.round(value * 1000) / 1000;
  }
  return value;
}

/** 构造待发送的 payload 对象（供弹窗预览） */
export function buildPayload(
  mode: AppMode,
  params: TrayParams | CustomLayoutParams | SteppedLayoutParams,
) {
  return {
    version: 1,
    mode,
    params,
    submittedAt: new Date().toISOString(),
  };
}

/** 序列化 payload 为 JSON 字符串（含精度截断） */
export function serializePayload(payload: unknown): string {
  return JSON.stringify(payload, precisionReplacer, 2);
}

// ── 发送配置 ──────────────────────────────

/**
 * 将当前参数配置发送到 EdgeOne KV 存储
 */
export async function sendConfigToKV(
  mode: AppMode,
  params: TrayParams | CustomLayoutParams | SteppedLayoutParams,
): Promise<SendResult> {
  const url = EDGE_FUNCTION_URL;

  if (!url) {
    return { success: false, error: "EdgeOne KV URL 未配置" };
  }

  const payload = buildPayload(mode, params);
  const body = JSON.stringify(payload, precisionReplacer);

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

// ── 查询订单（Admin） ────────────────────

interface OrderListResult {
  success: boolean;
  keys?: string[];
  error?: string;
}

interface OrderDetailResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

interface OrderDeleteResult {
  success: boolean;
  error?: string;
}

/** 获取所有订单 key 列表 */
export async function fetchOrderList(): Promise<OrderListResult> {
  const url = EDGE_FUNCTION_URL;
  if (!url) return { success: false, error: "EdgeOne KV URL 未配置" };

  try {
    const res = await fetch(url, { method: "GET" });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || `HTTP ${res.status}` };
    }
    return { success: true, keys: data.keys };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "网络错误",
    };
  }
}

/** 获取指定订单详情 */
export async function fetchOrderDetail(
  key: string,
): Promise<OrderDetailResult> {
  const url = EDGE_FUNCTION_URL;
  if (!url) return { success: false, error: "EdgeOne KV URL 未配置" };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "detail", key }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || `HTTP ${res.status}` };
    }
    return { success: true, data: data.data };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "网络错误",
    };
  }
}

/** 删除指定订单 */
export async function deleteOrder(key: string): Promise<OrderDeleteResult> {
  const url = EDGE_FUNCTION_URL;
  if (!url) return { success: false, error: "EdgeOne KV URL 未配置" };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", key }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || `HTTP ${res.status}` };
    }

    if (data.key !== key) {
      return {
        success: false,
        error: "上游接口暂不支持删除动作，请先部署最新 Edge Function",
      };
    }

    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "网络错误",
    };
  }
}
