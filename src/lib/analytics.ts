/**
 * 访问统计上报模块
 *
 * fire-and-forget 方式上报，不阻塞用户操作，不影响页面正常运行。
 * 生产环境直接 POST 到 EdgeOne /api/stats 边缘函数；
 * 开发模式下也会尝试上报（可能 404，但不会报错）。
 */

// ── 配置 ──────────────────────────────────

/** 统计上报 URL：同域时使用相对路径 */
const STATS_URL =
  process.env.NEXT_PUBLIC_EDGEONE_STATS_URL || "/api/stats";

/** 防刷 debounce 间隔 (ms) */
const DEBOUNCE_MS = 5000;

// ── Fingerprint ──────────────────────────

let cachedFingerprint: string | null = null;

/**
 * 生成简单浏览器指纹 (非加密级别，仅用于 UV 去重)
 * 基于 screen 分辨率、语言、时区
 */
export function getFingerprint(): string {
  if (cachedFingerprint) return cachedFingerprint;

  const raw = [
    screen.width,
    screen.height,
    screen.colorDepth,
    navigator.language,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    navigator.hardwareConcurrency || 0,
  ].join("|");

  // 简单哈希 (djb2)
  let hash = 5381;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash * 33) ^ raw.charCodeAt(i);
  }
  cachedFingerprint = (hash >>> 0).toString(36);
  return cachedFingerprint;
}

// ── 核心上报 ──────────────────────────────

/** 上次上报时间戳 (按事件类型分别记录) */
const lastReportTime: Record<string, number> = {};

/**
 * 底层上报函数
 */
function reportEvent(event: string, extra?: Record<string, string>) {
  // 防刷：同类型事件在 DEBOUNCE_MS 内只上报一次
  const now = Date.now();
  if (lastReportTime[event] && now - lastReportTime[event] < DEBOUNCE_MS) {
    return;
  }
  lastReportTime[event] = now;

  const payload = {
    event,
    fingerprint: getFingerprint(),
    referrer: document.referrer || "",
    userAgent: navigator.userAgent || "",
    ...extra,
  };

  try {
    fetch(STATS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true, // 确保页面卸载时也能发送
    }).catch(() => {
      // 静默忽略网络错误
    });
  } catch {
    // 静默忽略
  }
}

// ── 公开 API ──────────────────────────────

/**
 * 上报页面访问 (PV/UV)
 * 应在 useEffect 中调用，确保每次页面加载只调用一次
 */
export function reportPageView() {
  reportEvent("page_view");
}

/**
 * 上报操作事件 (fire-and-forget)
 * @param action - 操作类型：generate_3d | export_stl | submit_order
 */
export function reportAction(action: string) {
  reportEvent(action);
}
