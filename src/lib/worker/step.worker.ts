import { exportSTEP, type Shape3D } from "replicad";
import { getStepCapability } from "../step/step-capability";
import { loadStepKernel } from "../step/step-kernel";
import { prepareStepConstruction, realizeStepLid, realizeStepTray, validateStepSolid } from "../step/step-realization";
import type { StepFile, StepPhase, StepRequest, StepResponse } from "../step/step-protocol";

function serializeStep(shape: Shape3D, count: number, name: string) {
  const solids = count > 1 ? shape.solids : [];
  try {
    const ordered = solids.map((solid) => ({ solid, min: validateStepSolid(solid, "独立托盘").bounds[0] }))
      .sort((a, b) => a.min[0] - b.min[0] || a.min[1] - b.min[1] || a.min[2] - b.min[2]);
    return exportSTEP(ordered.length ? ordered.map(({ solid }, i) => ({ shape: solid, name: `${name}_${i + 1}` }))
      : [{ shape, name }], { unit: "MM", modelUnit: "MM" });
  } finally { solids.forEach((solid) => solid.delete()); }
}

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
    const shapes = [{ shape: realizeStepTray(plan), id: plan.box.enabled ? "body" : undefined }];
    try {
      if (plan.box.enabled) shapes.push({ shape: realizeStepLid(plan), id: "lid" });
      phase("校验模型");
      const validated = shapes.map(({ shape, id }) => ({ shape, id, count: validateStepSolid(shape, id === "lid" ? "盖子" : "托盘").solidCount }));
      phase("准备文件");
      const files: StepFile[] = [];
      for (const { shape, id, count } of validated) {
        const bytes = await serializeStep(shape, count, id ?? `tray_${snapshot.mode}`).arrayBuffer();
        if (bytes.byteLength === 0) throw new Error("STEP 导出结果为空");
        files.push({ bytes, id });
      }
      post({ requestId, type: "done", files }, files.map(({ bytes }) => bytes));
    } finally {
      shapes.forEach(({ shape }) => shape.delete());
    }
  } catch (error) {
    post({ requestId, type: "error", message: error instanceof Error ? error.message : "STEP 生成失败" });
  }
};
