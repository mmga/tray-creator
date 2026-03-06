/**
 * EdgeOne Edge Function — 访问统计 KV 存储
 *
 * 文件路由: /api/stats
 * KV 绑定: 命名空间 tray_maker，变量名 stats（全局可用）
 *
 * POST (无需鉴权) — 上报访问事件
 * GET  (需鉴权)   — 查询统计数据
 */

// ── CORS 公共头 ──────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function resolveAdminToken(env) {
  return env?.ADMIN_TOKEN || globalThis.ADMIN_TOKEN;
}

/**
 * 获取当前日期字符串 (YYYY-MM-DD)，基于 UTC+8
 */
function getTodayDateStr() {
  const now = new Date();
  // UTC+8
  const offset = 8 * 60 * 60 * 1000;
  const local = new Date(now.getTime() + offset);
  return local.toISOString().slice(0, 10);
}

/**
 * 从 UserAgent 判断设备类型
 */
function detectDeviceType(ua) {
  if (!ua) return "desktop";
  const lower = ua.toLowerCase();
  if (/tablet|ipad|playbook|silk/.test(lower)) return "tablet";
  if (
    /mobile|iphone|ipod|android.*mobile|windows phone|blackberry|opera mini|iemobile/.test(
      lower,
    )
  )
    return "mobile";
  return "desktop";
}

/**
 * 从 Referrer 提取域名
 */
function extractDomain(referrer) {
  if (!referrer) return "direct";
  try {
    return new URL(referrer).hostname || "direct";
  } catch {
    return "direct";
  }
}

/**
 * 安全地对 KV 中的 JSON 对象做 read → modify → write
 * @param {string} key - KV key
 * @param {function} modifier - (obj) => obj，修改后返回
 */
async function kvModifyJson(key, modifier) {
  const raw = await stats.get(key);
  let obj = {};
  if (raw) {
    try {
      obj = JSON.parse(raw);
    } catch {
      obj = {};
    }
  }
  obj = modifier(obj);
  await stats.put(key, JSON.stringify(obj));
  return obj;
}

/**
 * 安全地自增 KV 中的数字计数器
 */
async function kvIncrement(key) {
  const raw = await stats.get(key);
  const current = parseInt(raw, 10) || 0;
  const next = current + 1;
  await stats.put(key, String(next));
  return next;
}

// ── POST /api/stats — 上报事件（无需鉴权）────────
export async function onRequestPost(context) {
  try {
    const { request } = context;
    const body = await request.json();
    const { event, fingerprint, referrer, userAgent } = body || {};

    const date = getTodayDateStr();

    if (event === "page_view") {
      // ── PV 计数 ──
      await kvIncrement("stats_pv_total");
      await kvIncrement(`stats_pv_${date}`);

      // ── UV 去重 ──
      if (fingerprint) {
        const uvKey = `stats_uv_${date}`;
        const raw = await stats.get(uvKey);
        let uvSet = [];
        if (raw) {
          try {
            uvSet = JSON.parse(raw);
          } catch {
            uvSet = [];
          }
        }
        if (!Array.isArray(uvSet)) uvSet = [];
        if (!uvSet.includes(fingerprint)) {
          uvSet.push(fingerprint);
          await stats.put(uvKey, JSON.stringify(uvSet));
        }
      }

      // ── Referrer 来源统计 ──
      const domain = extractDomain(referrer);
      await kvModifyJson(`stats_referrer_${date}`, (obj) => {
        obj[domain] = (obj[domain] || 0) + 1;
        return obj;
      });

      // ── 设备分布统计 ──
      const deviceType = detectDeviceType(userAgent);
      await kvModifyJson(`stats_device_${date}`, (obj) => {
        obj[deviceType] = (obj[deviceType] || 0) + 1;
        return obj;
      });
    } else if (event) {
      // ── Action 事件计数（generate_3d / export_stl / submit_order）──
      const allowedActions = ["generate_3d", "export_stl", "submit_order"];
      if (allowedActions.includes(event)) {
        await kvIncrement(`stats_actions_${event}`);
      }
    }

    return jsonResponse({ success: true });
  } catch (e) {
    return jsonResponse({ success: false, error: e.message }, 500);
  }
}

// ── GET /api/stats — 查询统计（需鉴权）──────────
export async function onRequestGet(context) {
  try {
    const { request, env } = context;
    const adminToken = resolveAdminToken(env);
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
    const range = url.searchParams.get("range") || "7d";

    const today = getTodayDateStr();

    // 确定日期范围
    let days = 7;
    if (range === "30d") days = 30;
    if (range === "all") days = 90; // 最多回溯 90 天

    // 收集每日数据
    const daily = [];
    for (let i = 0; i < days; i++) {
      const d = new Date();
      d.setTime(d.getTime() + 8 * 60 * 60 * 1000); // UTC+8
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);

      const pvRaw = await stats.get(`stats_pv_${dateStr}`);
      const uvRaw = await stats.get(`stats_uv_${dateStr}`);
      const pv = parseInt(pvRaw, 10) || 0;
      let uv = 0;
      if (uvRaw) {
        try {
          uv = JSON.parse(uvRaw).length;
        } catch {
          uv = 0;
        }
      }

      daily.push({ date: dateStr, pv, uv });
    }

    // PV 总量
    const pvTotalRaw = await stats.get("stats_pv_total");
    const pvTotal = parseInt(pvTotalRaw, 10) || 0;

    // 今日 UV
    const uvTodayRaw = await stats.get(`stats_uv_${today}`);
    let uvToday = 0;
    if (uvTodayRaw) {
      try {
        uvToday = JSON.parse(uvTodayRaw).length;
      } catch {
        uvToday = 0;
      }
    }

    // 操作事件计数
    const actions = {};
    for (const action of ["generate_3d", "export_stl", "submit_order"]) {
      const raw = await stats.get(`stats_actions_${action}`);
      actions[action] = parseInt(raw, 10) || 0;
    }

    // 来源分布（今日）
    const referrerRaw = await stats.get(`stats_referrer_${today}`);
    let referrers = {};
    if (referrerRaw) {
      try {
        referrers = JSON.parse(referrerRaw);
      } catch {
        referrers = {};
      }
    }

    // 设备分布（今日）
    const deviceRaw = await stats.get(`stats_device_${today}`);
    let devices = {};
    if (deviceRaw) {
      try {
        devices = JSON.parse(deviceRaw);
      } catch {
        devices = {};
      }
    }

    return jsonResponse({
      success: true,
      data: {
        pv_total: pvTotal,
        uv_today: uvToday,
        daily: daily.reverse(), // 从旧到新排列
        actions,
        referrers,
        devices,
      },
    });
  } catch (e) {
    return jsonResponse(
      { success: false, error: e?.message || "GET handler error" },
      500,
    );
  }
}

// ── OPTIONS — CORS 预检 ──────────────────────
export function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}
