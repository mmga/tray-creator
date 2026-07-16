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
  exportSteppedCadSplitPartFiles,
  exportSteppedCadModelFiles,
  generateSteppedCadSplitPreview,
  getSteppedCadSplitBaseFilename,
  generateSteppedCadPreview,
  getSteppedCadSTLFilename,
} from "@/lib/stepped-cad-model-service";

describe("stepped cad model service", () => {
  it("generates stepped cad previews through the worker port", async () => {
    const geometry = { id: "stepped-cad-geom" } as never;
    const threeGeometry = { id: "three-stepped-cad" };
    const workerPort = {
      generateSteppedCad: vi.fn().mockResolvedValue({ geometry, volume: 456 }),
      generateSteppedCadSplitParts: vi.fn(),
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

  it("builds split preview geometries through the worker port", async () => {
    const partGeometry = { id: "cad-part-geom" } as never;
    const threeGeometry = { id: "cad-three-part" };
    const workerPort = {
      generateSteppedCad: vi.fn(),
      generateSteppedCadSplitParts: vi.fn().mockResolvedValue({
        parts: [
          {
            index: 0,
            filenameLabel: "part_01_cad_low",
            label: "低组",
            fromHeight: 0,
            toHeight: 10,
            geometry: partGeometry,
          },
        ],
      }),
      generateSteppedOutlinePreview: vi.fn(),
      exportSTL: vi.fn(),
    };
    jscadToThreeGeometryMock.mockReturnValue(threeGeometry);

    await expect(
      generateSteppedCadSplitPreview(STEPPED_LAYOUT_DEFAULTS, workerPort),
    ).resolves.toEqual([
      {
        index: 0,
        filenameLabel: "part_01_cad_low",
        label: "低组",
        fromHeight: 0,
        toHeight: 10,
        threeGeometry,
      },
    ]);
  });

  it("builds cad filenames and exports CAD Mode params", async () => {
    const geometry = { id: "stepped-cad-geom" } as never;
    const stlBlob = new Blob(["stl"], { type: "application/sla" });
    const workerPort = {
      generateSteppedCad: vi.fn(),
      generateSteppedCadSplitParts: vi.fn(),
      generateSteppedOutlinePreview: vi.fn(),
      exportSTL: vi.fn().mockResolvedValue({
        blob: stlBlob,
        filename: "tray_stepped_cad_260x260_0slots.stl",
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
      captureModeParamSnapshot("stepped-cad", STEPPED_LAYOUT_DEFAULTS),
      geometry,
      workerPort,
      downloadPort,
    );

    expect(workerPort.exportSTL).toHaveBeenCalledWith(
      geometry,
      "tray_stepped_cad_260x260_0slots.stl",
    );
    expect(downloadPort.downloadBlob).toHaveBeenCalledTimes(2);
    await expect(downloadPort.downloadBlob.mock.calls[1]?.[0].text()).resolves.toContain(
      '"mode": "stepped-cad"',
    );
  });

  it("exports cad split part stls with manifest and params", async () => {
    const partGeometry = { id: "cad-part-geom" } as never;
    const stlBlob = new Blob(["part-stl"], { type: "application/sla" });
    const workerPort = {
      generateSteppedCad: vi.fn(),
      generateSteppedCadSplitParts: vi.fn().mockResolvedValue({
        parts: [
          {
            index: 0,
            filenameLabel: "part_01_cad_low",
            label: "低组",
            fromHeight: 0,
            toHeight: 10,
            geometry: partGeometry,
          },
        ],
      }),
      generateSteppedOutlinePreview: vi.fn(),
      exportSTL: vi.fn().mockResolvedValue({
        blob: stlBlob,
        filename: "tray_stepped_cad_split_260x260_0slots_part_01_cad_low.stl",
      }),
    };
    const downloadPort = {
      downloadBlob: vi.fn(),
    };

    expect(
      getSteppedCadSplitBaseFilename(STEPPED_LAYOUT_DEFAULTS, {
        width: 100,
        depth: 90,
        minX: 0,
        maxX: 0,
        minY: 0,
        maxY: 0,
      }),
    ).toBe("tray_stepped_cad_split_100x90_0slots");

    await exportSteppedCadSplitPartFiles(
      captureModeParamSnapshot("stepped-cad", STEPPED_LAYOUT_DEFAULTS),
      workerPort,
      downloadPort,
    );

    expect(workerPort.exportSTL).toHaveBeenCalledWith(
      partGeometry,
      "tray_stepped_cad_split_260x260_0slots_part_01_cad_low.stl",
    );
    expect(downloadPort.downloadBlob).toHaveBeenCalledTimes(3);
    await expect(downloadPort.downloadBlob.mock.calls[1]?.[0].text()).resolves.toContain(
      "feature graph",
    );
    await expect(downloadPort.downloadBlob.mock.calls[2]?.[0].text()).resolves.toContain(
      '"mode": "stepped-cad"',
    );
  });
});
