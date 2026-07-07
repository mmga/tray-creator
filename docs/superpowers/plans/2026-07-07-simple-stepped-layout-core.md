# Simple Stepped Layout Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deepen the `simple-stepped` editing Module so import, Draft load, and runtime edit paths all use one Simple Stepped Layout Core normalization function.

**Architecture:** Use `src/lib/simple-stepped-projection.ts` as the Simple Stepped Layout Core implementation location. Move runtime normalization details out of `useSimpleSteppedLayout`, delegate simple stepped import repair from `param-normalization`, and keep Slot Geometry Snapshot repair behind the existing Slot Instance Factory.

**Tech Stack:** Next.js client hooks, TypeScript, Vitest, Testing Library, existing tray domain modules.

---

## 文件结构

- Modify: `src/lib/simple-stepped-projection.ts`
  - Owns `normalizeSimpleSteppedParams`.
  - Calls `normalizeSimpleSteppedSlotInstanceSnapshot` from `src/lib/slot-instance-factory.ts`.
  - Rebuilds row membership, fixes finite `slot.y`, synchronizes `outerMargin`, and normalizes tray size.
- Modify: `src/hooks/useSimpleSteppedLayout.ts`
  - Imports `normalizeSimpleSteppedParams` instead of defining local `rebuildRowSlotIds` and `normalizeSimpleSteppedTraySize`.
  - Keeps undo history, active row state, preview invalidation, worker preview/export, and trusted UI mutation logic.
- Modify: `src/lib/param-normalization.ts`
  - Keeps simple stepped required-field and legacy-shape migration in the pipeline.
  - Delegates simple stepped slot snapshot repair, row membership repair, outer margin synchronization, and derived tray size normalization to `normalizeSimpleSteppedParams`.
- Modify: `src/lib/simple-stepped-projection.test.ts`
  - Adds focused core tests for normalization invariants.
- Modify: `src/lib/param-normalization.test.ts`
  - Adds/adjusts import-path coverage proving the pipeline uses the same core behavior.
- Modify: `src/hooks/useSimpleSteppedLayout.integration.test.ts`
  - Adds runtime coverage for content-required tray size exceeding the warning threshold.

## Task 1: 深化 Simple Stepped Layout Core 测试面

**Files:**
- Modify: `src/lib/simple-stepped-projection.test.ts`
- Test: `src/lib/simple-stepped-projection.test.ts`

- [ ] **Step 1: 写失败测试**

在 `src/lib/simple-stepped-projection.test.ts` 的 import 中加入 `MAX_BUILD_SIZE`、`normalizeSimpleSteppedParams`：

```ts
import { MAX_BUILD_SIZE } from "@/lib/config";
import {
  mapSimpleSteppedCanvasUpdatesToLocal,
  normalizeSimpleSteppedParams,
  resolveSimpleSteppedSlotMoveScope,
} from "@/lib/simple-stepped-projection";
```

在 `describe("simple stepped projection", () => { ... })` 内追加这些测试：

```ts
  it("normalizes row membership, outer margin, and slot snapshots", () => {
    const normalized = normalizeSimpleSteppedParams({
      ...createParams(),
      spacing: 7,
      outerMarginIndependent: false,
      outerMargin: 99,
      rows: [
        { id: "row-1", name: "前排", slotIds: ["stale"] },
        { id: "row-2", name: "后排", slotIds: [] },
      ],
      slots: [
        {
          id: "slot-1",
          rowId: "row-1",
          shape: "circle",
          diameter: 40,
          x: -15,
          y: Number.NaN,
        },
        {
          id: "slot-2",
          rowId: "row-2",
          shape: "circle",
          diameter: 100,
          slotDefinitionId: undefined,
          effectiveDiameter: undefined,
          x: 15,
          y: 2,
        },
      ],
    } as SimpleSteppedLayoutParams);

    expect(normalized.outerMargin).toBe(7);
    expect(normalized.rows[0].slotIds).toEqual(["slot-1"]);
    expect(normalized.rows[1].slotIds).toEqual(["slot-2"]);
    expect(normalized.slots[0]).toMatchObject({
      y: 0,
      slotDefinitionId: "circle-40",
      effectiveDiameter: 40.4,
    });
    expect(normalized.slots[1]).toMatchObject({
      slotDefinitionId: "circle-100",
      effectiveDiameter: 100.4,
    });
  });

  it("preserves independent outer margin while normalizing slots", () => {
    const normalized = normalizeSimpleSteppedParams({
      ...createParams(),
      spacing: 7,
      outerMarginIndependent: true,
      outerMargin: 12,
    });

    expect(normalized.outerMarginIndependent).toBe(true);
    expect(normalized.outerMargin).toBe(12);
  });

  it("allows content-required tray dimensions to exceed the build warning threshold", () => {
    const normalized = normalizeSimpleSteppedParams({
      ...createParams(),
      trayWidth: 100,
      trayDepth: 100,
      rows: [
        { id: "row-1", name: "超宽行", slotIds: ["slot-1", "slot-2"] },
      ],
      slots: [
        {
          id: "slot-1",
          rowId: "row-1",
          shape: "circle",
          diameter: 100,
          x: -MAX_BUILD_SIZE,
          y: 0,
        },
        {
          id: "slot-2",
          rowId: "row-1",
          shape: "circle",
          diameter: 100,
          x: MAX_BUILD_SIZE,
          y: 0,
        },
      ],
    } as SimpleSteppedLayoutParams);

    expect(normalized.trayWidth).toBeGreaterThan(MAX_BUILD_SIZE);
  });
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
pnpm exec vitest run src/lib/simple-stepped-projection.test.ts
```

