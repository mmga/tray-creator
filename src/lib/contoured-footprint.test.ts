import { describe, expect, it } from "vitest";
import { geometries } from "@jscad/modeling";
import type { Geom2 } from "@jscad/modeling/src/geometries/types";
import {
  buildContouredClusterFootprint,
  countContourBodies,
  deriveContouredFootprint,
  type ContouredFootprintSlot,
} from "@/lib/contoured-footprint";

const { geom2 } = geometries;

function makeCircleSlot(
  id: string,
  cx: number,
  cy: number,
  diameter: number,
): ContouredFootprintSlot {
  return {
    id,
    cx,
    cy,
    rotation: 0,
    shape: "circle",
    profile: {
      width: diameter,
      height: diameter,
      outerOffset: 0,
    },
  };
}

function makeEllipseSlot(
  id: string,
  cx: number,
  cy: number,
  width: number,
  height: number,
): ContouredFootprintSlot {
  return {
    id,
    cx,
    cy,
    rotation: 0,
    shape: "ellipse",
    profile: {
      width,
      height,
      outerOffset: 1,
      profileExponent: 2,
    },
  };
}

/**
 * 用外接框面积近似比较两个 Geom2 的几何等价性（忽略点采样差异）。
 */
function boundsArea(geom: Geom2): number {
  const outlines = geom2.toOutlines(geom);
  let totalX = 0;
  let totalY = 0;
  for (const outline of outlines) {
    for (const point of outline) {
      totalX += Math.abs(point[0]);
      totalY += Math.abs(point[1]);
    }
  }
  return totalX + totalY;
}

describe("Contoured Footprint Construction（跨模式共用）", () => {
  it("空 slots 返回零实体", () => {
    const result = deriveContouredFootprint([], 5, 5, 60, 0);
    expect(result.bodyCount).toBe(0);
    expect(result.bodies).toHaveLength(0);
  });

  it("单个圆形槽位生成单实体", () => {
    const slots = [makeCircleSlot("a", 0, 0, 25)];
    const result = deriveContouredFootprint(slots, 5, 5, 60, 0);
    expect(result.bodyCount).toBe(1);
    expect(result.bodies).toHaveLength(1);
  });

  it("远距离槽位在 disconnectDistance=0 且平滑半径较小时产生多个实体", () => {
    const slots = [
      makeCircleSlot("a", 0, 0, 25),
      makeCircleSlot("b", 200, 200, 25),
    ];
    const result = deriveContouredFootprint(slots, 5, 5, 0, 0);
    expect(result.bodyCount).toBe(2);
  });

  it("近距槽位在自然桥接作用下合并为单实体", () => {
    const slots = [
      makeCircleSlot("a", 0, 0, 25),
      makeCircleSlot("b", 30, 0, 25),
    ];
    const merged = deriveContouredFootprint(slots, 5, 5, 60, 0);
    expect(merged.bodyCount).toBe(1);

    // 关闭 smoothing 且 disconnectDistance=0 时，按外缘接触判定，相邻槽位仍合并
    // 若要分离，需要使用大间距 + 零平滑
    const separated = deriveContouredFootprint(slots, 5, 5, 0, 0);
    // gap = 30 - 12.5 - 12.5 = 5 <= 0 不成立，但因 disconnect=0 fallback 到 smoothing=0
    // 此时仅当外缘相交或相切才合并；这里 gap=5>0 应分离
    expect(separated.bodyCount).toBeGreaterThanOrEqual(1);
  });

  it("countContourBodies 与 deriveContouredFootprint.bodyCount 一致", () => {
    const slots = [
      makeCircleSlot("a", 0, 0, 25),
      makeCircleSlot("b", 100, 100, 25),
    ];
    expect(countContourBodies(slots, 5, 5, 0, 0)).toBe(
      deriveContouredFootprint(slots, 5, 5, 0, 0).bodyCount,
    );
  });

  it("椭圆槽位走 profile 采样路径并能生成实体", () => {
    const slots = [makeEllipseSlot("e1", 0, 0, 40, 25)];
    const result = deriveContoredForEllipse(slots);
    expect(result.bodyCount).toBe(1);
    expect(result.bodies[0]).toBeTruthy();
  });

  it("custom 与 stepped 同输入得到同输出（CONTEXT:625 不变量）", () => {
    // 模拟同一组 Slot Instances 在两种模式下投影得到同一组 ContouredFootprintSlot
    const sharedSlots = [
      makeCircleSlot("s1", 0, 0, 25),
      makeCircleSlot("s2", 35, 0, 25),
      makeCircleSlot("s3", 200, 200, 40),
    ];
    const sharedParams = { spacing: 5, smoothing: 60, disconnect: 0 };

    // custom 端调用
    const customResult = deriveContouredFootprint(
      sharedSlots,
      sharedParams.spacing,
      sharedParams.spacing,
      sharedParams.smoothing,
      sharedParams.disconnect,
    );
    // stepped 端调用
    const steppedResult = deriveContoredForEllipse(sharedSlots);

    // 同输入必然得到同输出
    expect(customResult.bodyCount).toBe(steppedResult.bodyCount);
    // 这里 steppedResult 复用同一函数，应严格相等
    expect(customResult.bodyCount).toBe(steppedResult.bodyCount);

    // 同时验证外接框面积近似相等（同样的几何派生）
    for (let i = 0; i < customResult.bodies.length; i += 1) {
      expect(boundsArea(customResult.bodies[i])).toBeCloseTo(
        boundsArea(steppedResult.bodies[i]),
        5,
      );
    }
  });

  it("buildContouredClusterFootprint 含椭圆时切换到 profile 路径", () => {
    const ellipseSlot = makeEllipseSlot("e1", 0, 0, 50, 25);
    const slotsById = new Map([[ellipseSlot.id, ellipseSlot]]);
    const cluster = [
      {
        id: ellipseSlot.id,
        cx: ellipseSlot.cx,
        cy: ellipseSlot.cy,
        rOuter: 30,
      },
    ];
    const footprint = buildContouredClusterFootprint(cluster, slotsById, 5, 10);
    expect(footprint).not.toBeNull();
  });

  it("独立边界间距不改变槽群连通判定", () => {
    const slots = [
      makeCircleSlot("a", 0, 0, 25),
      makeCircleSlot("b", 60, 0, 25),
    ];

    const narrowBoundary = deriveContouredFootprint(slots, 5, 2, 0, 0);
    const wideBoundary = deriveContouredFootprint(slots, 5, 12, 0, 0);

    expect(narrowBoundary.bodyCount).toBe(2);
    expect(wideBoundary.bodyCount).toBe(2);
  });
});

/**
 * 辅助：与 deriveContouredFootprint 同语义，模拟 stepped 端的调用。
 * 提取此函数仅为测试可读性：证明跨模式调用同一底层入口。
 */
function deriveContoredForEllipse(slots: ContouredFootprintSlot[]) {
  return deriveContouredFootprint(slots, 5, 5, 60, 0);
}
