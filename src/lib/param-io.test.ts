import { describe, expect, it, vi } from "vitest";
import {
  createOldWorldGridSlotSnapshot,
  DEFAULT_TRAY_PARAMS,
} from "@/lib/grid-config";
import { CUSTOM_LAYOUT_DEFAULTS } from "@/lib/custom-config";
import { STEPPED_LAYOUT_DEFAULTS } from "@/lib/stepped-config";
import { BASE_CONVERTER_DEFAULTS } from "@/lib/base-converter-config";
import type {
  AppMode,
  BaseConverterParams,
  CustomLayoutParams,
  SteppedLayoutParams,
} from "@/types/custom-tray";
import type { TrayParams } from "@/types/tray";
import {
  MAX_PARAM_FILE_BYTES,
  ParamFileSourceError,
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
  createModelGeometryFingerprint,
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

  it("新导出的阶梯文件只使用统一 Mode", () => {
    const file = buildParamFile("stepped", STEPPED_LAYOUT_DEFAULTS);
    expect(file).toMatchObject({
      version: 1,
      mode: "stepped",
    });
    expect(parseParamFileObject(file, "stepped")).toMatchObject(
      STEPPED_LAYOUT_DEFAULTS,
    );
  });

  it("round-trips declared base converter parameters", () => {
    const file = buildParamFile("base-converter", BASE_CONVERTER_DEFAULTS);
    expect(parseParamFileObject(file, "base-converter")).toEqual(
      BASE_CONVERTER_DEFAULTS,
    );
    const preparation = prepareParamFileObject(file);
    expect(preparation).toMatchObject({
      status: "ready",
      candidate: { mode: "base-converter" },
    });
    expect(preparation.status === "ready"
      ? preparation.candidate.report.adjustments
      : null).toEqual([]);
    expect(() => parseParamFileObject(file, "grid")).toThrow("模式不匹配");
  });

  it("round-trips embedded custom conversion geometry without using the personal library", () => {
    const params: BaseConverterParams = {
      ...BASE_CONVERTER_DEFAULTS,
      sourceStandardId: "custom-source-file",
      targetStandardId: "custom-target-file",
      geometrySnapshot: {
        source: {
          customId: "custom-source-file",
          name: "外部实测矩形",
          shape: "rectangle",
          nominalWidth: 25,
          nominalDepth: 50,
          fitWidth: 24.8,
          fitDepth: 49.7,
          cornerRadius: 1.5,
        },
        target: {
          customId: "custom-target-file",
          name: "外部丰满椭圆",
          shape: "ellipse",
          width: 40,
          depth: 80,
          profileExponent: 3.1,
        },
      },
    };
    const libraryKey = "tray-creator:personal-base-specifications:v1";
    const libraryBefore = window.localStorage.getItem(libraryKey);

    const parsed = parseParamFileObject(
      buildParamFile("base-converter", params),
      "base-converter",
    );

    expect(parsed).toEqual(params);
    expect(window.localStorage.getItem(libraryKey)).toBe(libraryBefore);
  });

  it("migrates legacy base converter ids into a reported geometry snapshot", () => {
    const preparation = prepareParamFileObject({
      version: 1,
      mode: "base-converter",
      params: {
        sourceStandardId: "source-25x50",
        targetStandardId: "target-ellipse-35x60",
        floorThickness: 1.2,
        recessDepth: 2,
      },
    }, { fileName: "legacy-base-converter.json" });

    expect(preparation.status).toBe("ready");
    if (preparation.status !== "ready") return;
    expect(preparation.candidate.snapshot.params).toMatchObject({
      generationKind: "conversion",
      roundBaseStandardId: "round-32",
      roundBaseSnapshot: {
        standardId: "round-32",
        nominalDiameter: 32,
        height: 4,
        topInset: 1.5,
      },
      pushFitHexHole: { acrossFlats: 3.6, offsetX: 7, offsetY: 5 },
      conversionClearance: 0.2,
      sideBevelWidth: 0,
      geometrySnapshot: {
        source: { standardId: "source-25x50", fitWidth: 25, fitDepth: 50 },
        target: { standardId: "target-ellipse-35x60", profileExponent: 2.05 },
      },
    });
    expect(preparation.candidate.report.adjustments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "migration",
          path: "geometrySnapshot",
          label: "转换几何快照",
        }),
        expect.objectContaining({
          category: "default",
          path: "generationKind",
          normalizedValue: "conversion",
        }),
        expect.objectContaining({
          category: "default",
          path: "roundBaseSnapshot",
        }),
      ]),
    );
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
      mode: "grid",
      snapshot: {
        params: {
          rows: 30,
          spacing: 10,
        },
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

    expect(preparation.candidate.snapshot.params).toMatchObject({
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

  it("推断无包装 Mode，并将历史阶梯文件直接归一为统一 Mode", () => {
    const inferred = prepareParamFileObject({
      ...CUSTOM_LAYOUT_DEFAULTS,
      slots: [],
    });
    expect(inferred).toMatchObject({
      status: "ready",
      candidate: {
        mode: "custom",
        report: { modeResolution: { kind: "inferred" } },
      },
    });

    const historicalStepped = prepareParamFileObject({
      version: 1,
      mode: "stepped",
      params: STEPPED_LAYOUT_DEFAULTS,
    });
    expect(historicalStepped).toMatchObject({
      status: "ready",
      candidate: {
        mode: "stepped",
        snapshot: { params: { enableSplitAssembly: false } },
      },
    });

    const historicalCadParams: Partial<SteppedLayoutParams> = {
      ...STEPPED_LAYOUT_DEFAULTS,
    };
    delete historicalCadParams.enableSplitAssembly;
    const historicalCad = prepareParamFileObject({
      version: 1,
      mode: "stepped-cad",
      params: historicalCadParams,
    });
    expect(historicalCad).toMatchObject({
      status: "ready",
      candidate: {
        mode: "stepped",
        snapshot: { params: { enableSplitAssembly: true } },
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
          activeGroupId: STEPPED_LAYOUT_DEFAULTS.groups[0].id,
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
        expect.objectContaining({
          path: "activeGroupId",
          previousValue: STEPPED_LAYOUT_DEFAULTS.groups[0].id,
        }),
      ]),
    );
    expect(preparation.candidate.snapshot.params).not.toHaveProperty(
      "activeGroupId",
    );
    expect(
      "splitPartGroupId" in
        (preparation.candidate.snapshot.params as SteppedLayoutParams).groups[0],
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
        mode: "custom",
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
              height: 43.2,
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
    expect(parsed).not.toHaveProperty("activeGroupId");
    expect(parsed.groups[0].bottomHeight).toBe(14);
    expect(parsed.groups[1].bottomHeight).toBe(18);
    expect(parsed.groups[0].groupSmoothingRadius).toBe(150);
    expect(parsed.groups[0].groupDisconnectDistance).toBe(0);
    expect(parsed.slots[0]).toMatchObject({
      id: "test-uuid",
      shape: "ellipse",
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

  it("迁移历史 CAD 装配字段并默认开启分件能力", () => {
    const legacySteppedParams: Partial<SteppedLayoutParams> = {
      ...STEPPED_LAYOUT_DEFAULTS,
    };
    delete legacySteppedParams.enableSplitAssembly;
    delete legacySteppedParams.enableSplitRecess;
    delete legacySteppedParams.enableSplitLocators;
    const preparation = prepareParamFileObject(
      {
        version: 1,
        mode: "stepped-cad",
        params: {
          ...legacySteppedParams,
          splitAssemblyMode: "locator-recess",
        },
      },
    );
    expect(preparation.status).toBe("ready");
    if (preparation.status !== "ready") return;
    const parsed = preparation.candidate.snapshot.params as SteppedLayoutParams;

    expect(parsed.enableSplitRecess).toBe(true);
    expect(parsed.enableSplitAssembly).toBe(true);
    expect(parsed.splitGrooveType).toBe("profile");
    expect(parsed.enableSplitLocators).toBe(true);
    expect(parsed.splitAssemblyMode).toBeUndefined();
  });

  it("历史 simple-stepped 文件读取时归一转换为 stepped（CONTEXT:580-583）", () => {
    // 历史 simple-stepped 文件不再作为独立 Mode 读取，统一归一到 stepped
    const parsed = parseParamFileObject(
      {
        version: 1,
        mode: "simple-stepped" as AppMode,
        params: {
          trayWidth: 120,
          trayDepth: 80,
          rows: [
            { id: "row-1", name: "行 1", slotIds: ["s1"] },
          ],
          slots: [
            { id: "s1", rowId: "row-1", shape: "circle", diameter: 25, x: 0, y: 0 },
          ],
          firstRowHeight: 10,
          stepHeight: 5,
          rowGap: 2,
          spacing: 5,
          outerMargin: 5,
          holeDepth: 3,
        },
      },
      "stepped",
    ) as SteppedLayoutParams;

    // 转换结果应为 stepped 参数，使用 rectangular footprint（CONTEXT:593）
    expect(parsed.footprintStyle).toBe("rectangular");
    expect(parsed.traySizingMode).toBe("fixed");
    expect(parsed.groups.length).toBe(1);
    expect(parsed.groups[0].bottomHeight).toBe(10);
    expect(parsed.slots.length).toBe(1);
    expect(parsed.slots[0].groupId).toBe("row-1");
  });

  it("拒绝以 simple-stepped 作为 expectedMode（已不再是独立 Mode）", () => {
    expect(() =>
      parseParamFileObject(
        {
          version: 1,
          mode: "simple-stepped" as AppMode,
          params: {
            trayWidth: 40,
            trayDepth: 50,
            rows: [],
            slots: [],
            firstRowHeight: 10,
            stepHeight: 5,
            rowGap: 2,
            spacing: 5,
            outerMargin: 5,
            holeDepth: 3,
          },
        },
        "simple-stepped" as AppMode,
      ),
    ).toThrow("模式不匹配");
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
        mode: "grid",
        snapshot: { params: DEFAULT_TRAY_PARAMS },
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

  it("round-trips push-fit parameters without changing the model fingerprint", () => {
    const params = {
      ...BASE_CONVERTER_DEFAULTS,
      generationKind: "push-fit" as const,
      pushFitHexHole: { acrossFlats: 3.15, offsetX: 1.2, offsetY: -0.8 },
    };
    const parsed = parseParamFileObject(
      buildParamFile("base-converter", params),
      "base-converter",
    );

    expect(parsed).toEqual(params);
    expect(createModelGeometryFingerprint(captureModeParamSnapshot("base-converter", parsed)))
      .toBe(createModelGeometryFingerprint(captureModeParamSnapshot("base-converter", params)));
  });

  it("round-trips box parameters without changing the model fingerprint", () => {
    const params = {
      ...DEFAULT_TRAY_PARAMS,
      stackableBox: {
        ...DEFAULT_TRAY_PARAMS.stackableBox!,
        enabled: true,
        outerWidth: 200,
        outerDepth: 150,
        outerHeight: 50,
        minimumWallClearance: 2,
        xyFitClearance: 0.25,
        lidThickness: 2.4,
      },
    };
    const parsed = parseParamFileObject(
      buildParamFile("grid", params),
      "grid",
    ) as TrayParams;

    expect(parsed.stackableBox).toMatchObject({
      enabled: true,
      outerWidth: 200,
      outerDepth: 150,
      outerHeight: 50,
    });
    expect(
      createModelGeometryFingerprint(captureModeParamSnapshot("grid", parsed)),
    ).toBe(
      createModelGeometryFingerprint(captureModeParamSnapshot("grid", params)),
    );
  });

  it("rejects oversized parameter files before starting FileReader", async () => {
    const serialized = serializeParamFile("grid", DEFAULT_TRAY_PARAMS);
    let constructorCalls = 0;
    let readCalls = 0;

    class TrackingFileReader {
      result: string | ArrayBuffer | null = serialized;
      error: DOMException | null = null;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onabort: (() => void) | null = null;

      constructor() {
        constructorCalls += 1;
      }

      readAsText() {
        readCalls += 1;
        this.onload?.();
      }
    }

    const createSizedFile = (size: number) => ({
      name: "grid.json",
      size,
    }) as File;
    const previousFileReader = globalThis.FileReader;
    Object.defineProperty(globalThis, "FileReader", {
      configurable: true,
      writable: true,
      value: TrackingFileReader,
    });

    try {
      await expect(prepareParamImport(
        createSizedFile(MAX_PARAM_FILE_BYTES - 1),
      )).resolves.toMatchObject({ status: "ready" });
      await expect(prepareParamImport(
        createSizedFile(MAX_PARAM_FILE_BYTES),
      )).resolves.toMatchObject({ status: "ready" });

      const oversizedRead = prepareParamImport(
        createSizedFile(MAX_PARAM_FILE_BYTES + 1),
      );
      await expect(oversizedRead).rejects.toBeInstanceOf(ParamFileSourceError);
      await expect(oversizedRead).rejects.toMatchObject({
        code: "file-too-large",
        message: "参数文件不能超过 5 MiB",
      });
      expect(constructorCalls).toBe(2);
      expect(readCalls).toBe(2);
    } finally {
      Object.defineProperty(globalThis, "FileReader", {
        configurable: true,
        writable: true,
        value: previousFileReader,
      });
    }
  });
});