Expected: FAIL。失败点应包含 `normalizeSimpleSteppedParams` 不修复 snapshot，或现有实现未满足新增断言。

- [ ] **Step 3: 提交失败测试**

```bash
git add src/lib/simple-stepped-projection.test.ts
git commit -m "test: 覆盖 simple stepped layout core 归一化"
```

## Task 2: 实现 Simple Stepped Layout Core 归一化

**Files:**
- Modify: `src/lib/simple-stepped-projection.ts`
- Test: `src/lib/simple-stepped-projection.test.ts`

- [ ] **Step 1: 接入 Slot Instance Factory**

在 `src/lib/simple-stepped-projection.ts` 顶部 import 中加入：

```ts
import { normalizeSimpleSteppedSlotInstanceSnapshot } from "@/lib/slot-instance-factory";
```

- [ ] **Step 2: 替换 `normalizeSimpleSteppedParams` 实现**

将 `normalizeSimpleSteppedParams` 替换为以下实现；保留文件中现有 `normalizeSimpleSteppedTraySize` 和 `rebuildRowSlotIds` helper。

```ts
export function normalizeSimpleSteppedParams(
  next: SimpleSteppedLayoutParams,
): SimpleSteppedLayoutParams {
  const rows = next.rows.length > 0
    ? next.rows
    : next.slots.length > 0
      ? [
          {
            id: crypto.randomUUID(),
            name: "行 1",
            slotIds: [],
          },
        ]
      : [];
  const rowIds = new Set(rows.map((row) => row.id));
  const fallbackRowId = rows[0]?.id ?? "";
  const normalizedSlots = next.slots.map((slot) =>
    normalizeSimpleSteppedSlotInstanceSnapshot({
      ...slot,
      rowId: rowIds.has(slot.rowId) ? slot.rowId : fallbackRowId,
      shape: "circle",
      y: Number.isFinite(slot.y) ? slot.y : 0,
    }),
  );
  const rebuiltRows = rebuildRowSlotIds(rows, normalizedSlots);
  const withRowIds: SimpleSteppedLayoutParams = {
    ...next,
    rows: rebuiltRows,
    slots: normalizedSlots,
    outerMarginIndependent: Boolean(next.outerMarginIndependent),
    outerMargin: next.outerMarginIndependent ? next.outerMargin : next.spacing,
  };
  const minimumDims = calculateSimpleSteppedMinimumTraySize(withRowIds);
  const fallbackWidth =
    Number.isFinite(withRowIds.trayWidth) && withRowIds.trayWidth > 0
      ? withRowIds.trayWidth
      : SIMPLE_STEPPED_LAYOUT_DEFAULTS.trayWidth;
  const fallbackDepth =
    Number.isFinite(withRowIds.trayDepth) && withRowIds.trayDepth > 0
      ? withRowIds.trayDepth
      : SIMPLE_STEPPED_LAYOUT_DEFAULTS.trayDepth;

  return {
    ...withRowIds,
    trayWidth: normalizeSimpleSteppedTraySize(
      withRowIds.trayWidth,
      minimumDims.width,
      fallbackWidth,
    ),
    trayDepth: normalizeSimpleSteppedTraySize(
      withRowIds.trayDepth,
      minimumDims.depth,
      fallbackDepth,
    ),
  };
}
```

