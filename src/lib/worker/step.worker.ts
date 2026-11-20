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
      const { solidCount } = validateStepSolid(shape, "托盘");
      phase("准备文件");
      const solids = solidCount > 1 ? shape.solids : [];
      let blob: Blob;
      try {
        const ordered = solids.map((solid) => ({ solid, min: validateStepSolid(solid, "独立托盘").bounds[0] }))
          .sort((a, b) => a.min[0] - b.min[0] || a.min[1] - b.min[1] || a.min[2] - b.min[2]);
        blob = exportSTEP(ordered.length ? ordered.map(({ solid }, i) => ({ shape: solid, name: `tray_${i + 1}` }))
          : [{ shape, name: `tray_${snapshot.mode}` }], { unit: "MM", modelUnit: "MM" });
      } finally { solids.forEach((solid) => solid.delete()); }
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
