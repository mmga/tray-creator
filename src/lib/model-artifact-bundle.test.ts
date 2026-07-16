import { describe, expect, it, vi } from "vitest";
import {
  exportModelArtifactBundle,
} from "@/lib/model-artifact-bundle";
import { captureModeParamSnapshot } from "@/lib/mode-param-snapshot";
import { DEFAULT_TRAY_PARAMS } from "@/lib/grid-config";

describe("Model Artifact Bundle", () => {
  it("准备失败时不触发任何下载", async () => {
    const downloadBlob = vi.fn();
    const failure = new Error("STL 序列化失败");

    await expect(
      exportModelArtifactBundle(
        captureModeParamSnapshot("grid", DEFAULT_TRAY_PARAMS),
        async () => {
          throw failure;
        },
        { downloadBlob },
      ),
    ).rejects.toBe(failure);

    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it("按 Mode 文件顺序下载，并把参数伴随文件放在最后", async () => {
    const downloadBlob = vi.fn();
    const snapshot = captureModeParamSnapshot("grid", DEFAULT_TRAY_PARAMS);

    await exportModelArtifactBundle(
      snapshot,
      async () => ({
        files: [
          { blob: new Blob(["first"]), filename: "first.stl" },
          { blob: new Blob(["manifest"]), filename: "manifest.json" },
        ],
        companionParamFilename: "params.json",
      }),
      { downloadBlob },
    );

    expect(downloadBlob.mock.calls.map((call) => call[1])).toEqual([
      "first.stl",
      "manifest.json",
      "params.json",
    ]);
    const paramsBlob = downloadBlob.mock.calls[2][0] as Blob;
    expect(JSON.parse(await paramsBlob.text())).toMatchObject({ mode: "grid" });
  });

  it("一个下载触发失败后继续其余文件并汇总失败", async () => {
    const downloadBlob = vi.fn((_blob: Blob, filename: string) => {
      if (filename !== "second.stl") throw new Error(filename);
    });

    const promise = exportModelArtifactBundle(
      captureModeParamSnapshot("grid", DEFAULT_TRAY_PARAMS),
      async () => ({
        files: [
          { blob: new Blob(), filename: "first.stl" },
          { blob: new Blob(), filename: "second.stl" },
        ],
        companionParamFilename: "params.json",
      }),
      { downloadBlob },
    );

    await expect(promise).rejects.toMatchObject({
      failures: [
        { filename: "first.stl" },
        { filename: "params.json" },
      ],
    });
    expect(downloadBlob).toHaveBeenCalledTimes(3);
  });
});
