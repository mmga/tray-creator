import { describe, expect, it } from "vitest";
import {
  APP_MODE_LABELS,
  ParamArtifactReadError,
  prepareParamFileObject,
  readDraftParamArtifact,
} from "@/lib/historical-param-artifact-reader";
import {
  createDefaultStorageSteppedParams,
  withStorageSteppedHeightSpec,
} from "@/lib/storage-stepped-config";
import { STEPPED_LAYOUT_DEFAULTS } from "@/lib/stepped-config";
import { defaultDraftTitle } from "@/lib/local-drafts";

describe("Storage Stepped 参数文件识别", () => {
  it("声明模式的收纳参数被识别并归一化", () => {
    const params = createDefaultStorageSteppedParams("storage");
    const preparation = prepareParamFileObject({
      version: 1,
      mode: "storage-stepped",
      params: structuredClone(params),
    });
    expect(preparation.status).toBe("ready");
    if (preparation.status !== "ready") return;
    expect(preparation.candidate.mode).toBe("storage-stepped");
    if (preparation.candidate.mode !== "storage-stepped") return;
    expect(preparation.candidate.snapshot.params.heightSpecId).toBe("storage");
    expect(preparation.candidate.snapshot.params.trays).toHaveLength(3);
    expect(preparation.candidate.report.modeResolution.kind).toBe("declared");
  });

  it("未声明模式的收纳结构可被推断", () => {
    const params = createDefaultStorageSteppedParams();
    const preparation = prepareParamFileObject(structuredClone(params));
    expect(preparation.status).toBe("ready");
    if (preparation.status !== "ready") return;
    expect(preparation.candidate.mode).toBe("storage-stepped");
    expect(preparation.candidate.report.modeResolution.kind).toBe("inferred");
  });

  it("声明为普通阶梯但结构是收纳参数时报告冲突", () => {
    const params = createDefaultStorageSteppedParams();
    expect(() =>
      prepareParamFileObject({
        version: 1,
        mode: "stepped",
        params: structuredClone(params),
      }),
    ).toThrow(ParamArtifactReadError);
  });

  it("旧阶梯参数仍识别为 stepped，不会被当作收纳模式", () => {
    const preparation = prepareParamFileObject({
      version: 1,
      mode: "stepped",
      params: structuredClone(STEPPED_LAYOUT_DEFAULTS),
    });
    expect(preparation.status).toBe("ready");
    if (preparation.status !== "ready") return;
    expect(preparation.candidate.mode).toBe("stepped");
  });

  it("未知接口版本在读取阶段给出明确错误", () => {
    const params = createDefaultStorageSteppedParams();
    params.interfaceVersion = 99;
    expect(() =>
      prepareParamFileObject({ version: 1, mode: "storage-stepped", params }),
    ).toThrow(/未知接口版本/);
  });

  it("草稿读取按收纳模式归一化并拒绝模式不符", () => {
    const params = withStorageSteppedHeightSpec(
      createDefaultStorageSteppedParams(),
      "storage",
    );
    const loaded = readDraftParamArtifact(
      { version: 1, mode: "storage-stepped", params: structuredClone(params) },
      "storage-stepped",
    );
    expect(loaded.heightSpecId).toBe("storage");

    expect(() =>
      readDraftParamArtifact(
        { version: 1, mode: "stepped", params: structuredClone(STEPPED_LAYOUT_DEFAULTS) },
        "storage-stepped",
      ),
    ).toThrow(/模式不匹配/);
  });

  it("模式标签与草稿默认标题包含收纳阶梯语义", () => {
    expect(APP_MODE_LABELS["storage-stepped"]).toBe("阶梯收纳展示台");
    expect(defaultDraftTitle("storage-stepped")).toContain("收纳阶梯草稿");
  });
});
