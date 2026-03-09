import { createTrayModel } from "../tray-model";
import { createCustomTrayModel } from "../custom-tray-model";
import { createSteppedTrayModel } from "../stepped-tray-model";
import stlSerializer from "@jscad/stl-serializer";
import { measureVolume } from "@jscad/modeling/src/measurements";
import type { Geom3 } from "@jscad/modeling/src/geometries/types";

// 定义通信接口
export type WorkerRequest =
  | { type: "GENERATE_GRID"; requestId: string; params: any }
  | { type: "GENERATE_CUSTOM"; requestId: string; params: any }
  | { type: "GENERATE_STEPPED"; requestId: string; params: any }
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
      const geometry = createCustomTrayModel(req.params);
      const volume = measureVolume(geometry);
      self.postMessage({
        type: "GENERATION_SUCCESS",
        requestId,
        geometry,
        volumeInfo: volume,
      });
    } else if (req.type === "GENERATE_STEPPED") {
      const shouldDebug =
        Boolean(
          (req.params as { debugOrientation?: boolean }).debugOrientation,
        ) ||
        (Array.isArray(req.params?.slots) && req.params.slots.length === 2);
      if (shouldDebug) {
        console.info("[STEPPED_ORIENT]", "worker_request", {
          requestId,
          slots: req.params?.slots?.length ?? 0,
          spacing: req.params?.spacing,
          smoothingRadius: req.params?.smoothingRadius,
          holeDepth: req.params?.holeDepth,
        });
      }

      const geometry = createSteppedTrayModel(req.params);
      const volume = measureVolume(geometry);
      if (shouldDebug) {
        console.info("[STEPPED_ORIENT]", "worker_result", {
          requestId,
          volume,
        });
      }
      self.postMessage({
        type: "GENERATION_SUCCESS",
        requestId,
        geometry,
        volumeInfo: volume,
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
  } catch (err: any) {
    self.postMessage({
      type: "ERROR",
      requestId,
      message: err.message || "Unknown worker error",
    });
  }
};
