import { describe, expect, it, vi } from "vitest";
import {
  createOldWorldGridSlotSnapshot,
  DEFAULT_TRAY_PARAMS,
} from "@/lib/grid-config";
import { CUSTOM_LAYOUT_DEFAULTS } from "@/lib/custom-config";
import { SIMPLE_STEPPED_LAYOUT_DEFAULTS } from "@/lib/simple-stepped-config";
import { STEPPED_LAYOUT_DEFAULTS } from "@/lib/stepped-config";
import { BASE_CONVERTER_DEFAULTS } from "@/lib/base-converter-config";
import type {
  AppMode,
  CustomLayoutParams,
  SimpleSteppedLayoutParams,
  SteppedLayoutParams,
} from "@/types/custom-tray";
import type { TrayParams } from "@/types/tray";
import { calculateSimpleSteppedDimensions } from "@/lib/simple-stepped-layout";
import {
  prepareParamImport,
} from "@/lib/param-io";
import { downloadParamFile } from "@/lib/param-download";
import {
  ParamArtifactReadError,
  prepareParamFileObject,
  readDraftParamArtifact as parseParamFileObject,
} from "@/lib/historical-param-artifact-reader";
import {
  buildCurrentParamArtifact,
  createCurrentParamArtifactBlob,
  serializeCurrentParamArtifact,
} from "@/lib/current-param-artifact-encoder";
import {
  captureModeParamSnapshot,
  type ParamsByMode,
} from "@/lib/mode-param-snapshot";

function buildParamFile<M extends AppMode>(mode: M, params: ParamsByMode[M]) {
  return buildCurrentParamArtifact(captureModeParamSnapshot(mode, params));
}

function serializeParamFile<M extends AppMode>(
  mode: M,
  params: ParamsByMode[M],
) {
  return serializeCurrentParamArtifact(captureModeParamSnapshot(mode, params));
}

