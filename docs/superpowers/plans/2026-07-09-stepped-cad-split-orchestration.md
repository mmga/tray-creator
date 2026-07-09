# Stepped CAD Split Orchestration 实施计划

> **面向自动化执行者：** 必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans`，逐项执行本计划。所有步骤使用 checkbox（`- [ ]`）跟踪。

**目标：** 把 CAD-only 的 split preview 与 split-part export lifecycle 从 Stepped Layout Core 移入 `stepped-cad` Adapter，同时保持用户可见行为、参数格式和 CAD 几何不变。

**架构：** 新增 `useSteppedCadSplitOrchestration` 作为 CAD-only Deep Module，拥有 split preview 状态、资源释放、生成与导出命令。`useSteppedCadLayout` 组合共享 controller 与该 Module；共享 Workspace/Viewport 通过显式可选 Interface 接收 CAD Adapter wiring，不再依赖 union、feature flag 或运行时字段探测。

**技术栈：** TypeScript、React hooks、Next.js、Vitest、Testing Library、Three.js、ESLint。

---

## 文件结构

- 新建 `src/hooks/useSteppedCadSplitOrchestration.ts`
  - 拥有 CAD split preview lifecycle、校验、toast、Three.js resource disposal 与 split-part export orchestration。
- 新建 `src/hooks/useSteppedCadSplitOrchestration.test.ts`
  - 聚焦测试生成、失效、清理、卸载、校验、失败与导出行为。
- 新建 `src/hooks/useSteppedCadLayout.test.ts`
  - 验证 CAD Adapter 明确组合 shared controller 与 CAD split Module。
- 修改 `src/hooks/useSteppedLayoutController.ts`
  - 删除 CAD-only options、state、commands 和 cleanup，只保留共享 stepped Interface 与 `updateGroupSplitPartTarget`。
- 修改 `src/hooks/useSteppedLayout.ts`
  - 删除六个 CAD lifecycle 字段的运行时解构，仅通过窄类型隐藏 shared group split target action。
- 修改 `src/hooks/useSteppedCadLayout.ts`
  - 组合 shared controller 与新 CAD-only Module。
- 修改 `src/hooks/useSteppedLayout.integration.test.ts`
  - 锁定普通 stepped runtime 不包含 CAD split lifecycle。
- 修改 `src/workspaces/stepped/useSteppedWorkspace.tsx`
  - 用显式 `splitActions` Interface 代替 model union、`enableSplitExport` 和字段探测。
- 修改 `src/workspaces/stepped-cad/useSteppedCadWorkspace.tsx`
  - 显式把 CAD split export 与 group split target action 接到 shared Workspace。
- 修改 `src/viewports/stepped/useSteppedViewportWorkspace.tsx`
  - 用显式 `splitPreview` Interface 代替 model union、`supportsSplitPreview` 和字段探测。
- 修改 `src/viewports/stepped-cad/useSteppedCadViewportWorkspace.tsx`
  - 显式把 CAD split preview state 与 command 接到 shared Viewport。
- 新建 `src/hooks/steppedCadAdapters.test.tsx`
  - 验证 CAD Workspace/Viewport Adapter 传递明确的 CAD-only Interface。

### 任务 1：用测试锁定 CAD Split Orchestration lifecycle

**文件：**
- 新建：`src/hooks/useSteppedCadSplitOrchestration.test.ts`
- 新建：`src/hooks/useSteppedCadSplitOrchestration.ts`

- [ ] **步骤 1：编写 CAD split hook 的失败测试**

创建 `src/hooks/useSteppedCadSplitOrchestration.test.ts`：

```ts
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as THREE from "three";
import { STEPPED_LAYOUT_DEFAULTS } from "@/lib/stepped-config";
import type { SteppedLayoutParams } from "@/types/custom-tray";

const {
  toastMock,
  generateSplitPreviewMock,
  exportSplitPartsMock,
  trayWorkerServiceMock,
  browserDownloadPortMock,
} = vi.hoisted(() => ({
  toastMock: vi.fn(),
  generateSplitPreviewMock: vi.fn(),
  exportSplitPartsMock: vi.fn(),
  trayWorkerServiceMock: {
    generateSteppedCadSplitParts: vi.fn(),
    generateSteppedOutlinePreview: vi.fn(),
    exportSTL: vi.fn(),
  },
  browserDownloadPortMock: {
    downloadBlob: vi.fn(),
  },
}));

vi.mock("@/hooks/useToast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/lib/worker/worker-service", () => ({
  trayWorkerService: trayWorkerServiceMock,
}));

vi.mock("@/lib/download-port", () => ({
  browserDownloadPort: browserDownloadPortMock,
}));

import { useSteppedCadSplitOrchestration } from "@/hooks/useSteppedCadSplitOrchestration";

