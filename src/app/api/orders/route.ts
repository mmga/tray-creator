import { NextResponse } from "next/server";

export const dynamic = "force-static";
export const revalidate = false;

/**
 * 本地 Admin API 代理：转发到线上 EdgeOne /api/orders
 * 不再提供本地 Mock，未配置环境变量时直接报错
 */

const EDGEONE_KV_URL = process.env.EDGEONE_KV_URL;
const ADMIN_API_TOKEN = process.env.ADMIN_API_TOKEN;

function getMissingConfigError() {
  const missing: string[] = [];
  if (!EDGEONE_KV_URL) missing.push("EDGEONE_KV_URL");
  if (!ADMIN_API_TOKEN) missing.push("ADMIN_API_TOKEN");
  return missing;
}

function buildProxyUrl(request: Request): string {
  const sourceUrl = new URL(request.url);
  const targetUrl = new URL(EDGEONE_KV_URL!);
  targetUrl.search = sourceUrl.search;
  return targetUrl.toString();
}

async function toProxyResponse(res: Response) {
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
}

async function proxyGet(request: Request) {
  const res = await fetch(buildProxyUrl(request), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${ADMIN_API_TOKEN}`,
    },
    cache: "no-store",
  });
  return toProxyResponse(res);
}

async function proxyPost(request: Request) {
  const body = await request.text();
  const res = await fetch(buildProxyUrl(request), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ADMIN_API_TOKEN}`,
    },
    body,
    cache: "no-store",
  });
  return toProxyResponse(res);
}

// POST /api/orders — 提交配置
export async function POST(request: Request) {
  const missing = getMissingConfigError();
  if (missing.length > 0) {
    return NextResponse.json(
      { success: false, error: `Missing env: ${missing.join(", ")}` },
      { status: 500 },
    );
  }

  try {
    return await proxyPost(request);
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Proxy error" },
      { status: 502 },
    );
  }
}

// GET /api/orders — 列出所有订单 / 查询单个订单
export async function GET(request: Request) {
  const missing = getMissingConfigError();
  if (missing.length > 0) {
    return NextResponse.json(
      { success: false, error: `Missing env: ${missing.join(", ")}` },
      { status: 500 },
    );
  }

  try {
    return await proxyGet(request);
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Proxy error" },
      { status: 502 },
    );
  }
}
