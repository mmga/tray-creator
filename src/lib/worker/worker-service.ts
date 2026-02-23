import type { Geom3 } from "@jscad/modeling/src/geometries/types";
import type { TrayParams } from "@/types/tray";
import type { CustomLayoutParams } from "@/types/custom-tray";
import type { WorkerRequest, WorkerResponse } from "./tray.worker";

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
        this.worker = new Worker(new URL('./tray.worker.ts', import.meta.url), {
            type: 'module'
        });
        this.worker.onmessage = this.handleMessage.bind(this);
        this.worker.onerror = (err) => console.error("Worker error:", err);
    }

    private handleMessage(event: MessageEvent<WorkerResponse>) {
        const data = event.data;

        // We cheat a bit by just grabbing the single latest promise
        // In a more robust system we'd pass IDs back and forth
        const resolve = Array.from(this.pendingResolves.values()).pop();
        const reject = Array.from(this.pendingRejects.values()).pop();
        this.pendingResolves.clear();
        this.pendingRejects.clear();

        if (data.type === "ERROR") {
            if (reject) reject(new Error(data.message));
        } else {
            if (resolve) resolve(data);
        }
    }

    public async generateGrid(params: TrayParams): Promise<{ geometry: Geom3, volume: number }> {
        return new Promise((resolve, reject) => {
            this.pendingResolves.set("grid", (data: any) => resolve({ geometry: data.geometry, volume: data.volumeInfo }));
            this.pendingRejects.set("grid", reject);
            this.worker?.postMessage({ type: "GENERATE_GRID", params });
        });
    }

    public async generateCustom(params: CustomLayoutParams): Promise<{ geometry: Geom3, volume: number }> {
        return new Promise((resolve, reject) => {
            this.pendingResolves.set("custom", (data: any) => resolve({ geometry: data.geometry, volume: data.volumeInfo }));
            this.pendingRejects.set("custom", reject);
            this.worker?.postMessage({ type: "GENERATE_CUSTOM", params });
        });
    }

    public async exportSTL(geometry: Geom3, filename: string): Promise<{ blob: Blob, filename: string }> {
        return new Promise((resolve, reject) => {
            this.pendingResolves.set("export", resolve);
            this.pendingRejects.set("export", reject);
            this.worker?.postMessage({ type: "EXPORT_STL", geometry, filename });
        });
    }

    public terminate() {
        this.worker?.terminate();
        this.worker = null;
    }
}

// 单例模式，整个应用复用一个 Worker 以防内存泄漏
export const trayWorkerService = typeof window !== "undefined" ? new TrayWorkerService() : null;
