# Mode Interaction State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move stepped-family shared interaction state behind a deeper mode editor orchestration Module so `page.tsx` no longer owns stepped-specific wiring.

**Architecture:** Add a small Mode Interaction State hook and a `useModeEditorWorkspaces` orchestration hook. The orchestration hook creates all Mode models, owns stepped-family interaction state, injects it only into stepped workspace/viewport adapters, and returns active workspace/viewport to the page shell.

**Tech Stack:** Next.js client hooks, React 19, TypeScript, Vitest, Testing Library, existing Mode Workspace and Mode Viewport Workspace adapters.

---

## 文件结构

- Create: `src/hooks/useModeInteractionState.ts`
  - Owns the reusable Mode Interaction State shape for selected slot ids, preview group id, and idempotent reset.
  - Keeps this state independent from registry Modules and page shell.
- Create: `src/hooks/useModeInteractionState.test.ts`
  - Verifies the state hook updates selected slots, updates preview group, and resets both values.
- Create: `src/hooks/useModeEditorWorkspaces.tsx`
  - Creates all Mode models.
  - Creates stepped-family Mode Interaction State.
  - Calls `useModeViewportWorkspaces` and `useModeWorkspaces`.
  - Returns only `activeWorkspace` and `activeViewport`.
- Create: `src/hooks/useModeEditorWorkspaces.test.tsx`
  - Verifies the orchestration hook passes one shared Mode Interaction State instance to both registries.
  - Verifies page-facing return shape stays limited to active outputs.
- Modify: `src/hooks/useModeViewportWorkspaces.tsx`
  - Removes stepped-only return fields.
  - Accepts stepped-family Mode Interaction State as internal orchestration input.
  - Passes that state to stepped and stepped-cad viewport adapters.
- Modify: `src/hooks/useModeWorkspaces.tsx`
  - Removes page-facing stepped-only options.
  - Accepts stepped-family Mode Interaction State as internal orchestration input.
  - Passes that state to stepped and stepped-cad workspace adapters.
- Modify: `src/viewports/stepped/useSteppedViewportWorkspace.tsx`
  - Stops creating `selectedSlotIds` and `previewGroupId`.
  - Consumes injected Mode Interaction State.
  - Keeps canvas wiring, active-group sync, outline-preview pause/resume, and viewport rendering.
- Modify: `src/viewports/stepped-cad/useSteppedCadViewportWorkspace.tsx`
  - Forwards injected Mode Interaction State to the shared stepped viewport adapter.
- Modify: `src/workspaces/stepped/useSteppedWorkspace.tsx`
  - Consumes injected Mode Interaction State instead of individual selected/preview/reset props.
  - Keeps reset/import/Draft load behavior by calling the shared reset.
- Modify: `src/workspaces/stepped-cad/useSteppedCadWorkspace.tsx`
  - Forwards injected Mode Interaction State to the shared stepped workspace adapter.
- Modify: `src/app/page.tsx`
  - Uses `useModeEditorWorkspaces({ mode })`.
  - Removes all stepped-only wiring.
- Modify: `src/app/page.test.tsx`
  - Keeps end-to-end observable coverage for stepped selection, preview group, mode-change reset, and Draft dialog wiring.
  - Does not mock or assert page-owned stepped-only state.

## Task 1: 增加 Mode Interaction State Hook

**Files:**
- Create: `src/hooks/useModeInteractionState.ts`
- Create: `src/hooks/useModeInteractionState.test.ts`
- Test: `src/hooks/useModeInteractionState.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `src/hooks/useModeInteractionState.test.ts`：

```ts
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useModeInteractionState } from "@/hooks/useModeInteractionState";

