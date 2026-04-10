import { describe, expect, it, vi } from "vitest";
import { DEFAULT_TRAY_PARAMS } from "@/lib/grid-config";
import { CUSTOM_LAYOUT_DEFAULTS } from "@/lib/custom-config";
import { SIMPLE_STEPPED_LAYOUT_DEFAULTS } from "@/lib/simple-stepped-config";
import { STEPPED_LAYOUT_DEFAULTS } from "@/lib/stepped-config";
import type {
  AppMode,
  CustomLayoutParams,
  SimpleSteppedLayoutParams,
  SteppedLayoutParams,
} from "@/types/custom-tray";
import type { TrayParams } from "@/types/tray";
import { calculateSimpleSteppedDimensions } from "@/lib/simple-stepped-layout";
import {
  buildParamFile,
  createParamBlob,
  downloadParamFile,
  importParams,
  parseParamFileObject,
  serializeParamFile,
} from "@/lib/param-io";

function readBlobText(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

describe("param-io", () => {
  it("builds and serializes grid param files with rounded numbers", () => {
    const params: TrayParams = {
      ...DEFAULT_TRAY_PARAMS,
      holeDiameter: 28.51234,
      spacing: 5.67891,
    };

    expect(buildParamFile("grid", params)).toEqual({
      version: 1,
      mode: "grid",
      params,
    });

    const serialized = serializeParamFile("grid", params);
    const parsed = JSON.parse(serialized);

    expect(parsed.version).toBe(1);
    expect(parsed.mode).toBe("grid");
    expect(parsed.params.holeDiameter).toBe(28.512);
    expect(parsed.params.spacing).toBe(5.679);
  });

  it("creates blobs and browser downloads for export", async () => {
    const params = DEFAULT_TRAY_PARAMS;
    const blob = createParamBlob("grid", params);
    const text = await readBlobText(blob);
    const anchor = document.createElement("a");
    const clickSpy = vi.spyOn(anchor, "click").mockImplementation(() => {});
    const createElementSpy = vi
      .spyOn(document, "createElement")
      .mockReturnValue(anchor);
    const appendSpy = vi.spyOn(document.body, "appendChild");
    const removeSpy = vi.spyOn(document.body, "removeChild");

    expect(blob.type).toBe("application/json");
    expect(JSON.parse(text)).toMatchObject({
      version: 1,
      mode: "grid",
      params,
    });

    downloadParamFile("grid", params, "grid.json");

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(anchor.download).toBe("grid.json");
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(appendSpy).toHaveBeenCalledWith(anchor);
    expect(removeSpy).toHaveBeenCalledWith(anchor);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock");

    createElementSpy.mockRestore();
  });

  it("parses grid files and restores missing boundary spacing defaults", () => {
    const gridFile = {
      version: 1,
      mode: "grid" as AppMode,
      params: {
        ...DEFAULT_TRAY_PARAMS,
        columns: 99,
        rows: 99,
        spacing: 99,
        baseThickness: 99,
        holeDepth: 99,
        cornerRadius: 99,
        boundarySpacing: undefined,
        boundarySpacingIndependent: undefined,
      },
    };

    const parsed = parseParamFileObject(gridFile, "grid") as TrayParams;

    expect(parsed.columns).toBe(6);
    expect(parsed.rows).toBe(6);
    expect(parsed.spacing).toBe(10);
    expect(parsed.baseThickness).toBe(4);
    expect(parsed.holeDepth).toBe(4);
    expect(parsed.cornerRadius).toBe(10);
    expect(parsed.boundarySpacing).toBe(parsed.spacing);
    expect(parsed.boundarySpacingIndependent).toBe(false);
  });

  it("migrates custom files into stepped params", () => {
    const customParams: CustomLayoutParams = {
      ...CUSTOM_LAYOUT_DEFAULTS,
      trayWidth: 220,
      trayDepth: 210,
      spacing: 7,
      holeDepth: 4,
      slots: [
        {
          id: "slot-1",
          x: 30,
          y: 40,
          shape: "ellipse",
          width: 28,
          height: 20,
          rotation: 15,
        },
      ],
    };

    const migrated = parseParamFileObject(
      { version: 1, mode: "custom", params: customParams },
      "stepped",
    ) as SteppedLayoutParams;

    expect(migrated.trayWidth).toBe(220);
    expect(migrated.trayDepth).toBe(210);
    expect(migrated.spacing).toBe(7);
    expect(migrated.holeDepth).toBe(4);
    expect(migrated.groups).toHaveLength(1);
    expect(migrated.activeGroupId).toBe("test-uuid");
    expect(migrated.slots[0]).toMatchObject({
      id: "slot-1",
      shape: "circle",
      width: 28,
      height: 28,
      groupId: "test-uuid",
    });
    expect(migrated.groups[0]).toMatchObject({
      id: "test-uuid",
      name: "组 1",
      bottomHeight: 10,
      useGroupSmoothingRadius: false,
      useGroupDisconnectDistance: false,
    });
  });

  it("migrates legacy stepped files with bottomHeight and bridgeRadius", () => {
    const legacyStepped = {
      version: 1,
      mode: "stepped" as AppMode,
      params: {
        trayWidth: 500,
        trayDepth: 30,
        slots: [
          {
            x: 10,
            y: 20,
            width: 25,
            height: 25,
            rotation: -90,
            shape: "ellipse",
            bottomHeight: 14,
          },
          {
            id: "slot-2",
            x: 40,
            y: 50,
            width: 32,
            height: 32,
            rotation: 370,
            shape: "circle",
            bottomHeight: 18,
          },
        ],
        activeGroupId: "missing-group",
        spacing: 50,
        holeDepth: 50,
        bridgeRadius: 999,
      },
    };

    const parsed = parseParamFileObject(
      legacyStepped,
      "stepped",
    ) as SteppedLayoutParams;

    expect(parsed.trayWidth).toBe(260);
    expect(parsed.trayDepth).toBe(50);
    expect(parsed.spacing).toBe(20);
    expect(parsed.holeDepth).toBe(20);
    expect(parsed.smoothingRadius).toBe(150);
    expect(parsed.disconnectDistance).toBe(
      STEPPED_LAYOUT_DEFAULTS.disconnectDistance,
    );
    expect(parsed.groups).toHaveLength(2);
    expect(parsed.activeGroupId).toBe(parsed.groups[0].id);
    expect(parsed.groups[0].bottomHeight).toBe(14);
    expect(parsed.groups[1].bottomHeight).toBe(18);
    expect(parsed.groups[0].groupSmoothingRadius).toBe(150);
    expect(parsed.groups[0].groupDisconnectDistance).toBe(0);
    expect(parsed.slots[0]).toMatchObject({
      id: "test-uuid",
      shape: "circle",
      height: 25,
      rotation: 270,
      groupId: parsed.groups[0].id,
    });
    expect(parsed.slots[1]).toMatchObject({
      id: "slot-2",
      rotation: 10,
      groupId: parsed.groups[1].id,
    });
    expect("bottomHeight" in parsed.slots[0]).toBe(false);
  });

  it("normalizes simple stepped files and rebuilds row membership", () => {
    const parsed = parseParamFileObject(
      {
        version: 1,
        mode: "simple-stepped" as AppMode,
        params: {
          trayWidth: 40,
          trayDepth: 50,
          rows: [],
          slots: [
            {
              shape: "ellipse",
              diameter: 25,
              x: 0,
              y: Number.NaN,
            },
          ],
          firstRowHeight: 99,
          stepHeight: 99,
          rowGap: 99,
          spacing: 99,
          outerMargin: 12,
          holeDepth: 99,
        },
      },
      "simple-stepped",
    ) as SimpleSteppedLayoutParams;

    const dimensions = calculateSimpleSteppedDimensions(parsed);

    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]).toMatchObject({
      id: "test-uuid",
      name: "行 1",
      slotIds: ["test-uuid"],
    });
    expect(parsed.slots[0]).toMatchObject({
      id: "test-uuid",
      shape: "circle",
      rowId: "test-uuid",
      y: 0,
    });
    expect(parsed.firstRowHeight).toBe(40);
    expect(parsed.stepHeight).toBe(40);
    expect(parsed.rowGap).toBe(40);
    expect(parsed.spacing).toBe(20);
    expect(parsed.outerMarginIndependent).toBe(true);
    expect(parsed.outerMargin).toBe(12);
    expect(parsed.holeDepth).toBe(20);
    expect(parsed.cornerRadius).toBe(SIMPLE_STEPPED_LAYOUT_DEFAULTS.cornerRadius);
    expect(parsed.trayWidth).toBeCloseTo(dimensions.width, 5);
    expect(parsed.trayDepth).toBeCloseTo(dimensions.depth, 5);
  });

  it("rejects invalid versions and mismatched modes", () => {
    expect(() =>
      parseParamFileObject(
        { version: 2, mode: "grid", params: DEFAULT_TRAY_PARAMS },
        "grid",
      ),
    ).toThrow("不支持的版本号");

    expect(() =>
      parseParamFileObject(
        { version: 1, mode: "custom", params: CUSTOM_LAYOUT_DEFAULTS },
        "grid",
      ),
    ).toThrow("模式不匹配");
  });

  it("imports files through FileReader and surfaces reader failures", async () => {
    const file = new File(
      [serializeParamFile("grid", DEFAULT_TRAY_PARAMS)],
      "grid.json",
      { type: "application/json" },
    );

    await expect(importParams(file, "grid")).resolves.toMatchObject(
      DEFAULT_TRAY_PARAMS,
    );

    class FailingFileReader {
      result: string | ArrayBuffer | null = null;
      error: DOMException | null = new DOMException("read failed");
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      readAsText() {
        this.onerror?.();
      }
    }

    const previousFileReader = globalThis.FileReader;
    Object.defineProperty(globalThis, "FileReader", {
      configurable: true,
      writable: true,
      value: FailingFileReader,
    });

    await expect(importParams(file, "grid")).rejects.toThrow("文件读取失败");

    Object.defineProperty(globalThis, "FileReader", {
      configurable: true,
      writable: true,
      value: previousFileReader,
    });
  });
});