- [ ] **Step 3: 运行 core 测试确认通过**

Run:

```bash
pnpm exec vitest run src/lib/simple-stepped-projection.test.ts
```

Expected: PASS。

- [ ] **Step 4: 提交 core 实现**

```bash
git add src/lib/simple-stepped-projection.ts
git commit -m "refactor: 深化 simple stepped layout core 归一化"
```

## Task 3: 让运行时编辑复用 Simple Stepped Layout Core

**Files:**
- Modify: `src/hooks/useSimpleSteppedLayout.ts`
- Modify: `src/hooks/useSimpleSteppedLayout.integration.test.ts`
- Test: `src/hooks/useSimpleSteppedLayout.integration.test.ts`

- [ ] **Step 1: 写运行时超过提示阈值的失败测试**

在 `src/hooks/useSimpleSteppedLayout.integration.test.ts` 顶部 import 中加入：

```ts
import { MAX_BUILD_SIZE } from "@/lib/config";
```

在 `describe("useSimpleSteppedLayout", () => { ... })` 内追加测试：

```ts
  it("keeps content-required tray size above the build warning threshold during runtime edits", () => {
    vi.spyOn(crypto, "randomUUID")
      .mockReturnValueOnce("row-1")
      .mockReturnValueOnce("slot-1")
      .mockReturnValueOnce("slot-2");

    const { result } = renderHook(() => useSimpleSteppedLayout());

    act(() => {
      result.current.addRow();
      result.current.addSlotToRow("row-1", 100);
      result.current.addSlotToRow("row-1", 100);
      result.current.updateMultipleSlots([
        { id: "slot-1", x: -MAX_BUILD_SIZE, y: result.current.params.slots[0].y },
        { id: "slot-2", x: MAX_BUILD_SIZE, y: result.current.params.slots[1].y },
      ]);
    });

    expect(result.current.params.trayWidth).toBeGreaterThan(MAX_BUILD_SIZE);
    expect(result.current.isPreviewStale).toBe(true);
  });
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
pnpm exec vitest run src/hooks/useSimpleSteppedLayout.integration.test.ts
```

Expected: FAIL。失败点应是 `trayWidth` 被 Hook-local normalization clamp 到最大构建尺寸。

- [ ] **Step 3: 替换 Hook-local normalization**

在 `src/hooks/useSimpleSteppedLayout.ts` 中，从 `@/lib/simple-stepped-projection` import 列表加入 `normalizeSimpleSteppedParams`：

```ts
import {
  calculateSimpleSteppedMinimumTraySize,
  calculateSimpleSteppedDimensions,
  clampSimpleSteppedSlotUpdates,
  deriveSimpleSteppedLayout,
  getSimpleSteppedEffectiveDiameter,
  mapSimpleSteppedCanvasUpdatesToLocal,
  normalizeSimpleSteppedParams,
  type SimpleSteppedDerivedLayout,
} from "@/lib/simple-stepped-projection";
```

删除这些 Hook-local helper：

```ts
function rebuildRowSlotIds(
  rows: SimpleSteppedRow[],
  slots: SimpleSteppedSlot[],
): SimpleSteppedRow[] {
  return rows.map((row) => ({
    ...row,
    slotIds: slots.filter((slot) => slot.rowId === row.id).map((slot) => slot.id),
  }));
}

function normalizeSimpleSteppedTraySize(
  requestedSize: number,
  minimumSize: number,
  fallbackSize: number,
) {
  const safeRequestedSize =
    Number.isFinite(requestedSize) && requestedSize > 0
      ? requestedSize
      : fallbackSize;

  return Math.min(
    Math.max(safeRequestedSize, minimumSize),
    MAX_TRAY_SIZE,
  );
}
```

删除 `MAX_TRAY_SIZE`、`SimpleSteppedRow`、`SimpleSteppedSlot` 中不再使用的 imports。保留 `CustomLayoutParams`、`FreeSlot`、`SimpleSteppedLayoutParams`。

将 Hook 内部 `normalizeParams` callback 替换为：

```ts
  const normalizeParams = useCallback(
    (next: SimpleSteppedLayoutParams) => normalizeSimpleSteppedParams(next),
    [],
  );
```