describe("useModeInteractionState", () => {
  it("tracks selected slots, preview group, and resets both values", () => {
    const { result } = renderHook(() => useModeInteractionState());

    expect(result.current.selectedSlotIds).toEqual([]);
    expect(result.current.previewGroupId).toBeNull();

    act(() => {
      result.current.setSelectedSlotIds(["slot-1", "slot-2"]);
      result.current.setPreviewGroupId("group-1");
    });

    expect(result.current.selectedSlotIds).toEqual(["slot-1", "slot-2"]);
    expect(result.current.previewGroupId).toBe("group-1");

    act(() => {
      result.current.resetInteractionState();
    });

    expect(result.current.selectedSlotIds).toEqual([]);
    expect(result.current.previewGroupId).toBeNull();
  });

  it("allows repeated resets without changing the empty state", () => {
    const { result } = renderHook(() => useModeInteractionState());

    act(() => {
      result.current.resetInteractionState();
      result.current.resetInteractionState();
    });

    expect(result.current.selectedSlotIds).toEqual([]);
    expect(result.current.previewGroupId).toBeNull();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
pnpm exec vitest run src/hooks/useModeInteractionState.test.ts
```

Expected: FAIL，失败原因应为 `Cannot find module '@/hooks/useModeInteractionState'` 或 `useModeInteractionState` 未定义。

- [ ] **Step 3: 实现 Hook**

创建 `src/hooks/useModeInteractionState.ts`：

```ts
"use client";

import { useCallback, useState } from "react";

export interface ModeInteractionState {
  selectedSlotIds: string[];
  previewGroupId: string | null;
  setSelectedSlotIds: (ids: string[]) => void;
  setPreviewGroupId: (groupId: string | null) => void;
  resetInteractionState: () => void;
}

export function useModeInteractionState(): ModeInteractionState {
  const [selectedSlotIds, setSelectedSlotIds] = useState<string[]>([]);
  const [previewGroupId, setPreviewGroupId] = useState<string | null>(null);

  const resetInteractionState = useCallback(() => {
    setSelectedSlotIds([]);
    setPreviewGroupId(null);
  }, []);

  return {
    selectedSlotIds,
    previewGroupId,
    setSelectedSlotIds,
    setPreviewGroupId,
    resetInteractionState,
  };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run:

```bash
pnpm exec vitest run src/hooks/useModeInteractionState.test.ts
```

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/hooks/useModeInteractionState.ts src/hooks/useModeInteractionState.test.ts
git commit -m "test: 覆盖 mode interaction state hook"
```

## Task 2: 让 stepped viewport Adapter 消费 Mode Interaction State

**Files:**
- Modify: `src/viewports/stepped/useSteppedViewportWorkspace.tsx`
- Modify: `src/viewports/stepped-cad/useSteppedCadViewportWorkspace.tsx`
- Test: `src/app/page.test.tsx`

- [ ] **Step 1: 运行现有 page 测试作为基线**

Run:

```bash
pnpm exec vitest run src/app/page.test.tsx
```

Expected: PASS。若失败，先记录失败用例，不要在本任务混入无关修复。

- [ ] **Step 2: 更新 stepped viewport Adapter 的 options 和 return shape**

在 `src/viewports/stepped/useSteppedViewportWorkspace.tsx` 中：

1. 把 import 改为移除 `useState`，并引入 `ModeInteractionState`：

```ts
import { useCallback, useEffect, useMemo } from "react";
import type { ModeInteractionState } from "@/hooks/useModeInteractionState";
```

2. 修改 options 和 return types：

```ts
interface UseSteppedViewportWorkspaceOptions {
  model: UseSteppedLayoutReturn | UseSteppedCadLayoutReturn;
  interactionState: ModeInteractionState;
  rightView: "2d" | "3d";
  onRightViewChange: (next: "2d" | "3d") => void;
  mode?: Extract<AppMode, "stepped" | "stepped-cad">;
  supportsSplitPreview?: boolean;
}

interface UseSteppedViewportWorkspaceReturn {
  workspace: ModeViewportWorkspace;
}
```

3. 修改函数参数，并移除内部 `useState`：

```ts
export function useSteppedViewportWorkspace({
  model,
  interactionState,
  rightView,
  onRightViewChange,
  mode = "stepped",
  supportsSplitPreview = false,
}: UseSteppedViewportWorkspaceOptions): UseSteppedViewportWorkspaceReturn {
  const {
    selectedSlotIds,
    previewGroupId,
    setSelectedSlotIds,
    resetInteractionState,
  } = interactionState;
```

- [ ] **Step 3: 替换 reset 和 selection wiring**

在同一个文件中：

1. 替换 reset callback：

```ts
  const resetSteppedViewportState = useCallback(() => {
    resetInteractionState();
  }, [resetInteractionState]);
```

2. 在 `LayoutCanvas` commands 中替换 selection callback：

```ts
          selectionChanged: setSelectedSlotIds,
```

3. 保持 active-group sync effect 使用 `selectedSlotIds`：

```ts
  useEffect(() => {
    if (selectedSlotIds.length === 0) {
      return;
    }

    const firstSlotId = selectedSlotIds[0];
    const slot = model.params.slots.find((candidate) => candidate.id === firstSlotId);
    if (slot && "groupId" in slot && slot.groupId !== model.params.activeGroupId) {
      model.setActiveGroup(slot.groupId);
    }
  }, [model, selectedSlotIds]);
```

4. 把 return 收窄为只返回 workspace：

```ts
  return {
    workspace: {
      mode,
      viewport,
      resetTransientState: resetSteppedViewportState,
    },
  };
}
```

- [ ] **Step 4: 更新 stepped-cad viewport Adapter**

在 `src/viewports/stepped-cad/useSteppedCadViewportWorkspace.tsx` 中引入类型并更新 options：

```ts
import type { ModeInteractionState } from "@/hooks/useModeInteractionState";
```

```ts
interface UseSteppedCadViewportWorkspaceOptions {
  model: UseSteppedCadLayoutReturn;
  interactionState: ModeInteractionState;
  rightView: "2d" | "3d";
  onRightViewChange: (next: "2d" | "3d") => void;
}
```

函数 body 保持 spread forwarding：

```ts
export function useSteppedCadViewportWorkspace(
  options: UseSteppedCadViewportWorkspaceOptions,
) {
  return useSteppedViewportWorkspace({
    ...options,
    mode: "stepped-cad",
    supportsSplitPreview: true,
  });
}
```

- [ ] **Step 5: 运行 TypeScript 确认当前预期失败**

Run:

```bash
pnpm run typecheck
```

Expected: FAIL。失败点应集中在调用 `useSteppedViewportWorkspace` / `useSteppedCadViewportWorkspace` 时缺少 `interactionState`，以及 `useModeViewportWorkspaces` 仍读取被移除的 stepped-only return fields。

- [ ] **Step 6: 提交 viewport 迁移**

```bash
git add src/viewports/stepped/useSteppedViewportWorkspace.tsx src/viewports/stepped-cad/useSteppedCadViewportWorkspace.tsx
git commit -m "refactor: viewport 消费 mode interaction state"
```

## Task 3: 让 stepped workspace Adapter 消费 Mode Interaction State

**Files:**
- Modify: `src/workspaces/stepped/useSteppedWorkspace.tsx`
- Modify: `src/workspaces/stepped-cad/useSteppedCadWorkspace.tsx`
- Test: `src/app/page.test.tsx`

- [ ] **Step 1: 更新 stepped workspace options**

在 `src/workspaces/stepped/useSteppedWorkspace.tsx` 中引入类型：

```ts
import type { ModeInteractionState } from "@/hooks/useModeInteractionState";
```

把 `UseSteppedWorkspaceOptions` 改为：

```ts
interface UseSteppedWorkspaceOptions {
  model: UseSteppedLayoutReturn | UseSteppedCadLayoutReturn;
  interactionState: ModeInteractionState;
  mode?: Extract<AppMode, "stepped" | "stepped-cad">;
  enableSplitExport?: boolean;
}
```

把函数参数改为：

```ts
export function useSteppedWorkspace({
  model,
  interactionState,
  mode = "stepped",
  enableSplitExport = false,
}: UseSteppedWorkspaceOptions): ModeWorkspace {
  const {
    selectedSlotIds,
    previewGroupId,
    setPreviewGroupId,
    resetInteractionState,
  } = interactionState;
```

- [ ] **Step 2: 用共享 reset 替换 workspace reset prop**

在同一文件中，把 `onWorkspaceReset` 替换为 `resetInteractionState`：

```ts
  const { draftActions, draftDialogProps, clearDraftBinding } =
    useWorkspaceDraftSupport({
      mode: "stepped",
      params: model.params,
      setParams: model.setParams,
      onAfterLoad: resetInteractionState,
    });

  const resetWorkspace = useCallback(() => {
    model.setParams(STEPPED_LAYOUT_DEFAULTS);
    resetInteractionState();
    clearDraftBinding();
  }, [clearDraftBinding, model, resetInteractionState]);

  const importIntoWorkspace = useCallback((params: unknown) => {
    model.setParams(params as SteppedLayoutParams);
    resetInteractionState();
    clearDraftBinding();
  }, [clearDraftBinding, model, resetInteractionState]);
```

在 `SteppedPanel` props 中替换 preview group callback：

```tsx
        previewGroupId={previewGroupId}
        onPreviewGroupChange={setPreviewGroupId}
```

在 dependency array 中：

- 移除 `onPreviewGroupChange`。
- 移除 `onWorkspaceReset`。
- 加入 `setPreviewGroupId`。
- 加入 `resetInteractionState` 已通过 callbacks 间接覆盖；不要重复加入未直接使用的变量。

- [ ] **Step 3: 更新 stepped-cad workspace Adapter**

在 `src/workspaces/stepped-cad/useSteppedCadWorkspace.tsx` 中引入类型：

```ts
import type { ModeInteractionState } from "@/hooks/useModeInteractionState";
```

把 options 改为：

```ts
interface UseSteppedCadWorkspaceOptions {
  model: UseSteppedCadLayoutReturn;
  interactionState: ModeInteractionState;
}
```

函数 body 保持 spread forwarding：

```ts
export function useSteppedCadWorkspace(
  options: UseSteppedCadWorkspaceOptions,
): ModeWorkspace {
  return useSteppedWorkspace({
    ...options,
    mode: "stepped-cad",
    enableSplitExport: true,
  });
}
```

- [ ] **Step 4: 运行 TypeScript 确认当前预期失败**

Run:

```bash
pnpm run typecheck
```

Expected: FAIL。失败点应集中在 `useModeWorkspaces` 仍传入 `selectedSlotIds`、`previewGroupId`、`onPreviewGroupChange`、`onWorkspaceReset`，且还没有传入 `interactionState`。

- [ ] **Step 5: 提交 workspace 迁移**

```bash
git add src/workspaces/stepped/useSteppedWorkspace.tsx src/workspaces/stepped-cad/useSteppedCadWorkspace.tsx
git commit -m "refactor: workspace 消费 mode interaction state"
```

## Task 4: 新增 mode editor orchestration Module

**Files:**
- Create: `src/hooks/useModeEditorWorkspaces.tsx`
- Create: `src/hooks/useModeEditorWorkspaces.test.tsx`
- Test: `src/hooks/useModeEditorWorkspaces.test.tsx`

- [ ] **Step 1: 写 orchestration 失败测试**

创建 `src/hooks/useModeEditorWorkspaces.test.tsx`：

```tsx
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AppMode } from "@/types/custom-tray";
import type { ModeInteractionState } from "@/hooks/useModeInteractionState";

const {
  activeWorkspace,
  activeViewport,
  capturedWorkspaceOptions,
  capturedViewportOptions,
  modelMocks,
} = vi.hoisted(() => {
  const activeWorkspace = {
    mode: "stepped" as AppMode,
    panel: null,
    draftDialogProps: {
      mode: "stepped" as AppMode,
      open: false,
      onOpenChange: vi.fn(),
      drafts: [],
      currentDraftId: null,
      hasUnsavedChanges: false,
      draftNameInput: "",
      onDraftNameInputChange: vi.fn(),
      onSaveAsNew: vi.fn(),
      onSaveCurrent: vi.fn(),
      onLoad: vi.fn(),
      onRename: vi.fn(),
      onDelete: vi.fn(),
      onExport: vi.fn(),
      renderSummary: () => null,
    },
    commands: {
      resetWorkspace: vi.fn(),
      importIntoWorkspace: vi.fn(),
    },
  };
  const activeViewport = {
    mode: "stepped" as AppMode,
    viewport: null,
    resetTransientState: vi.fn(),
  };
  return {
    activeWorkspace,
    activeViewport,
    capturedWorkspaceOptions: [] as Array<{
      steppedInteractionState: ModeInteractionState;
    }>,
    capturedViewportOptions: [] as Array<{
      steppedInteractionState: ModeInteractionState;
    }>,
    modelMocks: {
      gridModel: { kind: "grid" },
      customModel: { kind: "custom" },
      simpleSteppedModel: { kind: "simple-stepped" },
      steppedModel: { kind: "stepped" },
      steppedCadModel: { kind: "stepped-cad" },
    },
  };
});

vi.mock("@/hooks/useTrayModel", () => ({
  useTrayModel: () => modelMocks.gridModel,
}));

vi.mock("@/hooks/useCustomLayout", () => ({
  useCustomLayout: () => modelMocks.customModel,
}));

vi.mock("@/hooks/useSimpleSteppedLayout", () => ({
  useSimpleSteppedLayout: () => modelMocks.simpleSteppedModel,
}));

vi.mock("@/hooks/useSteppedLayout", () => ({
  useSteppedLayout: () => modelMocks.steppedModel,
}));

vi.mock("@/hooks/useSteppedCadLayout", () => ({
  useSteppedCadLayout: () => modelMocks.steppedCadModel,
}));

vi.mock("@/hooks/useModeWorkspaces", () => ({
  useModeWorkspaces: (options: {
    steppedInteractionState: ModeInteractionState;
  }) => {
    capturedWorkspaceOptions.push(options);
    return { activeWorkspace };
  },
}));

vi.mock("@/hooks/useModeViewportWorkspaces", () => ({
  useModeViewportWorkspaces: (options: {
    steppedInteractionState: ModeInteractionState;
  }) => {
    capturedViewportOptions.push(options);
    return { activeViewport };
  },
}));

import { useModeEditorWorkspaces } from "@/hooks/useModeEditorWorkspaces";

describe("useModeEditorWorkspaces", () => {
  it("returns active workspace and viewport while sharing one stepped interaction state", () => {
    const { result } = renderHook(() =>
      useModeEditorWorkspaces({ mode: "stepped" }),
    );

    expect(result.current).toEqual({
      activeWorkspace,
      activeViewport,
    });
    expect(capturedWorkspaceOptions).toHaveLength(1);
    expect(capturedViewportOptions).toHaveLength(1);
    expect(
      capturedWorkspaceOptions[0].steppedInteractionState,
    ).toBe(capturedViewportOptions[0].steppedInteractionState);
    expect(
      capturedWorkspaceOptions[0].steppedInteractionState.selectedSlotIds,
    ).toEqual([]);
    expect(
      capturedWorkspaceOptions[0].steppedInteractionState.previewGroupId,
    ).toBeNull();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
pnpm exec vitest run src/hooks/useModeEditorWorkspaces.test.tsx
```

Expected: FAIL，失败原因应为 `Cannot find module '@/hooks/useModeEditorWorkspaces'` 或 `useModeEditorWorkspaces` 未定义。

- [ ] **Step 3: 实现 orchestration Hook**

创建 `src/hooks/useModeEditorWorkspaces.tsx`：

```tsx
"use client";

import { useTrayModel } from "@/hooks/useTrayModel";
import { useCustomLayout } from "@/hooks/useCustomLayout";
import { useSimpleSteppedLayout } from "@/hooks/useSimpleSteppedLayout";
import { useSteppedLayout } from "@/hooks/useSteppedLayout";
import { useSteppedCadLayout } from "@/hooks/useSteppedCadLayout";
import { useModeInteractionState } from "@/hooks/useModeInteractionState";
import { useModeWorkspaces } from "@/hooks/useModeWorkspaces";
import { useModeViewportWorkspaces } from "@/hooks/useModeViewportWorkspaces";
import type { ModeWorkspace } from "@/workspaces/types";
import type { ModeViewportWorkspace } from "@/viewports/types";
import type { AppMode } from "@/types/custom-tray";

interface UseModeEditorWorkspacesOptions {
  mode: AppMode;
}

interface UseModeEditorWorkspacesReturn {
  activeWorkspace: ModeWorkspace;
  activeViewport: ModeViewportWorkspace;
}

export function useModeEditorWorkspaces({
  mode,
}: UseModeEditorWorkspacesOptions): UseModeEditorWorkspacesReturn {
  const gridModel = useTrayModel();
  const customModel = useCustomLayout();
  const simpleSteppedModel = useSimpleSteppedLayout();
  const steppedModel = useSteppedLayout();
  const steppedCadModel = useSteppedCadLayout();
  const steppedInteractionState = useModeInteractionState();

  const { activeViewport } = useModeViewportWorkspaces({
    mode,
    gridModel,
    customModel,
    simpleSteppedModel,
    steppedModel,
    steppedCadModel,
    steppedInteractionState,
  });

  const { activeWorkspace } = useModeWorkspaces({
    mode,
    gridModel,
    customModel,
    simpleSteppedModel,
    steppedModel,
    steppedCadModel,
    steppedInteractionState,
  });

  return {
    activeWorkspace,
    activeViewport,
  };
}
```

- [ ] **Step 4: 运行测试确认当前预期失败**

Run:

```bash
pnpm exec vitest run src/hooks/useModeEditorWorkspaces.test.tsx
```

Expected: FAIL。失败点应为 `useModeWorkspaces` 和 `useModeViewportWorkspaces` 的 TypeScript 或 runtime options 还不接受 `steppedInteractionState`。

本步骤失败是预期的；下一任务会收窄 registries。

- [ ] **Step 5: 提交 orchestration Hook 和测试**

```bash
git add src/hooks/useModeEditorWorkspaces.tsx src/hooks/useModeEditorWorkspaces.test.tsx
git commit -m "test: 覆盖 mode editor orchestration"
```

## Task 5: 收窄 Mode Workspace 与 Viewport Registry

**Files:**
- Modify: `src/hooks/useModeViewportWorkspaces.tsx`
- Modify: `src/hooks/useModeWorkspaces.tsx`
- Test: `src/hooks/useModeEditorWorkspaces.test.tsx`

- [ ] **Step 1: 更新 viewport registry options 和 return**

在 `src/hooks/useModeViewportWorkspaces.tsx` 中：

1. 保留 `useState`，引入 `ModeInteractionState`：

```ts
import { useMemo, useState } from "react";
import type { ModeInteractionState } from "@/hooks/useModeInteractionState";
```

2. 在 `UseModeViewportWorkspacesOptions` 加入：

```ts
  steppedInteractionState: ModeInteractionState;
```

3. 把 `UseModeViewportWorkspacesReturn` 收窄为：

```ts
interface UseModeViewportWorkspacesReturn {
  activeViewport: ModeViewportWorkspace;
}
```

4. 删除 `activeSteppedViewportState`。

5. 给 stepped adapters 传入 interaction state：

```ts
  const steppedViewport = useSteppedViewportWorkspace({
    model: steppedModel,
    interactionState: steppedInteractionState,
    rightView,
    onRightViewChange: setRightView,
  });
  const steppedCadViewport = useSteppedCadViewportWorkspace({
    model: steppedCadModel,
    interactionState: steppedInteractionState,
    rightView,
    onRightViewChange: setRightView,
  });
```

6. return 改为：

```ts
  return {
    activeViewport,
  };
```

- [ ] **Step 2: 更新 workspace registry options**

在 `src/hooks/useModeWorkspaces.tsx` 中：

1. 引入 `ModeInteractionState`：

```ts
import type { ModeInteractionState } from "@/hooks/useModeInteractionState";
```

2. 把 `UseModeWorkspacesOptions` 中的 stepped-only 字段：

```ts
  selectedSlotIds: string[];
  previewGroupId: string | null;
  onPreviewGroupChange: (groupId: string | null) => void;
  onSteppedWorkspaceReset: () => void;
```

替换为：

```ts
  steppedInteractionState: ModeInteractionState;
```

3. 函数参数中删除 `selectedSlotIds`、`previewGroupId`、`onPreviewGroupChange`、`onSteppedWorkspaceReset`，加入 `steppedInteractionState`。

4. 调整 stepped workspace calls：

```ts
  const steppedWorkspace = useSteppedWorkspace({
    model: steppedModel,
    interactionState: steppedInteractionState,
  });
  const steppedCadWorkspace = useSteppedCadWorkspace({
    model: steppedCadModel,
    interactionState: steppedInteractionState,
  });
```

- [ ] **Step 3: 运行 orchestration 测试确认通过**

Run:

```bash
pnpm exec vitest run src/hooks/useModeInteractionState.test.ts src/hooks/useModeEditorWorkspaces.test.tsx
```

Expected: PASS。

- [ ] **Step 4: 运行 TypeScript 确认当前预期失败**

Run:

```bash
pnpm run typecheck
```

Expected: FAIL。失败点应集中在 `src/app/page.tsx` 仍直接调用两个 registry 且传入旧 stepped-only 字段。

- [ ] **Step 5: 提交 registry 收窄**

```bash
git add src/hooks/useModeViewportWorkspaces.tsx src/hooks/useModeWorkspaces.tsx
git commit -m "refactor: 收窄 mode workspace registries"
```

## Task 6: 简化 page shell 并保留用户可见行为

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/page.test.tsx`
- Test: `src/app/page.test.tsx`

- [ ] **Step 1: 更新 page import**

在 `src/app/page.tsx` 中删除这些 imports：

```ts
import { useTrayModel } from "@/hooks/useTrayModel";
import { useCustomLayout } from "@/hooks/useCustomLayout";
import { useSimpleSteppedLayout } from "@/hooks/useSimpleSteppedLayout";
import { useSteppedLayout } from "@/hooks/useSteppedLayout";
import { useSteppedCadLayout } from "@/hooks/useSteppedCadLayout";
import { useModeWorkspaces } from "@/hooks/useModeWorkspaces";
import { useModeViewportWorkspaces } from "@/hooks/useModeViewportWorkspaces";
```

加入：

```ts
import { useModeEditorWorkspaces } from "@/hooks/useModeEditorWorkspaces";
```

- [ ] **Step 2: 替换 page 内部 model 和 registry wiring**

在 `Home` 内删除从 `// Grid Mode State` 到 `useModeWorkspaces` 的所有 model/registry setup，替换为：

```ts
  const { activeWorkspace, activeViewport } = useModeEditorWorkspaces({
    mode,
  });
```

保留 `ModeTabs` 的 mode change 行为：

```tsx
      <ModeTabs mode={mode} onModeChange={(m) => {
        activeViewport.resetTransientState();
        setMode(m);
      }} />
```

- [ ] **Step 3: 更新 page test，让 mock 覆盖新 orchestration Hook 的真实依赖链**

`src/app/page.test.tsx` 当前 mock 了 model hooks、Draft hooks、dynamic components。保留这些 mock。

不要 mock `useModeEditorWorkspaces`。这样 page test 会继续穿过新 orchestration Hook、registries、workspace adapters 和 viewport adapters，覆盖 selection / preview group / reset 行为。

检查并确认这些现有断言仍保留：

```ts
expect(screen.getByTestId("stepped-panel")).toHaveAttribute(
  "data-selected-slot-ids",
  "slot-1",
);
expect(screen.getByTestId("stepped-panel")).toHaveAttribute(
  "data-preview-group-id",
  "group-1",
);
expect(screen.getByTestId("layout-canvas")).toHaveAttribute(
  "data-focused-group-id",
  "group-1",
);
```

在同一个 stepped test 的 mode-change reset 断言前加入一条 explicit page-shell 行为注释，避免未来把测试误改成 page-owned state：

```ts
    // Page shell only calls active viewport reset; stepped interaction state
    // is owned behind useModeEditorWorkspaces.
```

- [ ] **Step 4: 运行 page 测试确认通过**

Run:

```bash
pnpm exec vitest run src/app/page.test.tsx
```

Expected: PASS。关键用例 `syncs stepped selection to the active group, pauses outline preview, and resets stepped UI state on mode changes` 必须通过。

- [ ] **Step 5: 运行 TypeScript 确认通过**

Run:

```bash
pnpm run typecheck
```

Expected: PASS。

- [ ] **Step 6: 提交 page shell 简化**

```bash
git add src/app/page.tsx src/app/page.test.tsx
git commit -m "refactor: page 使用 mode editor orchestration"
```

## Task 7: 全量验证与收尾

**Files:**
- Verify only unless tests reveal required fixes.

- [ ] **Step 1: 搜索 stepped-only state 是否还泄漏到 page 或 registry return**

Run:

```bash
rg -n "steppedSelectedSlotIds|steppedPreviewGroupId|setSteppedPreviewGroupId|resetSteppedViewportState|selectedSlotIds: string\\[]|previewGroupId: string \\| null|onPreviewGroupChange|onSteppedWorkspaceReset" src/app src/hooks src/workspaces src/viewports
```

Expected: matches may remain in stepped workspace/viewport adapter options, `SteppedPanel` props, and tests. There should be no matches in `src/app/page.tsx`, and no `UseModeViewportWorkspacesReturn` fields other than `activeViewport`.

- [ ] **Step 2: 运行聚焦测试**

Run:

```bash
pnpm exec vitest run src/hooks/useModeInteractionState.test.ts src/hooks/useModeEditorWorkspaces.test.tsx src/app/page.test.tsx
```

Expected: PASS。

- [ ] **Step 3: 运行项目测试**

Run:

```bash
pnpm run test
```

Expected: PASS。

- [ ] **Step 4: 运行类型检查**

Run:

```bash
pnpm run typecheck
```

Expected: PASS。

- [ ] **Step 5: 运行 lint**

Run:

```bash
pnpm run lint
```

Expected: PASS or existing unrelated warnings only. If lint reports only pre-existing warnings outside files touched by this plan, record the exact files and do not mix unrelated cleanup into this task.

- [ ] **Step 6: 提交验证记录**

如果 Task 7 没有代码变化，只提交验证记录不需要新 commit。  
如果为了修复本计划触碰文件中的问题产生了代码变化：

```bash
git add src/hooks/useModeInteractionState.ts src/hooks/useModeEditorWorkspaces.tsx src/hooks/useModeViewportWorkspaces.tsx src/hooks/useModeWorkspaces.tsx src/viewports/stepped/useSteppedViewportWorkspace.tsx src/viewports/stepped-cad/useSteppedCadViewportWorkspace.tsx src/workspaces/stepped/useSteppedWorkspace.tsx src/workspaces/stepped-cad/useSteppedCadWorkspace.tsx src/app/page.tsx src/app/page.test.tsx
git commit -m "chore: 验证 mode interaction state 迁移"
```

## 自查

- Spec coverage:
  - Mode Interaction State 归属：Task 1、Task 4、Task 5。
  - Workspace / viewport adapters 共享同一 state：Task 2、Task 3、Task 4。
  - Registry 不再暴露 stepped-only fields：Task 5、Task 7。
  - Page shell 简化：Task 6。
  - Selection、preview group、reset 行为：Task 6、Task 7。
- Placeholder scan:
  - 本计划不包含占位标记或延后实现要求。
  - 每个代码变更步骤都给出目标文件和具体代码片段。
- Type consistency:
  - Shared type name is `ModeInteractionState`.
  - Shared state prop name is `steppedInteractionState` in registries and orchestration.
  - Adapter-local option name is `interactionState`.
  - Reset method name is `resetInteractionState`.