function createParamBlob<M extends AppMode>(mode: M, params: ParamsByMode[M]) {
  return createCurrentParamArtifactBlob(
    captureModeParamSnapshot(mode, params),
  );
}

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

  it("preserves the real CAD stepped Mode in newly exported files", () => {
    const file = buildParamFile("stepped-cad", STEPPED_LAYOUT_DEFAULTS);
    expect(file).toMatchObject({
      version: 1,
      mode: "stepped-cad",
    });
    expect(parseParamFileObject(file, "stepped-cad")).toMatchObject(
      STEPPED_LAYOUT_DEFAULTS,
    );
    expect(() => parseParamFileObject(file, "stepped")).toThrow("模式不匹配");
  });

  it("round-trips declared base converter parameters", () => {
    const file = buildParamFile("base-converter", BASE_CONVERTER_DEFAULTS);
    expect(parseParamFileObject(file, "base-converter")).toEqual(
      BASE_CONVERTER_DEFAULTS,
    );
    expect(
      prepareParamFileObject(file),
    ).toMatchObject({
      status: "ready",
      candidate: { targetMode: "base-converter" },
    });
    expect(() => parseParamFileObject(file, "grid")).toThrow("模式不匹配");
  });

  it("prepares a normalized candidate with defaults and value adjustments", () => {
    const preparation = prepareParamFileObject({
      version: 1,
      mode: "grid",
      params: {
        ...DEFAULT_TRAY_PARAMS,
        rows: 99,
        spacing: 99,
        boundarySpacing: undefined,
        boundarySpacingIndependent: undefined,
      },
    }, { fileName: "legacy-grid.json" });

    expect(preparation.status).toBe("ready");
    if (preparation.status !== "ready") return;

    expect(preparation.candidate).toMatchObject({
      fileName: "legacy-grid.json",
      targetMode: "grid",
      params: {
        rows: 30,
        spacing: 10,
      },
      report: {
        modeResolution: {
          kind: "declared",
          targetMode: "grid",
        },
      },
    });
    expect(preparation.candidate.report.adjustments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "default",
          path: "boundarySpacing",
        }),
        expect.objectContaining({
          category: "value-adjustment",
          path: "rows",
          previousValue: 99,
          normalizedValue: 30,
        }),
      ]),
    );
  });

  it("在导入报告中列出底板孔位触发的自动增厚", () => {
    const preparation = prepareParamFileObject({
      version: 1,
      mode: "grid",
      params: {
        ...DEFAULT_TRAY_PARAMS,
        baseHoleStructure: undefined,
        enableBaseHole: true,
        baseThickness: 1,
      },
    });

    expect(preparation.status).toBe("ready");
    if (preparation.status !== "ready") return;

    expect(preparation.candidate.params).toMatchObject({
      baseHoleStructure: "magnetic-base-hole",
      baseThickness: 2.4,
    });
    expect(preparation.candidate.report.adjustments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "behavior",
          path: "baseThickness",
          previousValue: 1,
          normalizedValue: 2.4,
        }),
      ]),
    );
  });

  it("infers wrapperless Mode and requires a choice for historical stepped files", () => {
    const inferred = prepareParamFileObject({
      ...CUSTOM_LAYOUT_DEFAULTS,
      slots: [],
    });
    expect(inferred).toMatchObject({
      status: "ready",
      candidate: {
        targetMode: "custom",
        report: { modeResolution: { kind: "inferred" } },
      },
    });

    const ambiguous = prepareParamFileObject({
      version: 1,
      mode: "stepped",
      params: STEPPED_LAYOUT_DEFAULTS,
    });
    expect(ambiguous).toEqual({
      status: "mode-selection-required",
      fileName: "参数文件",
      choices: ["stepped", "stepped-cad"],
      message: "历史阶梯文件没有区分普通阶梯与 CAD 阶梯，请选择原始 Mode",
    });

    const selected = prepareParamFileObject(
      {
        version: 1,
        mode: "stepped",
        params: STEPPED_LAYOUT_DEFAULTS,
      },
      { selectedMode: "stepped-cad" },
    );
    expect(selected).toMatchObject({
      status: "ready",
      candidate: {
        targetMode: "stepped-cad",
        report: { modeResolution: { kind: "selected" } },
      },
    });
  });

  it("rejects declared Mode and parameter shape conflicts", () => {
    expect(() => prepareParamFileObject({
      version: 1,
      mode: "grid",
      params: {
        ...STEPPED_LAYOUT_DEFAULTS,
        groups: STEPPED_LAYOUT_DEFAULTS.groups,
        slots: [],
      },
    })).toThrow("声明 Mode「网格」与参数结构不一致");
  });

  it("reports retired fields without retaining them in the candidate", () => {
    const preparation = prepareParamFileObject(
      {
        version: 1,
        mode: "stepped",
        params: {
          ...STEPPED_LAYOUT_DEFAULTS,
          groups: STEPPED_LAYOUT_DEFAULTS.groups.map((group, index) => ({
            ...group,
            splitPartGroupId: index === 0 ? "legacy-target" : null,
          })),
        },
      },
      { selectedMode: "stepped" },
    );

    expect(preparation.status).toBe("ready");
    if (preparation.status !== "ready") return;

    expect(preparation.candidate.report.retiredFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "groups[0].splitPartGroupId",
          previousValue: "legacy-target",
        }),
      ]),
    );
    expect(
      "splitPartGroupId" in
        (preparation.candidate.params as SteppedLayoutParams).groups[0],
    ).toBe(false);
  });

  it("prepares imported files without committing editor state", async () => {
    const file = new File(
      [serializeParamFile("custom", CUSTOM_LAYOUT_DEFAULTS)],
      "custom.json",
      { type: "application/json" },
    );

    await expect(prepareParamImport(file)).resolves.toMatchObject({
      status: "ready",
      candidate: {
        fileName: "custom.json",
        targetMode: "custom",
      },
    });
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

    downloadParamFile(
      captureModeParamSnapshot("grid", params),
      "grid.json",
    );

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
        baseHoleStructure: undefined,
        enableBaseHole: undefined,
        basePlateOnly: undefined,
      },
    };

    const parsed = parseParamFileObject(gridFile, "grid") as TrayParams;

    expect(parsed.columns).toBe(30);
    expect(parsed.rows).toBe(30);
    expect(parsed.spacing).toBe(10);
    expect(parsed.baseThickness).toBe(4);
    expect(parsed.holeDepth).toBe(4);
    expect(parsed.cornerRadius).toBe(10);
    expect(parsed.boundarySpacing).toBe(parsed.spacing);
    expect(parsed.boundarySpacingIndependent).toBe(false);
    expect(parsed.halfCircleSlots).toBe(false);
    expect(parsed.basePlateOnly).toBe(false);
    expect(parsed.baseHoleStructure).toBe("none");
    expect(parsed.enableBaseHole).toBeUndefined();
    expect(parsed.slotDefinitionId).toBe("circle-32");
    expect(parsed.slotDiameter).toBeCloseTo(32.4, 5);
  });

  it("imports legacy raw grid exports without a wrapper", () => {
    const parsed = parseParamFileObject(
      {
        ...DEFAULT_TRAY_PARAMS,
        rows: 99,
        columns: 99,
      },
      "grid",
    ) as TrayParams;

    expect(parsed.rows).toBe(30);
    expect(parsed.columns).toBe(30);
    expect(parsed.slotDefinitionId).toBe("circle-32");
  });

  it("preserves Old World rectangular slot snapshots in grid files", () => {
    const parsed = parseParamFileObject(
      {
        version: 1,
        mode: "grid" as AppMode,
        params: {
          ...DEFAULT_TRAY_PARAMS,
          ...createOldWorldGridSlotSnapshot({
            id: "old-world-30x60",
            name: "旧世界 30×60mm",
            width: 30,
            height: 60,
          }),
          halfCircleSlots: true,
        },
      },
      "grid",
    ) as TrayParams;

    expect(parsed).toMatchObject({
      slotShape: "rectangle",
      slotDefinitionId: "old-world-30x60",
      slotBaseWidth: 30,
      slotBaseHeight: 60,
      slotWidth: 30.4,
      slotHeight: 60.4,
      halfCircleSlots: false,
      baseHoleSize: "25",
    });
  });

  it("preserves imported half-circle slots only for single-axis grids", () => {
    const singleRow = parseParamFileObject(
      {
        version: 1,
        mode: "grid" as AppMode,
        params: {
          ...DEFAULT_TRAY_PARAMS,
          rows: 1,
          halfCircleSlots: true,
        },
      },
      "grid",
    ) as TrayParams;
    const singleColumn = parseParamFileObject(
      {
        version: 1,
        mode: "grid" as AppMode,
        params: {
          ...DEFAULT_TRAY_PARAMS,
          rows: 3,
          columns: 1,
          halfCircleSlots: true,
        },
      },
      "grid",
    ) as TrayParams;
    const multiRow = parseParamFileObject(
      {
        version: 1,
        mode: "grid" as AppMode,
        params: {
          ...DEFAULT_TRAY_PARAMS,
          rows: 2,
          columns: 2,
          halfCircleSlots: true,
        },
      },
      "grid",
    ) as TrayParams;

    expect(singleRow.halfCircleSlots).toBe(true);
    expect(singleColumn.halfCircleSlots).toBe(true);
    expect(multiRow.halfCircleSlots).toBe(false);
  });

  it("imports base-plate-only grid mode as a mutually exclusive magnetic base", () => {
    const parsed = parseParamFileObject(
      {
        version: 1,
        mode: "grid" as AppMode,
        params: {
          ...DEFAULT_TRAY_PARAMS,
          rows: 1,
          halfCircleSlots: true,
          basePlateOnly: true,
          enableBaseHole: false,
        },
      },
      "grid",
    ) as TrayParams;

    expect(parsed.basePlateOnly).toBe(true);
    expect(parsed.halfCircleSlots).toBe(false);
    expect(parsed.baseHoleStructure).toBe("magnetic-base-hole");
    expect(parsed.enableBaseHole).toBeUndefined();
  });

  it("rejects implicit custom to stepped conversion", () => {
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

    expect(() =>
      parseParamFileObject(
        { version: 1, mode: "custom", params: customParams },
        "stepped",
      ),
    ).toThrow(expect.objectContaining({ code: "mode-mismatch" }));
  });

  it("imports legacy raw custom exports without a wrapper", () => {
    const parsed = parseParamFileObject(
      {
        ...CUSTOM_LAYOUT_DEFAULTS,
        trayWidth: 260,
        trayDepth: 260,
        slots: [
          {
            id: "slot-1",
            x: 130,
            y: 130,
            shape: "circle",
            width: 25,
            height: 25,
            slotDefinitionId: "circle-25",
            slotWidth: 25.2,
            slotHeight: 25.2,
            rotation: 0,
          },
        ],
      },
      "custom",
    ) as CustomLayoutParams;

    expect(parsed.trayWidth).toBe(260);
    expect(parsed.trayDepth).toBe(260);
    expect(parsed.slots[0]).toMatchObject({
      id: "slot-1",
      slotDefinitionId: "circle-25",
      slotWidth: 25.2,
      slotHeight: 25.2,
    });
  });

  it("normalizes slot definitions and geometry snapshots on custom import", () => {
    const parsed = parseParamFileObject(
      {
        version: 1,
        mode: "custom" as AppMode,
        params: {
          ...CUSTOM_LAYOUT_DEFAULTS,
          slots: [
            {
              id: "circle-1",
              x: 20,
              y: 30,
              width: 40,
              height: 40,
              rotation: 0,
              shape: "circle",
            },
            {
              id: "ellipse-1",
              x: 40,
              y: 50,
              width: 75,
              height: 42,
              rotation: 405,
              shape: "ellipse",
              outerOffset: 0.6,
              profileExponent: 2.08,
            },
          ],
        },
      },
      "custom",
    ) as CustomLayoutParams;

    expect(parsed.slots[0]).toMatchObject({
      id: "circle-1",
      slotDefinitionId: "circle-40",
      slotWidth: 40.4,
      slotHeight: 40.4,
    });
    expect(parsed.slots[1]).toMatchObject({
      id: "ellipse-1",
      rotation: 45,
      slotDefinitionId: "ellipse-75x42",
      outerOffset: 0.6,
      profileExponent: 2.08,
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

    expect(parsed.trayWidth).toBe(500);
    expect(parsed.trayDepth).toBe(50);
    expect(parsed.spacing).toBe(20);
    expect(parsed.holeDepth).toBe(20);
    expect(parsed.splitGrooveDepth).toBe(
      STEPPED_LAYOUT_DEFAULTS.splitGrooveDepth,
    );
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

  it("migrates legacy CAD assembly fields after explicit external Mode selection", () => {
    const legacySteppedParams = { ...STEPPED_LAYOUT_DEFAULTS };
    delete legacySteppedParams.enableSplitRecess;
    delete legacySteppedParams.enableSplitLocators;
    const preparation = prepareParamFileObject(
      {
        version: 1,
        mode: "stepped",
        params: {
          ...legacySteppedParams,
          splitAssemblyMode: "locator-recess",
        },
      },
      { selectedMode: "stepped-cad" },
    );
    expect(preparation.status).toBe("ready");
    if (preparation.status !== "ready") return;
    const parsed = preparation.candidate.params as SteppedLayoutParams;

    expect(parsed.enableSplitRecess).toBe(true);
    expect(parsed.splitGrooveType).toBe("profile");
    expect(parsed.enableSplitLocators).toBe(true);
    expect(parsed.splitAssemblyMode).toBeUndefined();
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

  it("reports stable semantic read error codes", () => {
    const readError = (action: () => unknown) => {
      try {
        action();
        throw new Error("expected read failure");
      } catch (error) {
        expect(error).toBeInstanceOf(ParamArtifactReadError);
        return error as ParamArtifactReadError;
      }
    };

    expect(readError(() => prepareParamFileObject(null)).code).toBe(
      "invalid-content",
    );
    expect(readError(() => prepareParamFileObject({
      version: 2,
      mode: "grid",
      params: DEFAULT_TRAY_PARAMS,
    })).code).toBe("unsupported-version");
    expect(readError(() => prepareParamFileObject({
      version: 1,
      mode: "unknown",
      params: DEFAULT_TRAY_PARAMS,
    })).code).toBe("invalid-mode");
    expect(readError(() => prepareParamFileObject({
      version: 1,
      mode: "grid",
      params: null,
    })).code).toBe("invalid-params");
    expect(readError(() => prepareParamFileObject({ value: true })).code).toBe(
      "unrecognized-structure",
    );
    expect(readError(() => prepareParamFileObject({
      version: 1,
      mode: "grid",
      params: STEPPED_LAYOUT_DEFAULTS,
    })).code).toBe("mode-structure-conflict");
    expect(readError(() => parseParamFileObject(
      { version: 1, mode: "custom", params: CUSTOM_LAYOUT_DEFAULTS },
      "grid",
    )).code).toBe("mode-mismatch");

    const normalizationError = readError(() => prepareParamFileObject({
      version: 1,
      mode: "grid",
      params: { rows: 2, columns: 2 },
    }));
    expect(normalizationError.code).toBe("normalization-failed");
    expect(normalizationError.cause).toBeInstanceOf(Error);
  });

  it("imports files through FileReader and surfaces reader failures", async () => {
    const file = new File(
      [serializeParamFile("grid", DEFAULT_TRAY_PARAMS)],
      "grid.json",
      { type: "application/json" },
    );

    await expect(prepareParamImport(file)).resolves.toMatchObject({
      status: "ready",
      candidate: {
        targetMode: "grid",
        params: DEFAULT_TRAY_PARAMS,
      },
    });

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

    await expect(prepareParamImport(file)).rejects.toMatchObject({
      code: "invalid-content",
      message: "文件读取失败",
    });

    Object.defineProperty(globalThis, "FileReader", {
      configurable: true,
      writable: true,
      value: previousFileReader,
    });
  });
});
