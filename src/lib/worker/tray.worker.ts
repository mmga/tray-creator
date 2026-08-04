import { createTrayModel } from "../tray-model";
import { createCustomTrayModel } from "../custom-tray-model";
import { createBaseConverterModel } from "../base-converter-model";
import {
  createSteppedCadSplitParts,
  createSteppedCadTrayModel,
} from "../stepped-cad-tray-model";
import { buildSteppedOutlinePreview } from "../stepped-outline-preview";
import stlSerializer from "@jscad/stl-serializer";
import { measureVolume } from "@jscad/modeling/src/measurements";
import type { Geom3 } from "@jscad/modeling/src/geometries/types";
import type {
  BaseConverterParams,
  CustomLayoutParams,
  GroupOutlinePreview,
  SteppedLayoutParams,
} from "@/types/custom-tray";
import type { TrayParams } from "@/types/tray";
import {
  constructCustomContouredFootprintOutcome,
  projectCustomContouredFootprintInput,
} from "../custom-contoured-footprint";
import {
  constructSteppedContouredFootprintsOutcome,
  projectSteppedContouredFootprintInput,
  type ConstructedSteppedContouredFootprints,
} from "../stepped-contoured-footprint";
import type { ContouredFootprintState } from "../contoured-footprint-state";
import type { ConstructedContouredFootprint } from "../contoured-footprint";

function buildCustomContouredState(
  params: CustomLayoutParams,
): ContouredFootprintState<ConstructedContouredFootprint> {
  if (params.footprintStyle !== "contoured") return { status: "inactive" };
  const outcome = constructCustomContouredFootprintOutcome(
    projectCustomContouredFootprintInput(params),
  );
  return outcome.ok
    ? { status: "ready", value: outcome.value }
    : { status: "failed", error: outcome.error };
}

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

// 定义通信接口
export type WorkerRequest =
  | { type: "GENERATE_GRID"; requestId: string; params: TrayParams }
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
      type: "EXPORT_STL";
      requestId: string;
      geometry: Geom3;
      filename: string;
    };

export type WorkerResponse =
  | {
      type: "GENERATION_SUCCESS";
      requestId: string;
      geometry: Geom3;
      volumeInfo: number;
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
  | { type: "EXPORT_SUCCESS"; requestId: string; blob: Blob; filename: string }
  | { type: "ERROR"; requestId: string; message: string };

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const req = e.data;
  const { requestId } = req;

  try {
    if (req.type === "GENERATE_GRID") {
      const geometry = createTrayModel(req.params);
      const volume = measureVolume(geometry);
      self.postMessage({
        type: "GENERATION_SUCCESS",
        requestId,
        geometry,
        volumeInfo: volume,
      });
    } else if (req.type === "GENERATE_CUSTOM") {
      const contouredState = buildCustomContouredState(req.params);
      const geometry = createCustomTrayModel(req.params, contouredState);
      const volume = measureVolume(geometry);
      self.postMessage({
        type: "GENERATION_SUCCESS",
        requestId,
        geometry,
        volumeInfo: volume,
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
        req.params.splitGrooveDepth,
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
    } else if (req.type === "EXPORT_STL") {
      const rawData = stlSerializer.serialize({ binary: true }, req.geometry);
      const blob = new Blob(rawData as BlobPart[], { type: "application/sla" });
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
