import type { Geom3 } from "@jscad/modeling/src/geometries/types";
import type { TrayParams } from "@/types/tray";
import type { CustomLayoutParams } from "@/types/custom-tray";
import type { WorkerRequest, WorkerResponse } from "./tray.worker";

let _nextId = 0;
function generateRequestId(): string {
  return `req_${++_nextId}_${Date.now()}`;
}

class TrayWorkerService {
  private worker: Worker | null = null;
  private pendingResolves: Map<string, (result: any) => void> = new Map();
  private pendingRejects: Map<string, (reason: any) => void> = new Map();

  constructor() {
    if (typeof window !== "undefined") {
      this.initWorker();
    }
  }

  private initWorker() {
    this.worker = new Worker(new URL("./tray.worker.ts", import.meta.url), {
      type: "module",
    });
    this.worker.onmessage = this.handleMessage.bind(this);
    this.worker.onerror = (err) => console.error("Worker error:", err);
  }

  private handleMessage(event: MessageEvent<WorkerResponse>) {
    const data = event.data;
    const { requestId } = data;

    const resolve = this.pendingResolves.get(requestId);
    const reject = this.pendingRejects.get(requestId);
    this.pendingResolves.delete(requestId);
    this.pendingRejects.delete(requestId);

    if (data.type === "ERROR") {
      if (reject) reject(new Error(data.message));
    } else {
      if (resolve) resolve(data);
    }
  }

  public async generateGrid(
    params: TrayParams,
  ): Promise<{ geometry: Geom3; volume: number }> {
    const requestId = generateRequestId();
    return new Promise((resolve, reject) => {
      this.pendingResolves.set(requestId, (data: any) =>
        resolve({ geometry: data.geometry, volume: data.volumeInfo }),
      );
      this.pendingRejects.set(requestId, reject);
      this.worker?.postMessage({ type: "GENERATE_GRID", requestId, params });
    });
  }

  public async generateCustom(
    params: CustomLayoutParams,
  ): Promise<{ geometry: Geom3; volume: number }> {
    const requestId = generateRequestId();
    return new Promise((resolve, reject) => {
      this.pendingResolves.set(requestId, (data: any) =>
        resolve({ geometry: data.geometry, volume: data.volumeInfo }),
      );
      this.pendingRejects.set(requestId, reject);
      this.worker?.postMessage({ type: "GENERATE_CUSTOM", requestId, params });
    });
  }

  public async exportSTL(
    geometry: Geom3,
    filename: string,
  ): Promise<{ blob: Blob; filename: string }> {
    const requestId = generateRequestId();
    return new Promise((resolve, reject) => {
      this.pendingResolves.set(requestId, resolve);
      this.pendingRejects.set(requestId, reject);
      this.worker?.postMessage({
        type: "EXPORT_STL",
        requestId,
        geometry,
        filename,
      });
    });
  }

  public terminate() {
    this.worker?.terminate();
    this.worker = null;
  }
}

// 单例模式，整个应用复用一个 Worker 以防内存泄漏
export const trayWorkerService =
  typeof window !== "undefined" ? new TrayWorkerService() : null;
