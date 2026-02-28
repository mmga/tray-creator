/**
 * EdgeOne Edge Function — 订单配置 KV 存储
 *
 * 文件路由: /api/orders
 * KV 绑定: 命名空间 tray_maker，变量名 orders（全局可用）
 */

// ── CORS 公共头 ──────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

// ── POST /api/orders — 提交配置 ──────────────
export async function onRequestPost({ request }) {
  try {
    const body = await request.text();
    // 校验为合法 JSON
    const payload = JSON.parse(body);

    // 管理动作：删除订单（通过 POST action 兼容不支持 DELETE 的网关）
    if (
      payload &&
      typeof payload === "object" &&
      payload.action === "delete" &&
      typeof payload.key === "string"
    ) {
      const adminToken = globalThis.ADMIN_TOKEN;
      if (!adminToken) {
        return jsonResponse(
          { success: false, error: "ADMIN_TOKEN not configured" },
          500,
        );
      }

      const authHeader = request.headers.get("Authorization");
      if (authHeader !== `Bearer ${adminToken}`) {
        return jsonResponse({ success: false, error: "Forbidden" }, 403);
      }

      await orders.delete(payload.key);
      return jsonResponse({ success: true, key: payload.key });
    }

    // 生成唯一 key: order_{timestamp}_{4位随机hex}
    const id = `order_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`;
    await orders.put(id, body);
    return jsonResponse({ success: true, orderId: id });
  } catch (e) {
    return jsonResponse({ success: false, error: e.message }, 400);
  }
}

// ── GET /api/orders — 查询订单 ───────────────
// ?key=xxx  → 返回指定订单
// 无参数    → 列出所有订单 key
export async function onRequestGet(context) {
  try {
    const { request, env } = context;
    const adminToken = env?.ADMIN_TOKEN || globalThis.ADMIN_TOKEN;
    if (!adminToken) {
      return jsonResponse(
        { success: false, error: "ADMIN_TOKEN not configured" },
        500,
      );
    }

    const authHeader = request.headers.get("Authorization");
    if (authHeader !== `Bearer ${adminToken}`) {
      return jsonResponse({ success: false, error: "Forbidden" }, 403);
    }

    const url = new URL(request.url);
    const key = url.searchParams.get("key");

    if (key) {
      const value = await orders.get(key);
      if (!value) {
        return jsonResponse({ success: false, error: "Not found" }, 404);
      }
      return jsonResponse({ success: true, data: JSON.parse(value) });
    }

    let allKeys = [];
    let cursor = null;

    do {
      const listOptions = {
        prefix: "order_",
        limit: 100,
      };
      if (cursor) {
        listOptions.cursor = cursor;
      }

      const result = await orders.list(listOptions);
      const keys = Array.isArray(result?.keys) ? result.keys : [];
      allKeys = allKeys.concat(keys.map((k) => k?.key).filter(Boolean));
      cursor = result?.complete ? null : result?.cursor || null;
    } while (cursor);

    return jsonResponse({ success: true, keys: allKeys });
  } catch (e) {
    return jsonResponse(
      { success: false, error: e?.message || "GET handler error" },
      500,
    );
  }
}

// ── DELETE /api/orders — 删除订单 ───────────
// ?key=xxx  → 删除指定订单
export async function onRequestDelete(context) {
  try {
    const { request, env } = context;
    const adminToken = env?.ADMIN_TOKEN || globalThis.ADMIN_TOKEN;
    if (!adminToken) {
      return jsonResponse(
        { success: false, error: "ADMIN_TOKEN not configured" },
        500,
      );
    }

    const authHeader = request.headers.get("Authorization");
    if (authHeader !== `Bearer ${adminToken}`) {
      return jsonResponse({ success: false, error: "Forbidden" }, 403);
    }

    const url = new URL(request.url);
    const key = url.searchParams.get("key");
    if (!key) {
      return jsonResponse({ success: false, error: "Missing key" }, 400);
    }

    await orders.delete(key);
    return jsonResponse({ success: true, key });
  } catch (e) {
    return jsonResponse(
      { success: false, error: e?.message || "DELETE handler error" },
      500,
    );
  }
}

// ── OPTIONS — CORS 预检 ──────────────────────
export function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}
