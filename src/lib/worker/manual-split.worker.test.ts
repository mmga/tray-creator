import { expect, it, vi } from "vitest";
import { DEFAULT_TRAY_PARAMS } from "../grid-config";
import { splitBounds, type SplitPoint } from "../manual-split-geometry";
import { MANUAL_SPLIT_DEFAULTS } from "../manual-split-plan";
import { captureModeParamSnapshot } from "../mode-param-snapshot";
import type { WorkerRequest, WorkerResponse } from "./tray.worker";

it("从真实网格准备拆件、规划候选，并只允许合规的打印实体", async () => {
  const postMessage = vi.fn<(message: WorkerResponse) => void>();
  const worker = { postMessage, onmessage: null as null | ((event: MessageEvent<WorkerRequest>) => Promise<void>) };
  vi.stubGlobal("self", worker);
  try {
    await import("./tray.worker");
    const settings = { ...MANUAL_SPLIT_DEFAULTS, enabled: true };
    const snapshot = captureModeParamSnapshot("grid", {
      ...DEFAULT_TRAY_PARAMS, rows: 1, columns: 2, spacing: 8, baseHoleStructure: "none", manualSplit: settings,
    });
    async function send(request: WorkerRequest) {
      await worker.onmessage!(new MessageEvent("message", { data: request }));
      return postMessage.mock.lastCall![0];
    }
    const prepared = await send({ type: "PREPARE_MANUAL_SPLIT", requestId: "scene", snapshot });
    if (prepared.type !== "MANUAL_SPLIT_SCENE_SUCCESS") throw new Error(JSON.stringify(prepared));
    const [region] = prepared.scene.roots;
    const bounds = splitBounds(region.outer);
    const start: SplitPoint = [0, bounds.min[1]];
    const end: SplitPoint = [0, bounds.max[1]];
    const planned = await send({
      type: "PLAN_MANUAL_SPLIT_ROUTE", requestId: "routes", region,
      obstacles: prepared.scene.obstacles, start, end,
    });
    if (planned.type !== "MANUAL_SPLIT_ROUTE_SUCCESS") throw new Error(JSON.stringify(planned));
    expect(planned.routes).toHaveLength(1);
    snapshot.params.manualSplit = { ...settings, cuts: [{ target: region.id, path: planned.routes[0].path }] };
    const result = await send({ type: "GENERATE_MANUAL_SPLIT_PARTS", requestId: "parts", snapshot, forPrint: true });
    expect(result).toMatchObject({ type: "MANUAL_SPLIT_PARTS_SUCCESS", parts: [{ id: "1.1" }, { id: "1.2" }] });
    if (result.type !== "MANUAL_SPLIT_PARTS_SUCCESS") throw new Error(JSON.stringify(result));
    for (const part of result.parts) {
      const stl = await send({ type: "EXPORT_STL", requestId: part.id, geometry: part.geometry, filename: part.id + ".stl" });
      if (stl.type !== "EXPORT_SUCCESS") throw new Error(JSON.stringify(stl));
      const bytes = new DataView(await stl.blob.arrayBuffer());
      const count = bytes.getUint32(80, true);
      expect(count).toBeGreaterThan(0);
      expect(bytes.byteLength).toBe(84 + 50 * count);
      const edges = new Map<string, number>();
      for (let i = 0; i < count; i++) {
        const offset = 84 + 50 * i + 12;
        const vertices = [0, 1, 2].map((j) => [0, 1, 2].map((k) =>
          bytes.getFloat32(offset + j * 12 + k * 4, true)).join(","));
        vertices.forEach((point, j) => {
          const other = vertices[(j + 1) % 3];
          const key = point < other ? point + "/" + other : other + "/" + point;
          edges.set(key, (edges.get(key) ?? 0) + 1);
        });
      }
      expect([...edges].filter(([, count]) => count !== 2).slice(0, 10)).toEqual([]);
    }
    snapshot.params.manualSplit.bed = [15, 15, 20];
    const blocked = await send({ type: "GENERATE_MANUAL_SPLIT_PARTS", requestId: "oversize", snapshot, forPrint: true });
    expect(blocked).toMatchObject({ type: "ERROR", message: expect.stringContaining("超出打印范围") });
  } finally {
    vi.unstubAllGlobals();
  }
});
