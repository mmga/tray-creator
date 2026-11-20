import type { StepFile, StepPhase, StepRequest, StepResponse } from "../step/step-protocol";

let nextRequestId = 0;
let busy = false;
const STEP_TIMEOUT_MS = 90_000;

export async function requestStepExport(
  request: Omit<StepRequest, "requestId">,
  signal: AbortSignal,
  onPhase: (phase: StepPhase) => void,
): Promise<StepFile[]> {
  signal.throwIfAborted();
  if (busy) throw new Error("另一个 STEP 文件正在准备，请稍后重试");
  const worker = new Worker(new URL("./step.worker.ts", import.meta.url), { type: "module" });
  busy = true;
  const requestId = ++nextRequestId;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let abort: (() => void) | undefined;
  try {
    return await new Promise<StepFile[]>((resolve, reject) => {
      abort = () => reject(signal.reason);
      signal.addEventListener("abort", abort, { once: true });
      timeout = setTimeout(() => reject(new Error("STEP 导出超时，请缩小布局后重试")), STEP_TIMEOUT_MS);
      worker.onmessage = ({ data }: MessageEvent<StepResponse>) => {
        if (data.requestId !== requestId) return;
        if (data.type === "phase") onPhase(data.phase);
        else if (data.type === "done") resolve(data.files);
        else reject(new Error(data.message));
      };
      worker.onerror = () => reject(new Error("STEP 导出组件运行失败，请重试"));
      worker.onmessageerror = () => reject(new Error("无法读取 STEP 导出结果，请重试"));
      worker.postMessage({ ...request, requestId } satisfies StepRequest);
    });
  } finally {
    if (abort) signal.removeEventListener("abort", abort);
    clearTimeout(timeout);
    // 同步内核不能响应取消消息，结束 Worker 同时释放整个 WASM 实例。
    worker.terminate();
    busy = false;
  }
}
