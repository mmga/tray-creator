import { describe, expect, it } from "vitest";
import { CUSTOM_LAYOUT_DEFAULTS } from "@/lib/custom-config";
import {
  constructCustomContouredFootprintOutcome,
  projectCustomContouredFootprintInput,
} from "@/lib/custom-contoured-footprint";

describe("Custom Contoured Footprint outcome", () => {
  it("相切模式不消费休眠的手调圆角，切回手调后恢复原值", () => {
    const params = { ...CUSTOM_LAYOUT_DEFAULTS, footprintStyle: "polygonal" as const,
      polygonCornerStyle: "tangent" as const, cornerRadius: 30 };
    expect(projectCustomContouredFootprintInput(params)).toEqual(
      projectCustomContouredFootprintInput({ ...params, cornerRadius: 0 }),
    );
    expect(projectCustomContouredFootprintInput({ ...params, polygonCornerStyle: "manual" }).plan.requests[0].cornerRadius).toBe(30);
  });

  it("圆角只在直边策略进入轮廓输入，变化会改变构造身份", () => {
    const polygonal = { ...CUSTOM_LAYOUT_DEFAULTS, footprintStyle: "polygonal" as const };
    expect(projectCustomContouredFootprintInput(polygonal)).not.toEqual(
      projectCustomContouredFootprintInput({ ...polygonal, cornerRadius: 0 }),
    );
    const contoured = { ...polygonal, footprintStyle: "contoured" as const };
    expect(projectCustomContouredFootprintInput(contoured)).toEqual(
      projectCustomContouredFootprintInput({ ...contoured, cornerRadius: 0 }),
    );
  });

  it("直边请求忽略休眠的平滑和断连参数", () => {
    const params = { ...CUSTOM_LAYOUT_DEFAULTS, footprintStyle: "polygonal" as const };
    expect(projectCustomContouredFootprintInput(params)).toEqual(
      projectCustomContouredFootprintInput({ ...params, smoothingRadius: Infinity, disconnectDistance: 200 }),
    );
  });

  it("为无效轮廓参数返回结构化失败而不是抛错", () => {
    const outcome = constructCustomContouredFootprintOutcome(
      projectCustomContouredFootprintInput({
      ...CUSTOM_LAYOUT_DEFAULTS,
      footprintStyle: "contoured",
      smoothingRadius: Number.POSITIVE_INFINITY,
      }),
    );

    expect(outcome).toMatchObject({
      ok: false,
      error: { code: "invalid-contour-parameters" },
    });
  });
});
