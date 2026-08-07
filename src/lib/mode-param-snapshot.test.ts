import { describe, expect, it } from "vitest";
import {
  captureModeParamSnapshot,
  createModelGeometryFingerprint,
} from "@/lib/mode-param-snapshot";
import { DEFAULT_TRAY_PARAMS } from "@/lib/grid-config";
import { STEPPED_LAYOUT_DEFAULTS } from "@/lib/stepped-config";

describe("Model Geometry Fingerprint", () => {
  it("does not capture the Active Stepped Group as persisted params", () => {
    const snapshot = captureModeParamSnapshot("stepped", STEPPED_LAYOUT_DEFAULTS);

    expect(snapshot.params).not.toHaveProperty("activeGroupId");
  });

  it("相同 Mode 和参数得到相同指纹，不受对象键顺序影响", () => {
    const snapshot = captureModeParamSnapshot("grid", DEFAULT_TRAY_PARAMS);
    const reordered = {
      mode: snapshot.mode,
      params: Object.fromEntries(Object.entries(snapshot.params).reverse()),
    } as typeof snapshot;

    expect(createModelGeometryFingerprint(reordered)).toBe(
      createModelGeometryFingerprint(snapshot),
    );
  });

  it("参数变化时指纹不同", () => {
    const snapshot = captureModeParamSnapshot("grid", DEFAULT_TRAY_PARAMS);
    const changed = captureModeParamSnapshot("grid", {
      ...DEFAULT_TRAY_PARAMS,
      rows: DEFAULT_TRAY_PARAMS.rows + 1,
    });

    expect(createModelGeometryFingerprint(changed)).not.toBe(
      createModelGeometryFingerprint(snapshot),
    );
  });
});