function createParams(): SteppedLayoutParams {
  return {
    ...STEPPED_LAYOUT_DEFAULTS,
    groups: [
      { ...STEPPED_LAYOUT_DEFAULTS.groups[0], id: "group-1" },
      {
        ...STEPPED_LAYOUT_DEFAULTS.groups[0],
        id: "group-2",
        name: "组 2",
        bottomHeight: 10,
      },
    ],
    activeGroupId: "group-1",
  };
}

function createPart(dispose: ReturnType<typeof vi.fn>) {
  return {
    index: 0,
    filenameLabel: "part-1",
    label: "分件 1",
    fromHeight: 0,
    toHeight: 10,
    threeGeometry: { dispose } as unknown as THREE.BufferGeometry,
  };
}

describe("useSteppedCadSplitOrchestration", () => {
  beforeEach(() => {
    toastMock.mockReset();
    generateSplitPreviewMock.mockReset();
    exportSplitPartsMock.mockReset();
  });

  it("生成拆件预览并在 params 失效时释放旧资源", async () => {
    const dispose = vi.fn();
    const params = createParams();
    generateSplitPreviewMock.mockResolvedValue([createPart(dispose)]);

    const { result, rerender } = renderHook(
      ({ currentParams }) =>
        useSteppedCadSplitOrchestration({
          params: currentParams,
          generateSplitPreview: generateSplitPreviewMock,
          exportSplitParts: exportSplitPartsMock,
        }),
      { initialProps: { currentParams: params } },
    );

    await act(async () => {
      await result.current.handleGenerateSplitPreview();
    });

    expect(generateSplitPreviewMock).toHaveBeenCalledWith(
      params,
      trayWorkerServiceMock,
    );
    expect(result.current.splitPreviewParts).toHaveLength(1);
    expect(result.current.isGeneratingSplitPreview).toBe(false);

    rerender({ currentParams: { ...params, trayWidth: params.trayWidth + 1 } });

    await waitFor(() => {
      expect(result.current.splitPreviewParts).toBeNull();
    });
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it("替换、clear 和 unmount 时各自释放当前 preview parts", async () => {
    const firstDispose = vi.fn();
    const secondDispose = vi.fn();
    generateSplitPreviewMock
      .mockResolvedValueOnce([createPart(firstDispose)])
      .mockResolvedValueOnce([createPart(secondDispose)]);

    const { result, unmount } = renderHook(() =>
      useSteppedCadSplitOrchestration({
        params: createParams(),
        generateSplitPreview: generateSplitPreviewMock,
        exportSplitParts: exportSplitPartsMock,
      }),
    );

    await act(async () => {
      await result.current.handleGenerateSplitPreview();
      await result.current.handleGenerateSplitPreview();
    });
    expect(firstDispose).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.clearSplitPreview();
    });
    expect(secondDispose).toHaveBeenCalledTimes(1);

    generateSplitPreviewMock.mockResolvedValueOnce([createPart(secondDispose)]);
    await act(async () => {
      await result.current.handleGenerateSplitPreview();
    });
    unmount();
    expect(secondDispose).toHaveBeenCalledTimes(2);
  });

  it("拒绝少于两个分组，并报告生成失败", async () => {
    const oneGroupParams = {
      ...createParams(),
      groups: [createParams().groups[0]],
    };
    const { result, rerender } = renderHook(
      ({ params }) =>
        useSteppedCadSplitOrchestration({
          params,
          generateSplitPreview: generateSplitPreviewMock,
          exportSplitParts: exportSplitPartsMock,
        }),
      { initialProps: { params: oneGroupParams } },
    );

    await act(async () => {
      await result.current.handleGenerateSplitPreview();
    });
    expect(generateSplitPreviewMock).not.toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith(
      "error",
      "至少需要两个分组才能预览拆件",
    );

    generateSplitPreviewMock.mockRejectedValue(new Error("worker failed"));
    rerender({ params: createParams() });
    await act(async () => {
      await result.current.handleGenerateSplitPreview();
    });
    expect(toastMock).toHaveBeenLastCalledWith(
      "error",
      "拆件预览失败：worker failed",
    );
    expect(result.current.isGeneratingSplitPreview).toBe(false);
  });

  it("使用有效尺寸导出分件并保留成功提示", async () => {
    const params = createParams();
    exportSplitPartsMock.mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useSteppedCadSplitOrchestration({
        params,
        generateSplitPreview: generateSplitPreviewMock,
        exportSplitParts: exportSplitPartsMock,
      }),
    );

    await act(async () => {
      await result.current.handleExportSplitParts();
    });

    expect(exportSplitPartsMock).toHaveBeenCalledWith(
      params,
      expect.objectContaining({
        width: expect.any(Number),
        depth: expect.any(Number),
      }),
      trayWorkerServiceMock,
      browserDownloadPortMock,
    );
    expect(toastMock).toHaveBeenCalledWith(
      "success",
      "分件 STL、定位孔清单和参数文件已导出",
    );
  });
});
```

- [ ] **步骤 2：运行测试并确认因 Module 尚不存在而失败**

运行：

```bash
./node_modules/.bin/vitest run src/hooks/useSteppedCadSplitOrchestration.test.ts
```

预期：FAIL，错误包含 `Failed to resolve import "@/hooks/useSteppedCadSplitOrchestration"`。

- [ ] **步骤 3：实现 CAD-only Deep Module**

创建 `src/hooks/useSteppedCadSplitOrchestration.ts`：

```ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { browserDownloadPort } from "@/lib/download-port";
import { useToast } from "@/hooks/useToast";
import {
  calculateSteppedEffectiveDimensions,
  type SteppedLayoutExtents,
} from "@/lib/stepped-layout-math";
import type {
  DownloadPort,
  SteppedCadWorkerPort,
} from "@/lib/model-ports";
import type { SteppedCadSplitPreviewPart } from "@/lib/stepped-cad-model-service";
import { trayWorkerService } from "@/lib/worker/worker-service";
import type { SteppedLayoutParams } from "@/types/custom-tray";

