import { describe, expect, it, vi } from "vitest";
import {
  createOldWorldGridSlotSnapshot,
  DEFAULT_TRAY_PARAMS,
  findOldWorldRectangularPreset,
} from "@/lib/grid-config";
import { captureModeParamSnapshot } from "@/lib/mode-param-snapshot";

const { jscadToThreeGeometryMock } = vi.hoisted(() => ({
  jscadToThreeGeometryMock: vi.fn(),
}));

vi.mock("@/lib/jscad-to-three", () => ({
  jscadToThreeGeometry: jscadToThreeGeometryMock,
}));

import {
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

    await exportGridModelFiles(
      captureModeParamSnapshot("grid", DEFAULT_TRAY_PARAMS),
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

  it("includes both nominal dimensions in rectangular grid filenames", () => {
    const rectangularParams = {
      ...DEFAULT_TRAY_PARAMS,
      ...createOldWorldGridSlotSnapshot(
        findOldWorldRectangularPreset("old-world-30x60")!,
      ),
    };

    expect(getGridSTLFilename(rectangularParams)).toBe(
      "tray_2x5_rectangle_30x60mm.stl",
    );
  });

  it("exports two STLs and a JSON for an enabled box", async () => {
    const boxParams = {
      ...DEFAULT_TRAY_PARAMS,
      stackableBox: {
        ...DEFAULT_TRAY_PARAMS.stackableBox!,
        enabled: true,
        outerWidth: 200,
        outerDepth: 150,
        outerHeight: 50,
      },
    };
    const body = { id: "body-geom" } as never;
    const lid = { id: "lid-geom" } as never;
    const bodyBlob = new Blob(["body"], { type: "application/sla" });
    const lidBlob = new Blob(["lid"], { type: "application/sla" });
    const workerPort = {
      generateGrid: vi.fn(),
      generateGridBoxParts: vi.fn().mockResolvedValue({
        body,
        lid,
        bodyVolume: 100,
        lidVolume: 20,
      }),
      exportSTL: vi
        .fn()
        .mockResolvedValueOnce({
          blob: bodyBlob,
          filename: "box_grid_200x150x50_2x5_body.stl",
        })
        .mockResolvedValueOnce({
          blob: lidBlob,
          filename: "box_grid_200x150x50_2x5_lid.stl",
        }),
    };
    const downloadPort = { downloadBlob: vi.fn() };

    await exportGridModelFiles(
      captureModeParamSnapshot("grid", boxParams),
      { id: "unused" } as never,
      workerPort,
      downloadPort,
    );

    expect(workerPort.generateGridBoxParts).toHaveBeenCalledWith(boxParams);
    expect(downloadPort.downloadBlob).toHaveBeenCalledTimes(3);
    expect(downloadPort.downloadBlob).toHaveBeenNthCalledWith(
      1,
      bodyBlob,
      "box_grid_200x150x50_2x5_body.stl",
    );
    expect(downloadPort.downloadBlob).toHaveBeenNthCalledWith(
      2,
      lidBlob,
      "box_grid_200x150x50_2x5_lid.stl",
    );
    expect(downloadPort.downloadBlob.mock.calls[2]?.[1]).toBe(
      "box_grid_200x150x50_2x5_body.json",
    );
  });
});
