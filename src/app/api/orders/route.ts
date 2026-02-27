import { NextResponse } from "next/server";

/**
 * 本地开发模拟：订单 KV 存储
 * 使用内存 Map 模拟 EdgeOne KV，仅用于开发调试
 * 生产构建 (output: 'export') 时此文件不会被打包
 */

const store = new Map<string, string>();

// ── Mock 种子数据 ──────────────────────────
const seedOrders: [string, object][] = [
    ["order_1772150400000_a1b2", {
        version: 1, mode: "grid",
        params: { rows: 5, columns: 2, holeDiameter: 32, spacing: 5, baseThickness: 3, holeDepth: 2.6, cornerRadius: 4, enableBaseHole: false, baseHoleSize: "25" },
        submittedAt: "2026-02-27T12:00:00.000Z",
    }],
    ["order_1772154000000_c3d4", {
        version: 1, mode: "grid",
        params: { rows: 3, columns: 3, holeDiameter: 25, spacing: 4, baseThickness: 2.5, holeDepth: 3, cornerRadius: 3, enableBaseHole: true, baseHoleSize: "19.5" },
        submittedAt: "2026-02-27T13:00:00.000Z",
    }],
    ["order_1772160000000_e5f6", {
        version: 1, mode: "custom",
        params: {
            trayWidth: 120, trayDepth: 80, spacing: 4, boundarySpacing: 4, boundarySpacingIndependent: false,
            baseThickness: 3, holeDepth: 3, cornerRadius: 4, enableBaseHole: false, baseHoleSize: "25",
            slots: [
                { id: "s1", x: 30, y: 40, shape: "circle", width: 32, height: 32, rotation: 0 },
                { id: "s2", x: 70, y: 40, shape: "circle", width: 25, height: 25, rotation: 0 },
                { id: "s3", x: 100, y: 40, shape: "ellipse", width: 40, height: 25, rotation: 45 },
            ],
        },
        submittedAt: "2026-02-27T14:40:00.000Z",
    }],
    ["order_1772170800000_g7h8", {
        version: 1, mode: "grid",
        params: { rows: 2, columns: 4, holeDiameter: 60, spacing: 6, baseThickness: 3.5, holeDepth: 2.6, cornerRadius: 5, enableBaseHole: true, baseHoleSize: "25" },
        submittedAt: "2026-02-27T17:40:00.000Z",
    }],
];

for (const [key, data] of seedOrders) {
    store.set(key, JSON.stringify(data));
}


// POST /api/orders — 提交配置
export async function POST(request: Request) {
    try {
        const body = await request.text();
        JSON.parse(body); // 校验合法 JSON
        const id = `order_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`;
        store.set(id, body);
        console.log(`[Mock KV] Saved order: ${id}`);
        return NextResponse.json({ success: true, orderId: id });
    } catch (e) {
        return NextResponse.json(
            { success: false, error: e instanceof Error ? e.message : "Invalid JSON" },
            { status: 400 },
        );
    }
}

// GET /api/orders — 列出所有订单 / 查询单个订单
export async function GET(request: Request) {
    const url = new URL(request.url);
    const key = url.searchParams.get("key");

    if (key) {
        const value = store.get(key);
        if (!value) {
            return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
        }
        return NextResponse.json({ success: true, data: JSON.parse(value) });
    }

    // 列出所有 key（按时间倒序）
    const keys = Array.from(store.keys()).sort().reverse();
    return NextResponse.json({ success: true, keys });
}
