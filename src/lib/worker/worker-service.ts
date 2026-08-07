import type { Geom3 } from "@jscad/modeling/src/geometries/types";
import type { TrayParams } from "@/types/tray";
import type {
  BaseConverterParams,
  CustomLayoutParams,
  GroupOutlinePreview,
  SteppedLayoutParams,
} from "@/types/custom-tray";
import type { WorkerRequest, WorkerResponse } from "./tray.worker";

let _nextId = 0;
function generateRequestId(): string {
  return `req_${++_nextId}_${Date.now()}`;
}

interface PendingRequest {
  resolveResponse: (response: WorkerResponse) => void;
  reject: (reason: Error) => void;
}

function toWorkerError(reason: unknown, fallbackMessage: string): Error {
  if (reason instanceof Error) return reason;
  if (
    reason &&
    typeof reason === "object" &&
    "message" in reason &&
    typeof reason.message === "string" &&
    reason.message
  ) {
    return new Error(`${fallbackMessage}：${reason.message}`);
  }
  return new Error(fallbackMessage);
}

class TrayWorkerService {
  private worker: Worker | null = null;
  private workerUnavailableReason: Error | null = null;
  private pendingRequests = new Map<string, PendingRequest>();

  constructor() {
    if (typeof window !== "undefined") {
      this.initWorker();
    }
  }

  private initWorker() {
    try {
      const worker = new Worker(new URL("./tray.worker.ts", import.meta.url), {
        type: "module",
      });
      worker.onmessage = this.handleMessage.bind(this);
      worker.onerror = (event) => {
        this.handleWorkerFailure(event, "后台建模 Worker 运行失败");
      };
      worker.onmessageerror = (event) => {
        this.handleWorkerFailure(event, "后台建模 Worker 响应无法读取");
      };
      this.worker = worker;
      this.workerUnavailableReason = null;
    } catch (error) {
      this.worker = null;
      this.workerUnavailableReason = toWorkerError(
        error,
        "后台建模 Worker 初始化失败",
      );
    }
  }

  private handleWorkerFailure(reason: unknown, fallbackMessage: string) {
    const error = toWorkerError(reason, fallbackMessage);
    const worker = this.worker;
    this.worker = null;
    this.workerUnavailableReason = error;
    worker?.terminate();
    this.rejectAllPending(error);
  }

  private rejectAllPending(error: Error) {
    const pendingRequests = [...this.pendingRequests.values()];
    this.pendingRequests.clear();
    for (const pending of pendingRequests) {
      pending.reject(error);
    }
  }

  private handleMessage(event: MessageEvent<WorkerResponse>) {
    const data = event.data;
    const pending = this.pendingRequests.get(data.requestId);
    if (!pending) return;
    this.pendingRequests.delete(data.requestId);

    if (data.type === "ERROR") {
      pending.reject(new Error(data.message));
    } else {
      pending.resolveResponse(data);
    }
  }

  private request<TResult>(
    createRequest: (requestId: string) => WorkerRequest,
    decodeResponse: (response: WorkerResponse) => TResult,
  ): Promise<TResult> {
    const worker = this.worker;
    if (!worker) {
      return Promise.reject(
        this.workerUnavailableReason ?? new Error("后台建模 Worker 当前不可用"),
      );
    }

    const requestId = generateRequestId();
    return new Promise<TResult>((resolve, reject) => {
      const rejectWithError = (reason: unknown) => {
        reject(toWorkerError(reason, "后台建模 Worker 请求失败"));
      };
      this.pendingRequests.set(requestId, {
        reject: rejectWithError,
        resolveResponse: (response) => {
          try {
            resolve(decodeResponse(response));
          } catch (error) {
            rejectWithError(error);
          }
        },
      });

      try {
        worker.postMessage(createRequest(requestId));
      } catch (error) {
        this.pendingRequests.delete(requestId);
        rejectWithError(error);
      }
    });
  }

