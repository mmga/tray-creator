import { describe, expect, it } from "vitest";
import {
  captureModeParamSnapshot,
  createModelGeometryFingerprint,
} from "@/lib/mode-param-snapshot";
import { DEFAULT_TRAY_PARAMS } from "@/lib/grid-config";
import { STEPPED_LAYOUT_DEFAULTS } from "@/lib/stepped-config";
import { BASE_CONVERTER_DEFAULTS } from "@/lib/base-converter-config";

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

  it("转换底盘指纹忽略休眠的普通底盘配置", () => {
    const original = captureModeParamSnapshot(
      "base-converter",
      BASE_CONVERTER_DEFAULTS,
    );
    const dormantChanged = captureModeParamSnapshot("base-converter", {
      ...BASE_CONVERTER_DEFAULTS,
      roundBaseSnapshot: {
        ...BASE_CONVERTER_DEFAULTS.roundBaseSnapshot,
        height: 9,
      },
      pushFitHexHole: {
        ...BASE_CONVERTER_DEFAULTS.pushFitHexHole,
        offsetX: 4,
      },
    });

    expect(createModelGeometryFingerprint(dormantChanged)).toBe(
      createModelGeometryFingerprint(original),
    );
  });

  it("普通与简版底盘指纹包含各自生效的几何参数", () => {
    const plain = captureModeParamSnapshot("base-converter", {
      ...BASE_CONVERTER_DEFAULTS,
      generationKind: "plain",
    });
    const taller = captureModeParamSnapshot("base-converter", {
      ...plain.params,
      roundBaseSnapshot: {
        ...plain.params.roundBaseSnapshot,
        height: 5,
      },
    });
    const pushFit = captureModeParamSnapshot("base-converter", {
      ...plain.params,
      generationKind: "push-fit",
    });
    const movedHole = captureModeParamSnapshot("base-converter", {
      ...pushFit.params,
      pushFitHexHole: {
        ...pushFit.params.pushFitHexHole,
        offsetX: 1,
      },
    });

    expect(createModelGeometryFingerprint(taller)).not.toBe(
      createModelGeometryFingerprint(plain),
    );
    expect(createModelGeometryFingerprint(movedHole)).not.toBe(
      createModelGeometryFingerprint(pushFit),
    );
  });
});
