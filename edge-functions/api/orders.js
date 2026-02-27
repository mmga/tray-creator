/**
 * EdgeOne Edge Function — 订单配置 KV 存储
 *
 * 文件路由: /api/orders
 * KV 绑定: 命名空间 tray_maker，变量名 orders（全局可用）
 */

// ── CORS 公共头 ──────────────────────────────
const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
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
        JSON.parse(body);
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
export async function onRequestGet({ request }) {
    const url = new URL(request.url);
    const key = url.searchParams.get("key");

    if (key) {
        const value = await orders.get(key);
        if (!value) {
            return jsonResponse({ success: false, error: "Not found" }, 404);
        }
        return jsonResponse({ success: true, data: JSON.parse(value) });
    }

    // 遍历所有 key
    let allKeys = [];
    let cursor;
    do {
        const result = await orders.list({
            prefix: "order_",
            limit: 100,
            cursor,
        });
        allKeys = allKeys.concat(result.keys.map((k) => k.key));
        cursor = result.complete ? null : result.cursor;
    } while (cursor);

    return jsonResponse({ success: true, keys: allKeys });
}

// ── OPTIONS — CORS 预检 ──────────────────────
export function onRequestOptions() {
    return new Response(null, { headers: corsHeaders });
}