如果 `calculateSimpleSteppedMinimumTraySize` 在 Hook 中不再使用，从 import 列表移除它。

- [ ] **Step 4: 运行 Hook 测试确认通过**

Run:

```bash
pnpm exec vitest run src/hooks/useSimpleSteppedLayout.integration.test.ts
```

Expected: PASS。

- [ ] **Step 5: 运行 core 测试防止回归**

Run:

```bash
pnpm exec vitest run src/lib/simple-stepped-projection.test.ts
```

Expected: PASS。

- [ ] **Step 6: 提交 Hook 迁移**

```bash
git add src/hooks/useSimpleSteppedLayout.ts src/hooks/useSimpleSteppedLayout.integration.test.ts
git commit -m "refactor: 运行时复用 simple stepped layout core"
```

## Task 4: 让导入归一化复用 Simple Stepped Layout Core

**Files:**
- Modify: `src/lib/param-normalization.ts`
- Modify: `src/lib/param-normalization.test.ts`
- Test: `src/lib/param-normalization.test.ts`

- [ ] **Step 1: 写导入路径一致性的失败测试**

在 `src/lib/param-normalization.test.ts` 顶部 import 中加入：

```ts
import { MAX_BUILD_SIZE } from "@/lib/config";
```

在 `describe("param normalization", () => { ... })` 内追加测试：

```ts
  it("uses the simple stepped layout core for imported tray size and snapshots", () => {
    const normalized = normalizeParamsForMode("simple-stepped", {
      ...SIMPLE_STEPPED_LAYOUT_DEFAULTS,
      trayWidth: 100,
      trayDepth: 100,
      spacing: 6,
      outerMarginIndependent: false,
      outerMargin: 99,
      rows: [
        { id: "row-1", name: "超宽行", slotIds: ["stale"] },
      ],
      slots: [
        {
          id: "slot-1",
          rowId: "row-1",
          shape: "circle",
          diameter: 100,
          slotDefinitionId: undefined,
          effectiveDiameter: undefined,
          x: -MAX_BUILD_SIZE,
          y: Number.NaN,
        },
        {
          id: "slot-2",
          rowId: "row-1",
          shape: "circle",
          diameter: 100,
          slotDefinitionId: undefined,
          effectiveDiameter: undefined,
          x: MAX_BUILD_SIZE,
          y: 0,
        },
      ],
    } as unknown as SimpleSteppedLayoutParams) as SimpleSteppedLayoutParams;

    expect(normalized.outerMargin).toBe(6);
    expect(normalized.rows[0].slotIds).toEqual(["slot-1", "slot-2"]);
    expect(normalized.trayWidth).toBeGreaterThan(MAX_BUILD_SIZE);
    expect(normalized.slots[0]).toMatchObject({
      y: 0,
      slotDefinitionId: "circle-100",
      effectiveDiameter: 100.4,
    });
    expect(normalized.slots[1]).toMatchObject({
      slotDefinitionId: "circle-100",
      effectiveDiameter: 100.4,
    });
  });
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
pnpm exec vitest run src/lib/param-normalization.test.ts
```

Expected: FAIL。失败点应是 simple stepped import 分支没有完全委托 core，或宽度仍按旧逻辑处理。

- [ ] **Step 3: 修改 simple stepped pipeline 委托**

在 `src/lib/param-normalization.ts` import 中加入：

```ts
import { normalizeSimpleSteppedParams } from "@/lib/simple-stepped-projection";
```

将 `normalizeSimpleSteppedSlotInstances` 替换为只做 slot 必要校验和缺省 rowId 修复，然后调用 core。推荐实现：

