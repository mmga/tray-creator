import initOpenCascade from "replicad-opencascadejs";
import { setOC } from "replicad";

let initializing: ReturnType<typeof initOpenCascade> | undefined;

export function loadStepKernel() {
  return initializing ??= initOpenCascade({ print: () => {} }).then((kernel) => {
    setOC(kernel);
    return kernel;
  }).catch((cause: unknown) => {
    initializing = undefined;
    throw new Error("STEP 导出组件加载失败，请重试", { cause });
  });
}
