import { describe, expect, it, vi } from "vitest";
import { STEPPED_LAYOUT_DEFAULTS } from "@/lib/stepped-config";

const { jscadToThreeGeometryMock } = vi.hoisted(() => ({
  jscadToThreeGeometryMock: vi.fn(),
}));

vi.mock("@/lib/jscad-to-three", () => ({
  jscadToThreeGeometry: jscadToThreeGeometryMock,
}));

import {
  exportSteppedCadModelFiles,
  generateSteppedCadPreview,
  getSteppedCadSTLFilename,
} from "@/lib/stepped-cad-model-service";

describe("stepped cad model service", () => {
  it("generates stepped cad previews through the worker port", async () => {
    const geometry = { id: "stepped-cad-geom" } as never;
    const threeGeometry = { id: "three-stepped-cad" };
    const workerPort = {
      generateSteppedCad: vi.fn().mockResolvedValue({ geometry, volume: 456 }),
      generateSteppedOutlinePreview: vi.fn(),
      exportSTL: vi.fn(),
    };
    jscadToThreeGeometryMock.mockReturnValue(threeGeometry);

    await expect(
      generateSteppedCadPreview(STEPPED_LAYOUT_DEFAULTS, workerPort),
    ).resolves.toEqual({
      geometry,
      threeGeometry,
      volume: 456,
    });
    expect(workerPort.generateSteppedCad).toHaveBeenCalledWith(
      STEPPED_LAYOUT_DEFAULTS,
    );
  });

  it("builds cad filenames and exports stepped-compatible params", async () => {
    const geometry = { id: "stepped-cad-geom" } as never;
    const stlBlob = new Blob(["stl"], { type: "application/sla" });
    const workerPort = {
      generateSteppedCad: vi.fn(),
      generateSteppedOutlinePreview: vi.fn(),
      exportSTL: vi.fn().mockResolvedValue({
        blob: stlBlob,
        filename: "tray_stepped_cad_100x90_0slots.stl",
      }),
    };
    const downloadPort = {
      downloadBlob: vi.fn(),
    };

    expect(
      getSteppedCadSTLFilename(STEPPED_LAYOUT_DEFAULTS, {
        width: 100,
        depth: 90,
        minX: 0,
        maxX: 0,
        minY: 0,
        maxY: 0,
      }),
    ).toBe("tray_stepped_cad_100x90_0slots.stl");

    await exportSteppedCadModelFiles(
      STEPPED_LAYOUT_DEFAULTS,
      {
        width: 100,
        depth: 90,
        minX: 0,
        maxX: 0,
        minY: 0,
        maxY: 0,
      },
      geometry,
      workerPort,
      downloadPort,
    );

    expect(workerPort.exportSTL).toHaveBeenCalledWith(
      geometry,
      "tray_stepped_cad_100x90_0slots.stl",
    );
    expect(downloadPort.downloadBlob).toHaveBeenCalledTimes(2);
    await expect(downloadPort.downloadBlob.mock.calls[1]?.[0].text()).resolves.toContain(
      '"mode": "stepped"',
    );
  });
});
