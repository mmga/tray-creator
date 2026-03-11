import { NextResponse } from "next/server";

export const dynamic = "force-static";
export const revalidate = false;

/**
 * 本地 Admin API 代理：转发到线上 EdgeOne /api/stats
 * 参照 orders/route.ts 的代理模式
 */

const EDGEONE_STATS_URL = process.env.EDGEONE_STATS_URL;
const ADMIN_API_TOKEN = process.env.ADMIN_API_TOKEN;

function getMissingConfigError() {
  const missing: string[] = [];
  if (!EDGEONE_STATS_URL) missing.push("EDGEONE_STATS_URL");
  if (!ADMIN_API_TOKEN) missing.push("ADMIN_API_TOKEN");
  return missing;
}

// GET /api/stats — 查询统计数据（代理到 EdgeOne）
export async function GET(request: Request) {
  const missing = getMissingConfigError();
  if (missing.length > 0) {
    return NextResponse.json(
      { success: false, error: `Missing env: ${missing.join(", ")}` },
      { status: 500 },
    );
  }

  try {
    const sourceUrl = new URL(request.url);
    const targetUrl = new URL(EDGEONE_STATS_URL!);
    targetUrl.search = sourceUrl.search; // 转发 ?range=7d 等参数

    const res = await fetch(targetUrl.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${ADMIN_API_TOKEN}`,
      },
      cache: "no-store",
    });

    const raw = await res.text();
    try {
      const data = JSON.parse(raw);
      return NextResponse.json(data, { status: res.status });
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: `Upstream non-JSON response: ${raw.slice(0, 500)}`,
        },
        { status: res.status },
      );
    }
  } catch (e) {
    return NextResponse.json(
      {
        success: false,
        error: e instanceof Error ? e.message : "Proxy error",
      },
      { status: 502 },
    );
  }
}
