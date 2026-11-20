import { exportSTEP } from "replicad";
import { getStepCapability } from "../step/step-capability";
import { loadStepKernel } from "../step/step-kernel";
import { prepareStepConstruction, realizeStepTray, validateStepSolid } from "../step/step-realization";
import type { StepPhase, StepRequest, StepResponse } from "../step/step-protocol";

self.onmessage = async ({ data }: MessageEvent<StepRequest>) => {
  const { requestId, snapshot, scope } = data;
  const post = (response: StepResponse, transfer: Transferable[] = []) => self.postMessage(response, { transfer });
  const phase = (value: StepPhase) => post({ requestId, type: "phase", phase: value });
  try {
    const capability = getStepCapability(snapshot, scope);
    if (!capability.available) throw new Error(capability.reason);
    const plan = prepareStepConstruction(snapshot);
    phase("加载导出组件");
    await loadStepKernel();
    phase("构建实体");
    const shape = realizeStepTray(plan);
    try {
      phase("校验模型");
      validateStepSolid(shape, "托盘");
      phase("准备文件");
      const blob = exportSTEP([{ shape, name: `tray_${snapshot.mode}` }], { unit: "MM", modelUnit: "MM" });
      const bytes = await blob.arrayBuffer();
      if (bytes.byteLength === 0) throw new Error("STEP 导出结果为空");
      post({ requestId, type: "done", files: [{ bytes }] }, [bytes]);
    } finally {
      shape.delete();
    }
  } catch (error) {
    post({ requestId, type: "error", message: error instanceof Error ? error.message : "STEP 生成失败" });
  }
};
