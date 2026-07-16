import { describe, expect, it, vi } from "vitest";
import { STEPPED_LAYOUT_DEFAULTS } from "@/lib/stepped-config";
import { captureModeParamSnapshot } from "@/lib/mode-param-snapshot";

const { jscadToThreeGeometryMock } = vi.hoisted(() => ({
  jscadToThreeGeometryMock: vi.fn(),
}));

vi.mock("@/lib/jscad-to-three", () => ({
  jscadToThreeGeometry: jscadToThreeGeometryMock,
}));

import {
  exportSteppedModelFiles,
  generateSteppedPreview,
  getSteppedSTLFilename,
} from "@/lib/stepped-model-service";

describe("stepped model service", () => {
  it("generates stepped previews through the worker port", async () => {
    const geometry = { id: "stepped-geom" } as never;
    const threeGeometry = { id: "three-stepped" };
    const workerPort = {
      generateStepped: vi.fn().mockResolvedValue({ geometry, volume: 789 }),
      generateSteppedOutlinePreview: vi.fn(),
      exportSTL: vi.fn(),
    };
    jscadToThreeGeometryMock.mockReturnValue(threeGeometry);

    await expect(
      generateSteppedPreview(STEPPED_LAYOUT_DEFAULTS, workerPort),
    ).resolves.toEqual({
      geometry,
      threeGeometry,
      volume: 789,
    });
    expect(workerPort.generateStepped).toHaveBeenCalledWith(
      STEPPED_LAYOUT_DEFAULTS,
    );
  });

  it("builds stepped filenames and exports param file blobs", async () => {
    const geometry = { id: "stepped-geom" } as never;
    const stlBlob = new Blob(["stl"], { type: "application/sla" });
    const workerPort = {
      generateStepped: vi.fn(),
      generateSteppedOutlinePreview: vi.fn(),
      exportSTL: vi.fn().mockResolvedValue({
        blob: stlBlob,
        filename: "tray_stepped_260x260_0slots.stl",
      }),
    };
    const downloadPort = {
      downloadBlob: vi.fn(),
    };

    expect(
      getSteppedSTLFilename(STEPPED_LAYOUT_DEFAULTS, {
        width: 100,
        depth: 90,
        minX: 0,
        maxX: 0,
        minY: 0,
        maxY: 0,
      }),
    ).toBe("tray_stepped_100x90_0slots.stl");

    await exportSteppedModelFiles(
      captureModeParamSnapshot("stepped", STEPPED_LAYOUT_DEFAULTS),
      geometry,
      workerPort,
      downloadPort,
    );

    expect(workerPort.exportSTL).toHaveBeenCalledWith(
      geometry,
      "tray_stepped_260x260_0slots.stl",
    );
    expect(downloadPort.downloadBlob).toHaveBeenCalledTimes(2);
    expect(downloadPort.downloadBlob).toHaveBeenNthCalledWith(
      1,
      stlBlob,
      "tray_stepped_260x260_0slots.stl",
    );
    expect(downloadPort.downloadBlob.mock.calls[1]?.[1]).toBe(
      "tray_stepped_260x260_0slots.json",
    );
    await expect(downloadPort.downloadBlob.mock.calls[1]?.[0].text()).resolves.toContain(
      '"mode": "stepped"',
    );
  });
});
