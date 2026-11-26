import { createTrayModel, prepareGridTrayCutSource } from "../tray-model";
import { createCustomTrayModel, prepareCustomTrayCutSource } from "../custom-tray-model";
import { createBaseConverterModel } from "../base-converter-model";
import {
  createSteppedCadSplitParts,
  createSteppedCadTrayModel,
} from "../stepped-cad-construction";
import { buildSteppedOutlinePreview } from "../stepped-outline-preview";
import { createStorageSteppedPartModel } from "../storage-stepped-model";
import stlSerializer from "@jscad/stl-serializer";
import { measureVolume } from "@jscad/modeling/src/measurements";
import type { Geom3 } from "@jscad/modeling/src/geometries/types";
import type {
  BaseConverterParams,
  CustomLayoutParams,
  GroupOutlinePreview,
  SteppedLayoutParams,
} from "@/types/custom-tray";
import type { StorageSteppedParams } from "@/types/storage-stepped";
import type { StackableBoxParams, TrayParams } from "@/types/tray";
import { buildCustomContouredState } from "../custom-contoured-footprint";
import {
  constructSteppedContouredFootprintsOutcome,
  projectSteppedContouredFootprintInput,
  type ConstructedSteppedContouredFootprints,
} from "../stepped-contoured-footprint";
import type { ContouredFootprintState } from "../contoured-footprint-state";
import { resolveStackableBoxParams } from "../stackable-box";
import { createManualSplitScene, orientManualPrintPart, realizeManualSplitParts } from "../manual-split-cad";
import { closeManualSplitStl } from "../manual-split-stl";
import { validateManualSplitSettings, type ManualSplitScene } from "../manual-split-plan";
import { planManualSplitRoutes, type ManualSplitRoute } from "../manual-split-routes";
import type { SplitPoint, SplitRegion, SplitRing } from "../manual-split-geometry";
import type { ModeParamSnapshot } from "../mode-param-snapshot";
import {
  composeBoxAndLidPreview,
  createBoxSideBySidePreviewSpacing,
  createStackableBoxLid,
} from "../stackable-box-model";

function buildSteppedContouredState(
  params: SteppedLayoutParams,
): ContouredFootprintState<ConstructedSteppedContouredFootprints> {
  if (params.footprintStyle === "rectangular") return { status: "inactive" };
  const outcome = constructSteppedContouredFootprintsOutcome(
    projectSteppedContouredFootprintInput(params),
  );
  return outcome.ok
    ? { status: "ready", value: outcome.value }
    : { status: "failed", error: outcome.error };
}

/** 生成与盒体相同外部长宽的打印方向盖子。 */
function buildBoxLid(box: StackableBoxParams): Geom3 {
  return createStackableBoxLid({
    outerWidth: box.outerWidth,
    outerDepth: box.outerDepth,
    lidThickness: box.lidThickness,
    xyFitClearance: box.xyFitClearance,
  });
}

/** 组合直立盒体与旁置盖子预览几何。 */
function buildBoxPreviewGeometry(box: StackableBoxParams, body: Geom3, lid: Geom3) {
  const spacing = createBoxSideBySidePreviewSpacing(
    box.outerWidth,
    box.outerDepth,
  );
  return composeBoxAndLidPreview(body, lid, spacing);
}

// 定义通信接口
export type WorkerRequest =
  | { type: "GENERATE_GRID"; requestId: string; params: TrayParams }
  | {
      type: "PREPARE_MANUAL_SPLIT" | "GENERATE_MANUAL_SPLIT_PARTS";
      requestId: string;
      snapshot: ModeParamSnapshot<"grid"> | ModeParamSnapshot<"custom">;
      forPrint?: boolean;
    }
  | {
      type: "PLAN_MANUAL_SPLIT_ROUTE";
      requestId: string;
      region: SplitRegion;
      obstacles: SplitRing[];
      start: SplitPoint;
      end: SplitPoint;
      via?: SplitPoint;
    }
  | {
      type: "GENERATE_CUSTOM";
      requestId: string;
      params: CustomLayoutParams;
    }
  | {
      type: "GENERATE_BASE_CONVERTER";
      requestId: string;
      params: BaseConverterParams;
    }
  | {
      type: "GENERATE_STEPPED";
      requestId: string;
      params: SteppedLayoutParams;
    }
  | {
      type: "GENERATE_STEPPED_SPLIT_PARTS";
      requestId: string;
      params: SteppedLayoutParams;
    }
  | {
      type: "GENERATE_STEPPED_OUTLINE_PREVIEW";
      requestId: string;
      params: SteppedLayoutParams;
    }
  | {
      type: "GENERATE_STORAGE_STEPPED_PART";
      requestId: string;
      params: StorageSteppedParams;
      partId: string;
    }
  | {
      type: "GENERATE_GRID_BOX_PARTS";
      requestId: string;
      params: TrayParams;
    }
  | {
      type: "GENERATE_CUSTOM_BOX_PARTS";
      requestId: string;
      params: CustomLayoutParams;
    }
  | {
      type: "EXPORT_STL";
      requestId: string;
      geometry: Geom3;
      filename: string;
      verifyClosed?: boolean;
    };

