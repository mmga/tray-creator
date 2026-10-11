import { describe, expect, it } from "vitest";
import { cpus } from "node:os";
import { booleans, primitives, transforms } from "@jscad/modeling";
import type { Geom2 } from "@jscad/modeling/src/geometries/types";
import {
  constructContouredFootprints,
  type ContouredFootprintRequest,
} from "@/lib/contoured-footprint";
import { RENDER_CONFIG } from "@/lib/config";
import { generateOutlineGeom2 } from "@/lib/outline-geometry";
import {
  clusterConnectivityCircles,
  getConnectivityRadius,
  getEffectiveBridgeGap,
  type ConnectivityCircle,
} from "@/lib/stepped-connectivity";

const { union } = booleans;
const { circle } = primitives;
const { translate } = transforms;

function createRequest(): ContouredFootprintRequest {
  return {
    key: "performance-fixture",
    slots: Array.from({ length: 64 }, (_, index) => ({
      id: `slot-${String(index).padStart(2, "0")}`,
      cx: (index % 8) * 22,
      cy: Math.floor(index / 8) * 22,
      rotation: 0,
      shape: "circle" as const,
      profile: { width: 18, height: 18, outerOffset: 0 },
    })),
    slotSpacing: 5,
    boundarySpacing: 5,
    smoothingRadius: 12,
    disconnectDistance: 0,
  };
}

/** 冻结的迁移前纯圆形路径，仅作为性能基线，不参与生产运行。 */
function constructLegacyCircularBaseline(request: ContouredFootprintRequest) {
  const circles: ConnectivityCircle[] = request.slots.map((slot) => ({
    id: slot.id,
    cx: slot.cx,
    cy: slot.cy,
    rOuter: getConnectivityRadius(
      slot.profile.width,
      slot.profile.height,
      request.slotSpacing,
      slot.profile.outerOffset * 2,
      slot.profile.outerOffset * 2,
    ),
  }));
  return clusterConnectivityCircles(
    circles,
    getEffectiveBridgeGap(request.smoothingRadius, request.disconnectDistance),
  ).map((cluster) => {
    if (cluster.length === 1) {
      const item = cluster[0];
      return translate(
        [item.cx, item.cy],
        circle({ radius: item.rOuter, segments: RENDER_CONFIG.cylinderSegments }),
      ) as Geom2;
    }
    const outline = generateOutlineGeom2(
      cluster.map((item) => ({
        cx: item.cx,
        cy: item.cy,
        rOuter: item.rOuter,
      })),
      request.smoothingRadius,
      RENDER_CONFIG.cylinderSegments,
    );
    if (outline) return outline;
    const parts = cluster.map((item) =>
      translate(
        [item.cx, item.cy],
        circle({ radius: item.rOuter, segments: RENDER_CONFIG.cylinderSegments }),
      ) as Geom2
    );
    return parts.length === 1 ? parts[0] : union(...parts);
  });
}

function measure(run: () => unknown, iterations: number) {
  const startedAt = performance.now();
  for (let index = 0; index < iterations; index += 1) run();
  return performance.now() - startedAt;
}

function median(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

describe("contoured footprint performance gate", () => {
  it("记录直边包络 10、30、50 槽的预热后三次构造耗时", () => {
    console.info(`直边性能环境：${process.platform} / ${cpus()[0]?.model} / Node ${process.version}`);
    for (const count of [10, 30, 50]) {
      const request: ContouredFootprintRequest = {
        ...createRequest(), constructionStyle: "polygonal", cornerRadius: 4,
        slots: Array.from({ length: count }, (_, i) => ({
          id: `polygon-${i}`, cx: 200 * Math.cos(i * 2 * Math.PI / count),
          cy: 200 * Math.sin(i * 2 * Math.PI / count), rotation: i * 7,
          shape: "ellipse", profile: { width: 18, height: 12, outerOffset: 1, profileExponent: 3 },
        })),
      };
      const run = () => {
        const outcome = constructContouredFootprints({ requests: [request] });
        expect(outcome.ok).toBe(true);
        if (outcome.ok) expect(outcome.value.footprints[0].bodyCount).toBe(1);
      };
      for (let i = 0; i < 3; i++) run();
      const times = Array.from({ length: 3 }, () => measure(run, 1));
      console.info(`${count} 槽：中位数 ${median(times).toFixed(3)}ms，最大 ${Math.max(...times).toFixed(3)}ms`);
    }
  });

  it("批量 Interface 相对迁移前基线满足约定回归上限", () => {
    const request = createRequest();
    for (let index = 0; index < 2; index += 1) {
      constructLegacyCircularBaseline(request);
      constructContouredFootprints({ requests: [request] });
    }

    const ratios = Array.from({ length: 7 }, () => {
      const baselineMs = measure(() => constructLegacyCircularBaseline(request), 2);
      const currentMs = measure(
        () => constructContouredFootprints({ requests: [request] }),
        2,
      );
      return currentMs / Math.max(baselineMs, 0.01);
    });

    expect(median(ratios)).toBeLessThanOrEqual(1.25);
    expect(Math.max(...ratios)).toBeLessThanOrEqual(1.5);
  });
});
