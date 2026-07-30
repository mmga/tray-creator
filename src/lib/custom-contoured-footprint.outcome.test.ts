import { describe, expect, it } from "vitest";
import { CUSTOM_LAYOUT_DEFAULTS } from "@/lib/custom-config";
import {
  constructCustomContouredFootprintOutcome,
  projectCustomContouredFootprintInput,
} from "@/lib/custom-contoured-footprint";

describe("Custom Contoured Footprint outcome", () => {
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