interface UseSteppedCadSplitOrchestrationOptions {
  params: SteppedLayoutParams;
  generateSplitPreview: (
    params: SteppedLayoutParams,
    workerPort: SteppedCadWorkerPort,
  ) => Promise<SteppedCadSplitPreviewPart[]>;
  exportSplitParts: (
    params: SteppedLayoutParams,
    effectiveDimensions: SteppedLayoutExtents,
    workerPort: SteppedCadWorkerPort,
    downloadPort: DownloadPort,
  ) => Promise<void>;
}

export interface UseSteppedCadSplitOrchestrationReturn {
  splitPreviewParts: SteppedCadSplitPreviewPart[] | null;
  isGeneratingSplitPreview: boolean;
  handleGenerateSplitPreview: () => Promise<void>;
  clearSplitPreview: () => void;
  handleExportSplitParts: () => Promise<void>;
}

function disposeSplitPreviewParts(
  parts: SteppedCadSplitPreviewPart[] | null,
): void {
  parts?.forEach((part) => part.threeGeometry.dispose());
}

export function useSteppedCadSplitOrchestration({
  params,
  generateSplitPreview,
  exportSplitParts,
}: UseSteppedCadSplitOrchestrationOptions): UseSteppedCadSplitOrchestrationReturn {
  const { toast } = useToast();
  const paramsRef = useRef(params);
  const previousParamsRef = useRef(params);
  const splitPreviewPartsRef =
    useRef<SteppedCadSplitPreviewPart[] | null>(null);
  const [splitPreviewParts, setSplitPreviewParts] = useState<
    SteppedCadSplitPreviewPart[] | null
  >(null);
  const [isGeneratingSplitPreview, setIsGeneratingSplitPreview] =
    useState(false);
  paramsRef.current = params;

  const replaceSplitPreviewParts = useCallback(
    (next: SteppedCadSplitPreviewPart[] | null) => {
      disposeSplitPreviewParts(splitPreviewPartsRef.current);
      splitPreviewPartsRef.current = next;
      setSplitPreviewParts(next);
    },
    [],
  );

  const clearSplitPreview = useCallback(() => {
    replaceSplitPreviewParts(null);
  }, [replaceSplitPreviewParts]);

  useEffect(() => {
    if (previousParamsRef.current !== params) {
      previousParamsRef.current = params;
      clearSplitPreview();
    }
  }, [clearSplitPreview, params]);

  useEffect(
    () => () => {
      disposeSplitPreviewParts(splitPreviewPartsRef.current);
      splitPreviewPartsRef.current = null;
    },
    [],
  );

  const handleGenerateSplitPreview = useCallback(async () => {
    const workerPort = trayWorkerService as SteppedCadWorkerPort | null;
    if (!workerPort) {
      toast("error", "当前环境无法使用后台建模服务");
      return;
    }

    const currentParams = paramsRef.current;
    if (currentParams.groups.length < 2) {
      toast("error", "至少需要两个分组才能预览拆件");
      return;
    }

    setIsGeneratingSplitPreview(true);
    try {
      replaceSplitPreviewParts(
        await generateSplitPreview(currentParams, workerPort),
      );
    } catch (err) {
      console.error("拆件预览生成失败:", err);
      toast(
        "error",
        `拆件预览失败：${err instanceof Error ? err.message : "未知错误"}`,
      );
    } finally {
      setIsGeneratingSplitPreview(false);
    }
  }, [generateSplitPreview, replaceSplitPreviewParts, toast]);

  const handleExportSplitParts = useCallback(async () => {
    const workerPort = trayWorkerService as SteppedCadWorkerPort | null;
    if (!workerPort) {
      toast("error", "当前环境无法使用后台建模服务");
      return;
    }

    const currentParams = paramsRef.current;
    if (currentParams.groups.length < 2) {
      toast("error", "至少需要两个分组才能导出分件");
      return;
    }

    try {
      await exportSplitParts(
        currentParams,
        calculateSteppedEffectiveDimensions(currentParams),
        workerPort,
        browserDownloadPort,
      );
      toast("success", "分件 STL、定位孔清单和参数文件已导出");
    } catch (err) {
      console.error("分件导出失败:", err);
      toast(
        "error",
        `分件导出失败：${err instanceof Error ? err.message : "未知错误"}`,
      );
    }
  }, [exportSplitParts, toast]);

  return {
    splitPreviewParts,
    isGeneratingSplitPreview,
    handleGenerateSplitPreview,
    clearSplitPreview,
    handleExportSplitParts,
  };
}
```

- [ ] **步骤 4：运行聚焦测试并确认通过**

运行：

```bash
./node_modules/.bin/vitest run src/hooks/useSteppedCadSplitOrchestration.test.ts
```

预期：PASS，4 tests passed。

- [ ] **步骤 5：提交 CAD split Module**

```bash
git add src/hooks/useSteppedCadSplitOrchestration.ts src/hooks/useSteppedCadSplitOrchestration.test.ts
git commit -m "refactor: 提取 stepped cad split orchestration"
```

### 任务 2：从 Stepped Layout Core 删除 CAD lifecycle

**文件：**
- 修改：`src/hooks/useSteppedLayoutController.ts`
- 修改：`src/hooks/useSteppedLayout.ts`
- 修改：`src/hooks/useSteppedLayout.integration.test.ts`

- [ ] **步骤 1：给普通 stepped runtime 增加回归断言**

在 `src/hooks/useSteppedLayout.integration.test.ts` 的 `describe("useSteppedLayout")` 中新增：

```ts
it("不暴露 CAD-only split lifecycle", () => {
  const { result } = renderHook(() => useSteppedLayout());

  expect(result.current).not.toHaveProperty("splitPreviewParts");
  expect(result.current).not.toHaveProperty("isGeneratingSplitPreview");
  expect(result.current).not.toHaveProperty("handleGenerateSplitPreview");
  expect(result.current).not.toHaveProperty("clearSplitPreview");
  expect(result.current).not.toHaveProperty("handleExportSplitParts");
});
```

- [ ] **步骤 2：运行回归测试并确认当前行为仍通过**

运行：

```bash
./node_modules/.bin/vitest run src/hooks/useSteppedLayout.integration.test.ts
```

预期：PASS。该 characterization test 锁定现有 wrapper 行为，后续删除运行时解构时必须继续通过。

- [ ] **步骤 3：收窄 shared controller Interface 与 Implementation**

在 `src/hooks/useSteppedLayoutController.ts`：

1. 从 `@/lib/stepped-model-service` import 中删除 `SteppedSplitPreviewPart`，只保留：

```ts
import type { SteppedPreviewResult } from "@/lib/stepped-model-service";
```

2. 从 `UseSteppedLayoutControllerReturn` 删除：

```ts
splitPreviewParts: SteppedSplitPreviewPart[] | null;
isGeneratingSplitPreview: boolean;
handleGenerateSplitPreview: () => void;
clearSplitPreview: () => void;
handleExportSplitParts: () => void;
```

3. 从 `UseSteppedLayoutControllerOptions` 删除 `generateSplitPreview` 与 `exportSplitParts`，函数参数改为：

```ts
export function useSteppedLayoutController<
  TWorkerPort extends STLExportWorkerPort & SteppedOutlinePreviewPort,
