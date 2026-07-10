import { describe, expect, it, vi } from "vitest";
import { CUSTOM_LAYOUT_DEFAULTS } from "@/lib/custom-config";
import { calculateCustomEffectiveDimensions } from "@/lib/custom-layout-math";

const { jscadToThreeGeometryMock } = vi.hoisted(() => ({
  jscadToThreeGeometryMock: vi.fn(),
}));

vi.mock("@/lib/jscad-to-three", () => ({
  jscadToThreeGeometry: jscadToThreeGeometryMock,
}));

import {
  buildCustomParamsBlob,
  exportCustomModelFiles,
  generateCustomPreview,
  getCustomSTLFilename,
} from "@/lib/custom-layout-service";

describe("custom layout service", () => {
  it("generates previews through the worker port", async () => {
    const geometry = { id: "custom-geom" } as never;
    const threeGeometry = { id: "three-custom" };
    const workerPort = {
      generateCustom: vi.fn().mockResolvedValue({ geometry, volume: 456 }),
      exportSTL: vi.fn(),
    };
    jscadToThreeGeometryMock.mockReturnValue(threeGeometry);

    await expect(
      generateCustomPreview(CUSTOM_LAYOUT_DEFAULTS, workerPort),
    ).resolves.toEqual({
      geometry,
      threeGeometry,
      volume: 456,
    });
    expect(workerPort.generateCustom).toHaveBeenCalledWith(
      CUSTOM_LAYOUT_DEFAULTS,
    );
  });

  it("uses the actual tray footprint for filenames and exports JSON alongside STL", async () => {
    const geometry = { id: "custom-geom" } as never;
    const stlBlob = new Blob(["stl"], { type: "application/sla" });
    const workerPort = {
      generateCustom: vi.fn(),
      exportSTL: vi.fn().mockResolvedValue({
        blob: stlBlob,
        filename: "tray_custom_150x90_2slots.stl",
      }),
    };
    const downloadPort = {
      downloadBlob: vi.fn(),
    };
    const params = {
      ...CUSTOM_LAYOUT_DEFAULTS,
      trayWidth: 260,
      trayDepth: 200,
      slots: [
        {
          id: "slot-1",
          x: 30,
          y: 40,
          shape: "circle" as const,
          width: 25,
          height: 25,
          rotation: 0,
        },
        {
          id: "slot-2",
          x: 70,
          y: 90,
          shape: "ellipse" as const,
          width: 30,
          height: 20,
          rotation: 15,
        },
      ],
    };
    const effectiveDimensions = {
      width: 120,
      depth: 80,
      minX: 0,
      maxX: 0,
      minY: 0,
      maxY: 0,
    };
    expect(getCustomSTLFilename(params, effectiveDimensions)).toBe(
      "tray_custom_120x80_2slots.stl",
    );

    const fixedParams = {
      ...params,
      traySizingMode: "fixed" as const,
      trayWidth: 150,
      trayDepth: 90,
    };
    expect(getCustomSTLFilename(fixedParams, effectiveDimensions)).toBe(
      "tray_custom_150x90_2slots.stl",
    );

    const paramsBlob = buildCustomParamsBlob(params);
    await expect(paramsBlob.text()).resolves.toContain('"version": 1');
    await expect(paramsBlob.text()).resolves.toContain('"mode": "custom"');
    await expect(paramsBlob.text()).resolves.toContain('"trayWidth": 260');

    await exportCustomModelFiles(
      fixedParams,
      effectiveDimensions,
      geometry,
      workerPort,
      downloadPort,
    );

    expect(workerPort.exportSTL).toHaveBeenCalledWith(
      geometry,
      "tray_custom_150x90_2slots.stl",
    );
    expect(downloadPort.downloadBlob).toHaveBeenCalledTimes(2);
    expect(downloadPort.downloadBlob).toHaveBeenNthCalledWith(
      1,
      stlBlob,
      "tray_custom_150x90_2slots.stl",
    );
    expect(downloadPort.downloadBlob.mock.calls[1]?.[1]).toBe(
      "tray_custom_150x90_2slots.json",
    );
    await expect(
      downloadPort.downloadBlob.mock.calls[1]?.[0].text(),
    ).resolves.toContain('"mode": "custom"');
  });

  it("uses derived outer dimensions for automatic filenames when side bevel is enabled", () => {
    const params = {
      ...CUSTOM_LAYOUT_DEFAULTS,
      boundarySpacing: 3,
      boundarySpacingIndependent: true,
      sideBevelWidth: 2,
      slots: [
        {
          id: "slot-1",
          x: 109.6,
          y: 112.8,
          shape: "circle" as const,
          width: 11,
          height: 11,
          slotWidth: 11.4,
          slotHeight: 11.4,
          rotation: 0,
        },
        {
          id: "slot-2",
          x: 89,
          y: 112.6,
          shape: "circle" as const,
          width: 11,
          height: 11,
          slotWidth: 11.4,
          slotHeight: 11.4,
          rotation: 0,
        },
        {
          id: "slot-3",
          x: 98.2,
          y: 103.1,
          shape: "circle" as const,
          width: 11,
          height: 11,
          slotWidth: 11.4,
          slotHeight: 11.4,
          rotation: 0,
        },
        {
          id: "slot-4",
          x: 81,
          y: 102.2,
          shape: "circle" as const,
          width: 11,
          height: 11,
          slotWidth: 11.4,
          slotHeight: 11.4,
          rotation: 0,
        },
      ],
    };

    expect(
      getCustomSTLFilename(params, calculateCustomEffectiveDimensions(params)),
    ).toBe("tray_custom_46x28_4slots.stl");
  });
});
