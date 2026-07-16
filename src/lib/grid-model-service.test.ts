import { describe, expect, it, vi } from "vitest";
import { DEFAULT_TRAY_PARAMS } from "@/lib/grid-config";
import { captureModeParamSnapshot } from "@/lib/mode-param-snapshot";

const { jscadToThreeGeometryMock } = vi.hoisted(() => ({
  jscadToThreeGeometryMock: vi.fn(),
}));

vi.mock("@/lib/jscad-to-three", () => ({
  jscadToThreeGeometry: jscadToThreeGeometryMock,
}));

import {
  buildGridParamsBlob,
  exportGridModelFiles,
  generateGridPreview,
  getGridSTLFilename,
} from "@/lib/grid-model-service";

describe("grid model service", () => {
  it("generates previews by converting worker geometry to three geometry", async () => {
    const geometry = { id: "grid-geom" } as never;
    const threeGeometry = { id: "three-geom" };
    const workerPort = {
      generateGrid: vi.fn().mockResolvedValue({ geometry, volume: 123 }),
      exportSTL: vi.fn(),
    };
    jscadToThreeGeometryMock.mockReturnValue(threeGeometry);

    await expect(
      generateGridPreview(DEFAULT_TRAY_PARAMS, workerPort),
    ).resolves.toEqual({
      geometry,
      threeGeometry,
      volume: 123,
    });
    expect(workerPort.generateGrid).toHaveBeenCalledWith(DEFAULT_TRAY_PARAMS);
    expect(jscadToThreeGeometryMock).toHaveBeenCalledWith(geometry);
  });

  it("builds filenames and exports both STL and JSON blobs", async () => {
    const geometry = { id: "grid-geom" } as never;
    const stlBlob = new Blob(["stl"], { type: "application/sla" });
    const workerPort = {
      generateGrid: vi.fn(),
      exportSTL: vi.fn().mockResolvedValue({
        blob: stlBlob,
        filename: "tray_2x5_32mm.stl",
      }),
    };
    const downloadPort = {
      downloadBlob: vi.fn(),
    };

    expect(getGridSTLFilename(DEFAULT_TRAY_PARAMS)).toBe("tray_2x5_32mm.stl");

    const paramsBlob = buildGridParamsBlob(
      captureModeParamSnapshot("grid", DEFAULT_TRAY_PARAMS),
    );
    expect(paramsBlob.type).toBe("application/json");
    await expect(paramsBlob.text()).resolves.toContain('"version": 1');
    await expect(paramsBlob.text()).resolves.toContain('"mode": "grid"');
    await expect(paramsBlob.text()).resolves.toContain('"rows": 5');

    await exportGridModelFiles(
      DEFAULT_TRAY_PARAMS,
      geometry,
      workerPort,
      downloadPort,
    );

    expect(workerPort.exportSTL).toHaveBeenCalledWith(
      geometry,
      "tray_2x5_32mm.stl",
    );
    expect(downloadPort.downloadBlob).toHaveBeenCalledTimes(2);
    expect(downloadPort.downloadBlob).toHaveBeenNthCalledWith(
      1,
      stlBlob,
      "tray_2x5_32mm.stl",
    );
    expect(downloadPort.downloadBlob.mock.calls[1]?.[1]).toBe(
      "tray_2x5_32mm.json",
    );
    await expect(
      downloadPort.downloadBlob.mock.calls[1]?.[0].text(),
    ).resolves.toContain('"mode": "grid"');
    await expect(
      downloadPort.downloadBlob.mock.calls[1]?.[0].text(),
    ).resolves.toContain('"columns": 2');
  });
});