>({
  generatePreview,
  exportModel,
}: UseSteppedLayoutControllerOptions<TWorkerPort>): UseSteppedLayoutControllerReturn {
```

4. 删除 `splitPreviewParts`、`isGeneratingSplitPreview` state，删除 `clearSplitPreview`、`handleGenerateSplitPreview`、`handleExportSplitParts`。

5. 将 cleanup effect 改为只清理 optimization：

```ts
useEffect(
  () => () => {
    cancelPendingOptimization();
  },
  [cancelPendingOptimization],
);
```

6. 将 `usePreviewLifecycle` 的 `onInvalidate` 改为：

```ts
onInvalidate: () => {
  optimizationVariantRef.current = 0;
  clearOptimizationProposals();
},
```

7. 从 return object 删除五个 CAD lifecycle 字段，保留 `updateGroupSplitPartTarget`。

- [ ] **步骤 4：简化普通 stepped wrapper**

用以下内容替换 `src/hooks/useSteppedLayout.ts`：

```ts
"use client";

import { useSteppedLayoutController } from "@/hooks/useSteppedLayoutController";
import type { UseSteppedLayoutControllerReturn } from "@/hooks/useSteppedLayoutController";
import {
  exportSteppedModelFiles,
  generateSteppedPreview,
} from "@/lib/stepped-model-service";

export type UseSteppedLayoutReturn = Omit<
  UseSteppedLayoutControllerReturn,
  "updateGroupSplitPartTarget"
>;

export function useSteppedLayout(): UseSteppedLayoutReturn {
  const {
    updateGroupSplitPartTarget: _updateGroupSplitPartTarget,
    ...steppedModel
  } = useSteppedLayoutController({
    generatePreview: generateSteppedPreview,
    exportModel: exportSteppedModelFiles,
  });

  return steppedModel;
}
```

这里仍运行时移除唯一的 CAD UI action，确保上一步 characterization test 继续通过；原有五个 CAD lifecycle unused warning 被消除，`updateGroupSplitPartTarget` 的单个既有 warning 因已确认的窄迁移边界暂时保留。

- [ ] **步骤 5：运行普通 stepped 测试与 TypeScript**

运行：

```bash
./node_modules/.bin/vitest run src/hooks/useSteppedLayout.integration.test.ts
./node_modules/.bin/tsc --noEmit
```

预期：Vitest PASS；TypeScript 暂时可能因 `useSteppedCadLayout.ts` 仍传旧 options 而 FAIL，错误仅应指向 `generateSplitPreview`/CAD return type，下一任务闭环。

- [ ] **步骤 6：确认失败范围后保持未提交**

若 TypeScript 仅剩下一任务预期的 CAD composition 错误，则不要创建失败状态的提交；直接继续任务 3。任务 3 完成 composition 并恢复 TypeScript 通过后，一并提交 shared controller 收窄与 CAD Adapter composition。

### 任务 3：让 CAD Adapter 组合两个 Module

**文件：**
- 新建：`src/hooks/useSteppedCadLayout.test.ts`
- 修改：`src/hooks/useSteppedCadLayout.ts`

- [ ] **步骤 1：编写组合行为的失败测试**

创建 `src/hooks/useSteppedCadLayout.test.ts`：

```ts
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const {
  coreModel,
  splitModel,
  useSteppedLayoutControllerMock,
  useSteppedCadSplitOrchestrationMock,
} = vi.hoisted(() => {
  const coreModel = {
    params: { kind: "stepped-cad-params" },
    updateGroupSplitPartTarget: vi.fn(),
    handleGenerate: vi.fn(),
  };
  const splitModel = {
    splitPreviewParts: null,
    isGeneratingSplitPreview: false,
    handleGenerateSplitPreview: vi.fn(),
    clearSplitPreview: vi.fn(),
    handleExportSplitParts: vi.fn(),
  };
  return {
    coreModel,
    splitModel,
    useSteppedLayoutControllerMock: vi.fn(() => coreModel),
    useSteppedCadSplitOrchestrationMock: vi.fn(() => splitModel),
  };
});

vi.mock("@/hooks/useSteppedLayoutController", () => ({
  useSteppedLayoutController: useSteppedLayoutControllerMock,
}));

vi.mock("@/hooks/useSteppedCadSplitOrchestration", () => ({
  useSteppedCadSplitOrchestration: useSteppedCadSplitOrchestrationMock,
}));

import {
  exportSteppedCadModelFiles,
  exportSteppedCadSplitPartFiles,
  generateSteppedCadPreview,
  generateSteppedCadSplitPreview,
} from "@/lib/stepped-cad-model-service";
import { useSteppedCadLayout } from "@/hooks/useSteppedCadLayout";

describe("useSteppedCadLayout", () => {
  it("组合 Stepped Layout Core 与 CAD split orchestration", () => {
    const { result } = renderHook(() => useSteppedCadLayout());

    expect(useSteppedLayoutControllerMock).toHaveBeenCalledWith({
      generatePreview: generateSteppedCadPreview,
      exportModel: exportSteppedCadModelFiles,
    });
    expect(useSteppedCadSplitOrchestrationMock).toHaveBeenCalledWith({
      params: coreModel.params,
      generateSplitPreview: generateSteppedCadSplitPreview,
      exportSplitParts: exportSteppedCadSplitPartFiles,
    });
    expect(result.current).toMatchObject({
      ...coreModel,
      ...splitModel,
    });
  });
});
```

- [ ] **步骤 2：运行测试并确认旧 CAD wrapper 失败**

运行：

```bash
./node_modules/.bin/vitest run src/hooks/useSteppedCadLayout.test.ts
```

预期：FAIL，`useSteppedCadSplitOrchestrationMock` 未被调用。

- [ ] **步骤 3：实现 CAD Adapter composition**

用以下内容替换 `src/hooks/useSteppedCadLayout.ts`：

```ts
"use client";

import { useSteppedCadSplitOrchestration } from "@/hooks/useSteppedCadSplitOrchestration";
import type { UseSteppedCadSplitOrchestrationReturn } from "@/hooks/useSteppedCadSplitOrchestration";
import { useSteppedLayoutController } from "@/hooks/useSteppedLayoutController";
import type { UseSteppedLayoutControllerReturn } from "@/hooks/useSteppedLayoutController";
import {
  exportSteppedCadModelFiles,
  exportSteppedCadSplitPartFiles,
  generateSteppedCadPreview,
  generateSteppedCadSplitPreview,
} from "@/lib/stepped-cad-model-service";

export type UseSteppedCadLayoutReturn = UseSteppedLayoutControllerReturn &
  UseSteppedCadSplitOrchestrationReturn;

export function useSteppedCadLayout(): UseSteppedCadLayoutReturn {
  const coreModel = useSteppedLayoutController({
    generatePreview: generateSteppedCadPreview,
    exportModel: exportSteppedCadModelFiles,
  });
  const splitModel = useSteppedCadSplitOrchestration({
    params: coreModel.params,
    generateSplitPreview: generateSteppedCadSplitPreview,
    exportSplitParts: exportSteppedCadSplitPartFiles,
  });

  return {
    ...coreModel,
    ...splitModel,
  };
}
```

- [ ] **步骤 4：运行 CAD hook、普通 stepped 与 TypeScript 验证**

运行：

```bash
./node_modules/.bin/vitest run src/hooks/useSteppedCadLayout.test.ts src/hooks/useSteppedCadSplitOrchestration.test.ts src/hooks/useSteppedLayout.integration.test.ts
./node_modules/.bin/tsc --noEmit
```

预期：所有聚焦测试 PASS；TypeScript PASS。

- [ ] **步骤 5：提交 CAD Adapter composition**

```bash
git add src/hooks/useSteppedCadLayout.ts src/hooks/useSteppedCadLayout.test.ts
git add src/hooks/useSteppedLayoutController.ts src/hooks/useSteppedLayout.ts src/hooks/useSteppedLayout.integration.test.ts
git commit -m "refactor: 组合 stepped cad split adapter"
```

### 任务 4：把 Workspace 与 Viewport 的能力探测改成显式 Seam

**文件：**
- 新建：`src/hooks/steppedCadAdapters.test.tsx`
- 修改：`src/workspaces/stepped/useSteppedWorkspace.tsx`
- 修改：`src/workspaces/stepped-cad/useSteppedCadWorkspace.tsx`
- 修改：`src/viewports/stepped/useSteppedViewportWorkspace.tsx`
- 修改：`src/viewports/stepped-cad/useSteppedCadViewportWorkspace.tsx`

- [ ] **步骤 1：编写 CAD Adapter wiring 的失败测试**

创建 `src/hooks/steppedCadAdapters.test.tsx`：

```tsx
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const {
  workspaceResult,
  viewportResult,
  useSteppedWorkspaceMock,
  useSteppedViewportWorkspaceMock,
} = vi.hoisted(() => ({
  workspaceResult: {
    mode: "stepped-cad",
    panel: null,
    draftDialogProps: {},
    commands: {},
  },
  viewportResult: {
    workspace: {
      mode: "stepped-cad",
      viewport: null,
      resetTransientState: vi.fn(),
    },
  },
  useSteppedWorkspaceMock: vi.fn(),
  useSteppedViewportWorkspaceMock: vi.fn(),
}));

vi.mock("@/workspaces/stepped/useSteppedWorkspace", () => ({
  useSteppedWorkspace: useSteppedWorkspaceMock,
}));

vi.mock("@/viewports/stepped/useSteppedViewportWorkspace", () => ({
  useSteppedViewportWorkspace: useSteppedViewportWorkspaceMock,
}));

import { useSteppedCadWorkspace } from "@/workspaces/stepped-cad/useSteppedCadWorkspace";
import { useSteppedCadViewportWorkspace } from "@/viewports/stepped-cad/useSteppedCadViewportWorkspace";

describe("stepped-cad adapters", () => {
  it("向 shared Workspace 显式传递 split actions", () => {
    useSteppedWorkspaceMock.mockReturnValue(workspaceResult);
    const model = {
      handleExportSplitParts: vi.fn(),
      updateGroupSplitPartTarget: vi.fn(),
    };
    const interactionState = { kind: "interaction" };

    renderHook(() =>
      useSteppedCadWorkspace({
        model: model as never,
        interactionState: interactionState as never,
      }),
    );

    expect(useSteppedWorkspaceMock).toHaveBeenCalledWith({
      model,
      interactionState,
      mode: "stepped-cad",
      splitActions: {
        handleExportSplitParts: model.handleExportSplitParts,
        updateGroupSplitPartTarget: model.updateGroupSplitPartTarget,
      },
    });
  });

  it("向 shared Viewport 显式传递 split preview Interface", () => {
    useSteppedViewportWorkspaceMock.mockReturnValue(viewportResult);
    const model = {
      splitPreviewParts: null,
      isGeneratingSplitPreview: false,
      handleGenerateSplitPreview: vi.fn(),
    };
    const interactionState = { kind: "interaction" };
    const onRightViewChange = vi.fn();

    renderHook(() =>
      useSteppedCadViewportWorkspace({
        model: model as never,
        interactionState: interactionState as never,
        rightView: "3d",
        onRightViewChange,
      }),
    );

    expect(useSteppedViewportWorkspaceMock).toHaveBeenCalledWith({
      model,
      interactionState,
      rightView: "3d",
      onRightViewChange,
      mode: "stepped-cad",
      splitPreview: {
        parts: model.splitPreviewParts,
        isGenerating: model.isGeneratingSplitPreview,
        generate: model.handleGenerateSplitPreview,
      },
    });
  });
});
```

- [ ] **步骤 2：运行 Adapter 测试并确认旧 feature flags 导致失败**

运行：

```bash
./node_modules/.bin/vitest run src/hooks/steppedCadAdapters.test.tsx
```

预期：FAIL；收到的是 `enableSplitExport: true` 与 `supportsSplitPreview: true`，而不是显式 Interface。

- [ ] **步骤 3：收窄 shared Workspace Interface**

在 `src/workspaces/stepped/useSteppedWorkspace.tsx`：

1. 删除 `UseSteppedCadLayoutReturn` import。
2. 新增：

```ts
interface SteppedSplitActions {
  handleExportSplitParts: () => void;
  updateGroupSplitPartTarget: (
    groupId: string,
    targetGroupId: string | null,
  ) => void;
}
```

3. 将 options 改为：

```ts
interface UseSteppedWorkspaceOptions {
  model: UseSteppedLayoutReturn;
  interactionState: ModeInteractionState;
  mode?: Extract<AppMode, "stepped" | "stepped-cad">;
  splitActions?: SteppedSplitActions;
}
```

4. 函数参数改为解构 `splitActions`，删除 `enableSplitExport` 及两个 `"field" in model` block。
5. `SteppedPanel` props 改为：

```tsx
onExportSplitParts={splitActions?.handleExportSplitParts}
onUpdateGroupSplitPartTarget={splitActions?.updateGroupSplitPartTarget}
```

6. dependency array 用以下字段替换旧 handler：

```ts
splitActions?.handleExportSplitParts,
splitActions?.updateGroupSplitPartTarget,
```

- [ ] **步骤 4：让 CAD Workspace Adapter 显式传递 actions**

将 `src/workspaces/stepped-cad/useSteppedCadWorkspace.tsx` 中的调用改为：

```ts
return useSteppedWorkspace({
  ...options,
  mode: "stepped-cad",
  splitActions: {
    handleExportSplitParts: options.model.handleExportSplitParts,
    updateGroupSplitPartTarget: options.model.updateGroupSplitPartTarget,
  },
});
```

- [ ] **步骤 5：收窄 shared Viewport Interface**

在 `src/viewports/stepped/useSteppedViewportWorkspace.tsx`：

1. 保留 `UseSteppedCadLayoutReturn` 的 type-only import，并新增：

```ts
interface SteppedSplitPreview {
  parts: UseSteppedCadLayoutReturn["splitPreviewParts"];
  isGenerating: boolean;
  generate: () => void;
}
```

该 import 只用于精确复用 preview part 类型；不再把 CAD model union 作为参数。

2. 将 options 改为：

```ts
interface UseSteppedViewportWorkspaceOptions {
  model: UseSteppedLayoutReturn;
  interactionState: ModeInteractionState;
  rightView: "2d" | "3d";
  onRightViewChange: (next: "2d" | "3d") => void;
  mode?: Extract<AppMode, "stepped" | "stepped-cad">;
  splitPreview?: SteppedSplitPreview;
}
```

3. 函数参数解构 `splitPreview`，删除 `supportsSplitPreview` 与三个 `"field" in model` block。
4. `ViewportTabs` props 改为：

```tsx
splitParts={splitPreview?.parts}
isGeneratingSplitPreview={splitPreview?.isGenerating}
onGenerateSplitPreview={splitPreview?.generate}
```

5. dependency array 使用：

```ts
splitPreview?.generate,
splitPreview?.isGenerating,
splitPreview?.parts,
```

- [ ] **步骤 6：让 CAD Viewport Adapter 显式传递 preview Interface**

将 `src/viewports/stepped-cad/useSteppedCadViewportWorkspace.tsx` 中的调用改为：

```ts
return useSteppedViewportWorkspace({
  ...options,
  mode: "stepped-cad",
  splitPreview: {
    parts: options.model.splitPreviewParts,
    isGenerating: options.model.isGeneratingSplitPreview,
    generate: options.model.handleGenerateSplitPreview,
  },
});
```

- [ ] **步骤 7：运行 Adapter、page 与 TypeScript 验证**

运行：

```bash
./node_modules/.bin/vitest run src/hooks/steppedCadAdapters.test.tsx src/hooks/useModeEditorWorkspaces.test.tsx src/app/page.test.tsx
./node_modules/.bin/tsc --noEmit
```

预期：所有测试 PASS；TypeScript PASS。

- [ ] **步骤 8：确认旧能力探测已完全删除**

运行：

```bash
rg -n 'enableSplitExport|supportsSplitPreview|\"(handleExportSplitParts|splitPreviewParts|isGeneratingSplitPreview|handleGenerateSplitPreview|updateGroupSplitPartTarget)\" in model' src/workspaces src/viewports
```

预期：无输出。

- [ ] **步骤 9：提交 Adapter Seam**

```bash
git add src/hooks/steppedCadAdapters.test.tsx src/workspaces/stepped/useSteppedWorkspace.tsx src/workspaces/stepped-cad/useSteppedCadWorkspace.tsx src/viewports/stepped/useSteppedViewportWorkspace.tsx src/viewports/stepped-cad/useSteppedCadViewportWorkspace.tsx
git commit -m "refactor: 显式传递 stepped cad split 能力"
```

### 任务 5：完整验证与范围审计

**文件：**
- 检查：本计划涉及的全部文件

- [ ] **步骤 1：运行完整 Vitest**

运行：

```bash
./node_modules/.bin/vitest run
```

预期：全部测试文件与测试用例 PASS。

- [ ] **步骤 2：运行 TypeScript**

运行：

```bash
./node_modules/.bin/tsc --noEmit
```

预期：无输出，退出码 0。

- [ ] **步骤 3：运行 ESLint**

运行：

```bash
./node_modules/.bin/eslint src --max-warnings=0
```

预期：本轮不新增 warning；原 `useSteppedLayout.ts` 的五个 CAD lifecycle unused destructuring warning 消失，`updateGroupSplitPartTarget` 的既有 warning 保留。若命令仍因仓库既有 warning 退出非 0，记录准确文件、规则和数量，不把它报告为通过。

- [ ] **步骤 4：审计候选 2 边界**

运行：

```bash
rg -n "generateSplitPreview|exportSplitParts|splitPreviewParts|isGeneratingSplitPreview|handleGenerateSplitPreview|clearSplitPreview|handleExportSplitParts" src/hooks/useSteppedLayoutController.ts src/hooks/useSteppedLayout.ts
```

预期：无输出。

运行：

```bash
rg -n "generateSteppedCadSplitPreview|exportSteppedCadSplitPartFiles" src/hooks
```

预期：生产代码只在 `src/hooks/useSteppedCadLayout.ts` 中把这两个 Implementation 注入 CAD split Module；测试 mock 可有额外命中。

- [ ] **步骤 5：检查 diff 与工作区**

运行：

```bash
git diff --check
git status --short
```

预期：`git diff --check` 无输出；除计划执行产生且已提交的文件外，工作区为空。若存在用户原有修改，保留并单独报告。

- [ ] **步骤 6：必要时提交验证修正**

只有完整验证暴露并修复了遗漏时才执行：

```bash
git add src/hooks/useSteppedCadSplitOrchestration.ts src/hooks/useSteppedCadSplitOrchestration.test.ts src/hooks/useSteppedLayoutController.ts src/hooks/useSteppedLayout.ts src/hooks/useSteppedLayout.integration.test.ts src/hooks/useSteppedCadLayout.ts src/hooks/useSteppedCadLayout.test.ts src/hooks/steppedCadAdapters.test.tsx src/workspaces/stepped/useSteppedWorkspace.tsx src/workspaces/stepped-cad/useSteppedCadWorkspace.tsx src/viewports/stepped/useSteppedViewportWorkspace.tsx src/viewports/stepped-cad/useSteppedCadViewportWorkspace.tsx
git commit -m "test: 完成 stepped cad split orchestration 验证"
```

若无额外修正，不创建空提交。
