import { createTrayModel } from "../tray-model";
import { createCustomTrayModel } from "../custom-tray-model";
import stlSerializer from "@jscad/stl-serializer";
import { measureVolume } from "@jscad/modeling/src/measurements";
import type { Geom3 } from "@jscad/modeling/src/geometries/types";

// 定义通信接口
export type WorkerRequest =
    | { type: "GENERATE_GRID"; requestId: string; params: any }
    | { type: "GENERATE_CUSTOM"; requestId: string; params: any }
    | { type: "EXPORT_STL"; requestId: string; geometry: Geom3; filename: string };

export type WorkerResponse =
    | { type: "GENERATION_SUCCESS"; requestId: string; geometry: Geom3; volumeInfo: number }
    | { type: "EXPORT_SUCCESS"; requestId: string; blob: Blob; filename: string }
    | { type: "ERROR"; requestId: string; message: string };

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
    const req = e.data;
    const { requestId } = req;

    try {
        if (req.type === "GENERATE_GRID") {
            const geometry = createTrayModel(req.params);
            const volume = measureVolume(geometry);
            self.postMessage({ type: "GENERATION_SUCCESS", requestId, geometry, volumeInfo: volume });
        }
        else if (req.type === "GENERATE_CUSTOM") {
            const geometry = createCustomTrayModel(req.params);
            const volume = measureVolume(geometry);
            self.postMessage({ type: "GENERATION_SUCCESS", requestId, geometry, volumeInfo: volume });
        }
        else if (req.type === "EXPORT_STL") {
            // 在 Worker 线程中进行 STL 序列化也是密集型计算
            const rawData = stlSerializer.serialize({ binary: true }, req.geometry);
            // 将多个 ArrayBuffer 或 blob 片段合并
            const blob = new Blob(rawData as BlobPart[], { type: "application/sla" });
            self.postMessage({ type: "EXPORT_SUCCESS", requestId, blob, filename: req.filename });
        }
    } catch (err: any) {
        self.postMessage({ type: "ERROR", requestId, message: err.message || "Unknown worker error" });
    }
};