```ts
function normalizeSimpleSteppedSlotInstances(
  params: SimpleSteppedLayoutParams,
) {
  const obj = params as unknown as Record<string, unknown>;
  const rows = obj.rows as Record<string, unknown>[];
  const slots = obj.slots as Record<string, unknown>[];
  const rowIds = new Set(rows.map((row) => row.id as string));

  for (let index = 0; index < slots.length; index += 1) {
    const slot = slots[index];
    if (!slot || typeof slot !== "object") {
      throw new Error(`slots[${index}]: 无效的凹槽数据`);
    }
    if (typeof slot.id !== "string" || !slot.id) {
      slot.id = crypto.randomUUID();
    }
    if (slot.shape !== "circle") {
      slot.shape = "circle";
    }
    if (
      typeof slot.rowId !== "string" ||
      !slot.rowId ||
      !rowIds.has(slot.rowId)
    ) {
      slot.rowId = rows[0]?.id ?? "";
    }
    if (
      typeof slot.diameter !== "number" ||
      !Number.isFinite(slot.diameter) ||
      slot.diameter <= 0 ||
      slot.diameter > SIMPLE_STEPPED_LIMITS.diameter.max
    ) {
      throw new Error(
        `slots[${index}].diameter: 超出合理范围 (0, ${SIMPLE_STEPPED_LIMITS.diameter.max}]`,
      );
    }
    if (typeof slot.x !== "number" || !Number.isFinite(slot.x)) {
      throw new Error(`slots[${index}].x: 缺少或无效（需要有限数字）`);
    }
  }

  Object.assign(params, normalizeSimpleSteppedParams(params));
}
```

将 `clampAndFillSimpleSteppedDerivedFields` 简化为只委托 core，避免第二套 row membership 和 tray size 规则：

```ts
function clampAndFillSimpleSteppedDerivedFields(
  params: SimpleSteppedLayoutParams,
) {
  Object.assign(params, normalizeSimpleSteppedParams(params));
}
```

如果 `calculateSimpleSteppedDimensions` 在 `param-normalization.ts` 不再使用，从 import 列表移除它。

- [ ] **Step 4: 运行导入归一化测试确认通过**

Run:

```bash
pnpm exec vitest run src/lib/param-normalization.test.ts
```

Expected: PASS。

- [ ] **Step 5: 运行相关测试确认三条路径一致**

Run:

```bash
pnpm exec vitest run src/lib/simple-stepped-projection.test.ts src/lib/param-normalization.test.ts src/hooks/useSimpleSteppedLayout.integration.test.ts
```

Expected: PASS。

- [ ] **Step 6: 提交导入迁移**

```bash
git add src/lib/param-normalization.ts src/lib/param-normalization.test.ts
git commit -m "refactor: 导入归一化复用 simple stepped layout core"
```

## Task 5: 全量验证与收尾

**Files:**
- Modify: files changed by previous tasks only
- Test: project-level checks

- [ ] **Step 1: 运行类型检查**

Run:

```bash
pnpm run typecheck
```

Expected: PASS with no TypeScript errors.

- [ ] **Step 2: 运行 lint**

Run:

```bash
pnpm run lint
```

Expected: PASS with no ESLint warnings or errors.

- [ ] **Step 3: 运行完整测试**

Run:

```bash
pnpm run test
```

Expected: PASS.

- [ ] **Step 4: 检查最终 diff**

Run:

```bash
git diff --stat
git diff -- src/lib/simple-stepped-projection.ts src/hooks/useSimpleSteppedLayout.ts src/lib/param-normalization.ts src/lib/simple-stepped-projection.test.ts src/lib/param-normalization.test.ts src/hooks/useSimpleSteppedLayout.integration.test.ts
```

Expected: diff 只包含 Simple Stepped Layout Core 归一化迁移和对应测试。

- [ ] **Step 5: 提交收尾修正**

如果 Step 1-4 引入了格式、类型或测试修正，提交这些修正：

```bash
git add src/lib/simple-stepped-projection.ts src/hooks/useSimpleSteppedLayout.ts src/lib/param-normalization.ts src/lib/simple-stepped-projection.test.ts src/lib/param-normalization.test.ts src/hooks/useSimpleSteppedLayout.integration.test.ts
git commit -m "chore: 验证 simple stepped layout core 迁移"
```

如果 Step 1-4 没有产生新 diff，不创建空提交。

## 自检

- Spec 覆盖：Task 1-2 覆盖 Simple Stepped Layout Core 的 Interface 和 Slot Instance Factory 调用；Task 3 覆盖运行时编辑路径；Task 4 覆盖导入和 Draft 加载会经过同一归一化路径；Task 5 覆盖全量验证。
- 占位符扫描：计划不包含待补内容；每个测试和实现步骤都给出具体代码或命令。
- 类型一致性：计划只使用现有类型 `SimpleSteppedLayoutParams`、现有函数 `normalizeSimpleSteppedSlotInstanceSnapshot`、现有 helper `normalizeSimpleSteppedParams` 和现有测试命令。
