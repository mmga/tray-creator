import type { FlatTraySnapshot } from "@/lib/manual-split-plan";
import type { StepScope } from "./step-capability";

export type StepRequest = {
  requestId: number;
  snapshot: FlatTraySnapshot;
  scope: StepScope;
};

export type StepPhase = "加载导出组件" | "构建实体" | "校验模型" | "准备文件";

export type StepFile = { id?: string; bytes: ArrayBuffer };

export type StepResponse =
  | { requestId: number; type: "phase"; phase: StepPhase }
  | { requestId: number; type: "done"; files: StepFile[] }
  | { requestId: number; type: "error"; message: string };
