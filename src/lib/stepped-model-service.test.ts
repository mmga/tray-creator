import { describe, expect, it, vi } from "vitest";
import { STEPPED_LAYOUT_DEFAULTS } from "@/lib/stepped-config";

const { jscadToThreeGeometryMock } = vi.hoisted(() => ({
  jscadToThreeGeometryMock: vi.fn(),
}));

vi.mock("@/lib/jscad-to-three", () => ({
  jscadToThreeGeometry: jscadToThreeGeometryMock,
}));

import {
  exportSteppedModelFiles,
  exportSteppedSplitPartFiles,
  generateSteppedSplitPreview,
  generateSteppedPreview,
  getSteppedSplitBaseFilename,
  getSteppedSTLFilename,
} from "@/lib/stepped-model-service";

describe("stepped model service", () => {
  it("generates stepped previews through the worker port", async () => {
    const geometry = { id: "stepped-geom" } as never;
    const threeGeometry = { id: "three-stepped" };
    const workerPort = {
      generateStepped: vi.fn().mockResolvedValue({ geometry, volume: 789 }),
      generateSteppedOutlinePreview: vi.fn(),
      generateSteppedSplitParts: vi.fn(),
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
      generateSteppedSplitParts: vi.fn(),
      exportSTL: vi.fn().mockResolvedValue({
        blob: stlBlob,
        filename: "tray_stepped_100x90_0slots.stl",
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
      "tray_stepped_100x90_0slots.stl",
    );
    expect(downloadPort.downloadBlob).toHaveBeenCalledTimes(2);
    expect(downloadPort.downloadBlob).toHaveBeenNthCalledWith(
      1,
      stlBlob,
      "tray_stepped_100x90_0slots.stl",
    );
    expect(downloadPort.downloadBlob.mock.calls[1]?.[1]).toBe(
      "tray_stepped_100x90_0slots.json",
    );
    await expect(downloadPort.downloadBlob.mock.calls[1]?.[0].text()).resolves.toContain(
      '"mode": "stepped"',
    );
  });

  it("exports split part stls with a manifest and params file", async () => {
    const partGeometry = { id: "part-geom" } as never;
    const stlBlob = new Blob(["part-stl"], { type: "application/sla" });
    const workerPort = {
      generateStepped: vi.fn(),
      generateSteppedOutlinePreview: vi.fn(),
      generateSteppedSplitParts: vi.fn().mockResolvedValue({
        parts: [
          {
            index: 0,
            filenameLabel: "part_01_0-10mm",
            label: "组 1",
            fromHeight: 0,
            toHeight: 10,
            geometry: partGeometry,
          },
        ],
      }),
      exportSTL: vi.fn().mockResolvedValue({
        blob: stlBlob,
        filename: "tray_stepped_split_100x90_0slots_part_01_0-10mm.stl",
      }),
    };
    const downloadPort = {
      downloadBlob: vi.fn(),
    };

    expect(
      getSteppedSplitBaseFilename(STEPPED_LAYOUT_DEFAULTS, {
        width: 100,
        depth: 90,
        minX: 0,
        maxX: 0,
        minY: 0,
        maxY: 0,
      }),
    ).toBe("tray_stepped_split_100x90_0slots");

    await exportSteppedSplitPartFiles(
      STEPPED_LAYOUT_DEFAULTS,
      {
        width: 100,
        depth: 90,
        minX: 0,
        maxX: 0,
        minY: 0,
        maxY: 0,
      },
      workerPort,
      downloadPort,
    );

    expect(workerPort.generateSteppedSplitParts).toHaveBeenCalledWith(
      STEPPED_LAYOUT_DEFAULTS,
    );
    expect(workerPort.exportSTL).toHaveBeenCalledWith(
      partGeometry,
      "tray_stepped_split_100x90_0slots_part_01_0-10mm.stl",
    );
    expect(downloadPort.downloadBlob).toHaveBeenCalledTimes(3);
    expect(downloadPort.downloadBlob.mock.calls[1]?.[1]).toBe(
      "tray_stepped_split_100x90_0slots_manifest.json",
    );
    await expect(downloadPort.downloadBlob.mock.calls[1]?.[0].text()).resolves.toContain(
      "公母装配槽",
    );
    expect(downloadPort.downloadBlob.mock.calls[2]?.[1]).toBe(
      "tray_stepped_split_100x90_0slots_params.json",
    );
  });

  it("builds split preview geometries through the worker port", async () => {
    const partGeometry = { id: "part-geom" } as never;
    const threeGeometry = { id: "three-part" };
    const workerPort = {
      generateStepped: vi.fn(),
      generateSteppedOutlinePreview: vi.fn(),
      generateSteppedSplitParts: vi.fn().mockResolvedValue({
        parts: [
          {
            index: 0,
            filenameLabel: "part_01_low",
            label: "低组",
            fromHeight: 0,
            toHeight: 3,
            geometry: partGeometry,
          },
        ],
      }),
      exportSTL: vi.fn(),
    };
    jscadToThreeGeometryMock.mockReturnValue(threeGeometry);

    await expect(
      generateSteppedSplitPreview(STEPPED_LAYOUT_DEFAULTS, workerPort),
    ).resolves.toEqual([
      {
        index: 0,
        filenameLabel: "part_01_low",
        label: "低组",
        fromHeight: 0,
        toHeight: 3,
        threeGeometry,
      },
    ]);
    expect(workerPort.generateSteppedSplitParts).toHaveBeenCalledWith(
      STEPPED_LAYOUT_DEFAULTS,
    );
    expect(jscadToThreeGeometryMock).toHaveBeenCalledWith(partGeometry);
  });
});