  public async generateGrid(
    params: TrayParams,
  ): Promise<{ geometry: Geom3; volume: number }> {
    return this.request(
      (requestId) => ({ type: "GENERATE_GRID", requestId, params }),
      (data) => {
        if (data.type !== "GENERATION_SUCCESS") {
          throw new Error(`Unexpected worker response: ${data.type}`);
        }
        return { geometry: data.geometry, volume: data.volumeInfo };
      },
    );
  }

  public async generateCustom(
    params: CustomLayoutParams,
  ): Promise<{ geometry: Geom3; volume: number }> {
    return this.request(
      (requestId) => ({ type: "GENERATE_CUSTOM", requestId, params }),
      (data) => {
        if (data.type !== "GENERATION_SUCCESS") {
          throw new Error(`Unexpected worker response: ${data.type}`);
        }
        return { geometry: data.geometry, volume: data.volumeInfo };
      },
    );
  }

  public async generateBaseConverter(
    params: BaseConverterParams,
  ): Promise<{ geometry: Geom3; volume: number }> {
    return this.request(
      (requestId) => ({
        type: "GENERATE_BASE_CONVERTER",
        requestId,
        params,
      }),
      (data) => {
        if (data.type !== "GENERATION_SUCCESS") {
          throw new Error(`Unexpected worker response: ${data.type}`);
        }
        return { geometry: data.geometry, volume: data.volumeInfo };
      },
    );
  }

  public async generateStepped(
    params: SteppedLayoutParams,
  ): Promise<{ geometry: Geom3; volume: number }> {
    return this.request(
      (requestId) => ({ type: "GENERATE_STEPPED", requestId, params }),
      (data) => {
        if (data.type !== "GENERATION_SUCCESS") {
          throw new Error(`Unexpected worker response: ${data.type}`);
        }
        return { geometry: data.geometry, volume: data.volumeInfo };
      },
    );
  }

  public async generateSteppedSplitParts(
    params: SteppedLayoutParams,
  ): Promise<{ parts: {
    index: number;
    filenameLabel: string;
    label: string;
    fromHeight: number;
    toHeight: number;
    geometry: Geom3;
  }[] }> {
    return this.request(
      (requestId) => ({
        type: "GENERATE_STEPPED_SPLIT_PARTS",
        requestId,
        params,
      }),
      (data) => {
        if (data.type !== "STEPPED_SPLIT_PARTS_SUCCESS") {
          throw new Error(`Unexpected worker response: ${data.type}`);
        }
        return { parts: data.parts };
      },
    );
  }

  public async generateSteppedOutlinePreview(
    params: SteppedLayoutParams,
  ): Promise<{ outlinePreview: GroupOutlinePreview[] | null; durationMs: number }> {
    return this.request(
      (requestId) => ({
        type: "GENERATE_STEPPED_OUTLINE_PREVIEW",
        requestId,
        params,
      }),
      (data) => {
        if (data.type !== "STEPPED_OUTLINE_PREVIEW_SUCCESS") {
          throw new Error(`Unexpected worker response: ${data.type}`);
        }
        return {
          outlinePreview: data.outlinePreview,
          durationMs: data.durationMs,
        };
      },
    );
  }

  public async exportSTL(
    geometry: Geom3,
    filename: string,
  ): Promise<{ blob: Blob; filename: string }> {
    return this.request(
      (requestId) => ({
        type: "EXPORT_STL",
        requestId,
        geometry,
        filename,
      }),
      (data) => {
        if (data.type !== "EXPORT_SUCCESS") {
          throw new Error(`Unexpected worker response: ${data.type}`);
        }
        return { blob: data.blob, filename: data.filename };
      },
    );
  }

  public terminate() {
    const worker = this.worker;
    this.worker = null;
    worker?.terminate();
    const error = new Error("后台建模 Worker 已终止");
    this.workerUnavailableReason = error;
    this.rejectAllPending(error);
  }
}

// 单例模式，整个应用复用一个 Worker 以防内存泄漏
export const trayWorkerService =
  typeof window !== "undefined" ? new TrayWorkerService() : null;