export type WorkerResponse =
  | { type: "MANUAL_SPLIT_SCENE_SUCCESS"; requestId: string; scene: ManualSplitScene }
  | { type: "MANUAL_SPLIT_ROUTE_SUCCESS"; requestId: string; routes: ManualSplitRoute[] }
  | {
      type: "MANUAL_SPLIT_PARTS_SUCCESS";
      requestId: string;
      parts: ReturnType<typeof realizeManualSplitParts>;
    }
  | {
      type: "GENERATION_SUCCESS";
      requestId: string;
      geometry: Geom3;
      volumeInfo: number;
      /** 盒体预览时的盒体/盖子分项体积（普通托盘不返回）。 */
      bodyVolume?: number;
      lidVolume?: number;
    }
  | {
      type: "BOX_PARTS_SUCCESS";
      requestId: string;
      body: Geom3;
      lid: Geom3;
      bodyVolume: number;
      lidVolume: number;
    }
  | {
      type: "STEPPED_OUTLINE_PREVIEW_SUCCESS";
      requestId: string;
      outlinePreview: GroupOutlinePreview[] | null;
      durationMs: number;
    }
  | {
      type: "STEPPED_SPLIT_PARTS_SUCCESS";
      requestId: string;
      parts: {
        index: number;
        filenameLabel: string;
        label: string;
        fromHeight: number;
        toHeight: number;
        geometry: Geom3;
      }[];
    }
  | {
      type: "STORAGE_STEPPED_PART_SUCCESS";
      requestId: string;
      partId: string;
      geometry: Geom3;
      volume: number;
      assemblyOffset: [number, number, number];
    }
  | { type: "EXPORT_SUCCESS"; requestId: string; blob: Blob; filename: string }
  | { type: "ERROR"; requestId: string; message: string };

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const req = e.data;
  const { requestId } = req;

  try {
    if (req.type === "PREPARE_MANUAL_SPLIT" || req.type === "GENERATE_MANUAL_SPLIT_PARTS") {
      const { snapshot } = req;
      const settings = snapshot.params.manualSplit;
      validateManualSplitSettings(settings);
      if (!settings.enabled || resolveStackableBoxParams(snapshot.params.stackableBox).enabled) {
        throw new Error("请对普通托盘启用拆件打印");
      }
      if (req.type === "PREPARE_MANUAL_SPLIT") {
        const source = snapshot.mode === "grid"
          ? prepareGridTrayCutSource(snapshot.params)
          : prepareCustomTrayCutSource(snapshot.params, buildCustomContouredState(snapshot.params));
        const scene = createManualSplitScene(source, settings.clearance);
        self.postMessage({ type: "MANUAL_SPLIT_SCENE_SUCCESS", requestId, scene } satisfies WorkerResponse);
      } else {
        let scene!: ManualSplitScene;
        const capture = (source: Parameters<typeof createManualSplitScene>[0]) => {
          scene = createManualSplitScene(source, settings.clearance);
        };
        const model = snapshot.mode === "grid"
          ? createTrayModel(snapshot.params, capture)
          : createCustomTrayModel(snapshot.params, buildCustomContouredState(snapshot.params), capture);
        const parts = realizeManualSplitParts(model, scene, settings);
        if (req.forPrint) {
          for (const part of parts) {
            if (part.rotation === null) throw new Error(`零件 ${part.id} 超出打印范围，请继续拆分或修改打印尺寸`);
            part.geometry = orientManualPrintPart(part.geometry, part.rotation);
          }
        }
        self.postMessage({ type: "MANUAL_SPLIT_PARTS_SUCCESS", requestId, parts } satisfies WorkerResponse);
      }
    } else if (req.type === "PLAN_MANUAL_SPLIT_ROUTE") {
      const routes = planManualSplitRoutes(req.region, req.obstacles, req.start, req.end, req.via);
      self.postMessage({ type: "MANUAL_SPLIT_ROUTE_SUCCESS", requestId, routes } satisfies WorkerResponse);
    } else if (req.type === "GENERATE_GRID") {
      const geometry = createTrayModel(req.params);
      const box = resolveStackableBoxParams(req.params.stackableBox);
      if (box.enabled) {
        const lid = buildBoxLid(box);
        const bodyVolume = measureVolume(geometry);
        const lidVolume = measureVolume(lid);
        self.postMessage({
          type: "GENERATION_SUCCESS",
          requestId,
          geometry: buildBoxPreviewGeometry(box, geometry, lid),
          volumeInfo: bodyVolume + lidVolume,
          bodyVolume,
          lidVolume,
        });
      } else {
        const volume = measureVolume(geometry);
        self.postMessage({
          type: "GENERATION_SUCCESS",
          requestId,
          geometry,
          volumeInfo: volume,
        });
      }
    } else if (req.type === "GENERATE_CUSTOM") {
      const contouredState = buildCustomContouredState(req.params);
      const geometry = createCustomTrayModel(req.params, contouredState);
      const box = resolveStackableBoxParams(req.params.stackableBox);
      if (box.enabled) {
        const lid = buildBoxLid(box);
        const bodyVolume = measureVolume(geometry);
        const lidVolume = measureVolume(lid);
        self.postMessage({
          type: "GENERATION_SUCCESS",
          requestId,
          geometry: buildBoxPreviewGeometry(box, geometry, lid),
          volumeInfo: bodyVolume + lidVolume,
          bodyVolume,
          lidVolume,
        });
      } else {
        const volume = measureVolume(geometry);
        self.postMessage({
          type: "GENERATION_SUCCESS",
          requestId,
          geometry,
          volumeInfo: volume,
        });
      }
    } else if (req.type === "GENERATE_GRID_BOX_PARTS") {
      const box = resolveStackableBoxParams(req.params.stackableBox);
      const body = createTrayModel(req.params);
      const lid = buildBoxLid(box);
      self.postMessage({
        type: "BOX_PARTS_SUCCESS",
        requestId,
        body,
        lid,
        bodyVolume: measureVolume(body),
        lidVolume: measureVolume(lid),
      });
    } else if (req.type === "GENERATE_CUSTOM_BOX_PARTS") {
      const contouredState = buildCustomContouredState(req.params);
      const box = resolveStackableBoxParams(req.params.stackableBox);
      const body = createCustomTrayModel(req.params, contouredState);
      const lid = buildBoxLid(box);
      self.postMessage({
        type: "BOX_PARTS_SUCCESS",
        requestId,
        body,
        lid,
        bodyVolume: measureVolume(body),
        lidVolume: measureVolume(lid),
      });
    } else if (req.type === "GENERATE_BASE_CONVERTER") {
      const geometry = createBaseConverterModel(req.params);
      const volume = measureVolume(geometry);
      self.postMessage({
        type: "GENERATION_SUCCESS",
        requestId,
        geometry,
        volumeInfo: volume,
      });
    } else if (req.type === "GENERATE_STEPPED") {
      const contouredState = buildSteppedContouredState(req.params);
      const geometry = createSteppedCadTrayModel(req.params, contouredState);
      const volume = measureVolume(geometry);
      self.postMessage({
        type: "GENERATION_SUCCESS",
        requestId,
        geometry,
        volumeInfo: volume,
      });
    } else if (req.type === "GENERATE_STEPPED_SPLIT_PARTS") {
      const contouredState = buildSteppedContouredState(req.params);
      const parts = createSteppedCadSplitParts(
        req.params,
        contouredState,
      );
      self.postMessage({
        type: "STEPPED_SPLIT_PARTS_SUCCESS",
        requestId,
        parts,
      });
    } else if (req.type === "GENERATE_STEPPED_OUTLINE_PREVIEW") {
      const startedAt = performance.now();
      const contouredState = buildSteppedContouredState(req.params);
      const outlinePreview = buildSteppedOutlinePreview(
        req.params,
        contouredState,
      );
      self.postMessage({
        type: "STEPPED_OUTLINE_PREVIEW_SUCCESS",
        requestId,
        outlinePreview,
        durationMs: performance.now() - startedAt,
      });
    } else if (req.type === "GENERATE_STORAGE_STEPPED_PART") {
      const part = createStorageSteppedPartModel(req.params, req.partId);
      self.postMessage({
        type: "STORAGE_STEPPED_PART_SUCCESS",
        requestId,
        partId: part.partId,
        geometry: part.geometry,
        volume: part.volume,
        assemblyOffset: part.assemblyOffset,
      } satisfies WorkerResponse);
    } else if (req.type === "EXPORT_STL") {
      const rawData = stlSerializer.serialize({ binary: true }, req.geometry);
      const raw = new Blob(rawData as BlobPart[], { type: "application/sla" });
      const blob = req.verifyClosed ? await closeManualSplitStl(raw) : raw;
      if (!blob) throw new Error(`零件 ${req.filename} 的 STL 网格未闭合，请在二维编辑中调整分割线后重试`);
      self.postMessage({
        type: "EXPORT_SUCCESS",
        requestId,
        blob,
        filename: req.filename,
      });
    }
  } catch (err: unknown) {
    self.postMessage({
      type: "ERROR",
      requestId,
      message: err instanceof Error ? err.message : "Unknown worker error",
    });
  }
};
