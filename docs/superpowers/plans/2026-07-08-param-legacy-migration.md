# Param Legacy Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `src/lib/param-legacy-migration.ts` the single Legacy Param Migration Implementation used by the Param Normalization Pipeline.

**Architecture:** Keep `src/lib/param-normalization.ts` as the pipeline orchestration Module. Move the four legacy migration functions and their migration-only helpers into `src/lib/param-legacy-migration.ts`, import them into the pipeline, and remove the duplicate local Implementations from `param-normalization.ts`.

**Tech Stack:** TypeScript, Vitest, existing Param Normalization Pipeline, existing Slot Instance Factory.

---

## 文件结构

- Modify: `src/lib/param-normalization.test.ts`
  - Adds a regression test that legacy stepped group `splitPartGroupId` is removed through the public `normalizeParamsForMode` Interface.
  - Keeps the test surface on the Param Normalization Pipeline instead of testing the internal migration step directly.
- Modify: `src/lib/param-legacy-migration.ts`
  - Becomes the only Legacy Param Migration Implementation.
  - Exports `migrateGridLegacyShape`, `migrateCustomLegacyShape`, `migrateSimpleSteppedLegacyShape`, and `migrateSteppedLegacyShape`.
  - Owns migration-only helpers: `requireNumber`, raw stepped smoothing/disconnect readers, and `normalizeSteppedGroups`.
  - Must match current behavior from `param-normalization.ts`, including clearing old `splitPartGroupId`.
- Modify: `src/lib/param-normalization.ts`
  - Imports the four migration functions from `src/lib/param-legacy-migration.ts`.
  - Keeps required-field validation, Slot Instance normalization, clamp/fill derived fields, mode dispatch, and pipeline ordering.
  - Removes duplicated legacy migration functions and migration-only helper imports.

## Task 1: 锁定 Legacy Param Migration 行为

**Files:**
- Modify: `src/lib/param-normalization.test.ts`
- Test: `src/lib/param-normalization.test.ts`

- [ ] **Step 1: 加强 splitPartGroupId regression test**

在 `src/lib/param-normalization.test.ts` 中找到 `it("clears stepped split part group targets during normalization", () => {` 开始的测试，把这个测试替换为以下完整内容：

```ts
  it("clears stepped split part group targets during normalization", () => {
    const normalized = normalizeParamsForMode("stepped", {
      trayWidth: 260,
      trayDepth: 260,
      groups: [
        {
          id: "low",
          name: "低组",
          color: "#22c55e",
          bottomHeight: 10,
          useGroupSmoothingRadius: false,
          groupSmoothingRadius: 60,
          useGroupDisconnectDistance: false,
          groupDisconnectDistance: 0,
          splitPartGroupId: "high",
        },
        {
          id: "high",
          name: "高组",
          color: "#3b82f6",
          bottomHeight: 20,
          useGroupSmoothingRadius: false,
          groupSmoothingRadius: 60,
          useGroupDisconnectDistance: false,
          groupDisconnectDistance: 0,
          splitPartGroupId: "high",
        },
        {
          id: "mid",
          name: "中组",
          color: "#f97316",
          bottomHeight: 15,
          useGroupSmoothingRadius: false,
          groupSmoothingRadius: 60,
          useGroupDisconnectDistance: false,
          groupDisconnectDistance: 0,
          splitPartGroupId: "missing",
        },
      ],
      activeGroupId: "low",
      slots: [
        {
          id: "slot-1",
          x: 80,
          y: 90,
          shape: "circle",
          width: 40,
          height: 40,
          rotation: 0,
          groupId: "low",
        },
      ],
      spacing: 5,
      holeDepth: 3,
      splitGrooveDepth: STEPPED_LAYOUT_DEFAULTS.splitGrooveDepth,
      enableSplitRecess: STEPPED_LAYOUT_DEFAULTS.enableSplitRecess,
      splitGrooveType: STEPPED_LAYOUT_DEFAULTS.splitGrooveType,
      enableSplitLocators: STEPPED_LAYOUT_DEFAULTS.enableSplitLocators,
      smoothingRadius: 60,
      disconnectDistance: 0,
      enableBaseHole: false,
      baseHoleSize: "25",
    } as SteppedLayoutParams) as SteppedLayoutParams;

    expect(normalized.groups.map((group) => group.id)).toEqual([
      "low",
      "high",
      "mid",
    ]);
    expect(normalized.groups[0].splitPartGroupId).toBeUndefined();
    expect(normalized.groups[1].splitPartGroupId).toBeUndefined();
    expect(normalized.groups[2].splitPartGroupId).toBeUndefined();
    expect(normalized.slots[0]).toMatchObject({
      groupId: "low",
      slotDefinitionId: "circle-40",
      slotWidth: 40.4,
      slotHeight: 40.4,
    });
  });
```

- [ ] **Step 2: 运行测试确认当前通过**

Run:

```bash
pnpm exec vitest run src/lib/param-normalization.test.ts
```

Expected: PASS。这个测试当前应通过，因为 `param-normalization.ts` 仍有本地 `normalizeSteppedGroups` 清理行为。

- [ ] **Step 3: 提交 regression test**

```bash
git add src/lib/param-normalization.test.ts
git commit -m "test: 锁定 legacy param migration 行为"
```

## Task 2: 同步 param-legacy-migration 到当前行为

**Files:**
- Modify: `src/lib/param-legacy-migration.ts`
- Test: `src/lib/param-normalization.test.ts`

- [ ] **Step 1: 同步 stepped group migration 类型**

在 `src/lib/param-legacy-migration.ts` 的 `migrateSteppedLegacyShape` 中，把 `heightGroupMap` value type 替换为以下结构，加入可清理的旧字段：

```ts
    const heightGroupMap = new Map<
      number,
      {
        id: string;
        name: string;
        color: string;
        bottomHeight: number;
        useGroupSmoothingRadius: boolean;
        groupSmoothingRadius: number;
        useGroupDisconnectDistance: boolean;
        groupDisconnectDistance: number;
        splitPartGroupId?: string;
      }
    >();
```

- [ ] **Step 2: 同步 splitPartGroupId 清理行为**

在 `src/lib/param-legacy-migration.ts` 的 `normalizeSteppedGroups` 函数末尾，也就是 `for (let index = 0; index < groups.length; index += 1) {` 循环结束之后、函数结束之前，加入：

```ts
  for (const group of groups) {
    delete group.splitPartGroupId;
  }
```

最终函数尾部应包含：

```ts
    if (
      typeof group.groupDisconnectDistance !== "number" ||
      !Number.isFinite(group.groupDisconnectDistance)
    ) {
      group.groupDisconnectDistance = rawDisconnectDistance;
    }
  }

  for (const group of groups) {
    delete group.splitPartGroupId;
  }
}
```

- [ ] **Step 3: 运行测试确认仍通过**

Run:

```bash
pnpm exec vitest run src/lib/param-normalization.test.ts
```

Expected: PASS。此时 pipeline 还没接入 `param-legacy-migration.ts`，但同步行为不应破坏现有测试。

- [ ] **Step 4: 提交同步行为**

```bash
git add src/lib/param-legacy-migration.ts
git commit -m "refactor: 同步 legacy migration 行为"
```

## Task 3: 让 Param Normalization Pipeline 使用 Legacy Param Migration

**Files:**
- Modify: `src/lib/param-normalization.ts`
- Test: `src/lib/param-normalization.test.ts`

- [ ] **Step 1: 添加 migration imports**

在 `src/lib/param-normalization.ts` 的 imports 中加入：

```ts
import {
  migrateCustomLegacyShape,
  migrateGridLegacyShape,
  migrateSimpleSteppedLegacyShape,
  migrateSteppedLegacyShape,
} from "@/lib/param-legacy-migration";
```

- [ ] **Step 2: 删除不再需要的 migration-only imports**

从 `src/lib/param-normalization.ts` 中删除这些 imports：

```ts
import {
  GROUP_COLORS,
  STEPPED_LAYOUT_DEFAULTS,
  STEPPED_LIMITS,
} from "@/lib/stepped-config";
import { createGroupStructureOverrides } from "@/lib/stepped-group-params";
```

替换为只保留当前文件仍使用的 imports：

```ts
import {
  STEPPED_LAYOUT_DEFAULTS,
  STEPPED_LIMITS,
} from "@/lib/stepped-config";
```

删除 `createGroupStructureOverrides` import。

- [ ] **Step 3: 删除 param-normalization 内的 migration-only helper functions**

从 `src/lib/param-normalization.ts` 删除以下函数定义：

```ts
function getRawSteppedSmoothingRadius(obj: Record<string, unknown>): number {
  if (
    typeof obj.smoothingRadius === "number" &&
    Number.isFinite(obj.smoothingRadius)
  ) {
    return obj.smoothingRadius;
  }
  if (
    typeof obj.bridgeRadius === "number" &&
    Number.isFinite(obj.bridgeRadius)
  ) {
    return obj.bridgeRadius;
  }
  return STEPPED_LAYOUT_DEFAULTS.smoothingRadius;
}

function getRawSteppedDisconnectDistance(obj: Record<string, unknown>): number {
  if (
    typeof obj.disconnectDistance === "number" &&
    Number.isFinite(obj.disconnectDistance)
  ) {
    return obj.disconnectDistance;
  }
  return STEPPED_LAYOUT_DEFAULTS.disconnectDistance;
}
```

保留这些 helpers 的现有完整实现，不移动到 `param-legacy-migration.ts`：

- `getRawSteppedSplitRecessEnabled`
- `getRawSteppedSplitGrooveType`
- `getRawSteppedSplitLocatorsEnabled`
- `requireNumber`

- [ ] **Step 4: 删除 param-normalization 内的 duplicate migration functions**

从 `src/lib/param-normalization.ts` 删除以下完整函数定义，删除范围从对应 `function` 行开始，到该函数闭合大括号结束：

- `migrateGridLegacyShape`
- `migrateCustomLegacyShape`
- `migrateSimpleSteppedLegacyShape`
- `migrateSteppedLegacyShape`
- `normalizeSteppedGroups`

删除后，`gridParamNormalizationPipeline`、`customParamNormalizationPipeline`、`simpleSteppedParamNormalizationPipeline`、`steppedParamNormalizationPipeline` 应继续引用 import 进来的同名 functions。

- [ ] **Step 5: 运行 typecheck 确认无未使用 import 或缺失 symbol**

Run:

```bash
pnpm run typecheck
```

Expected: PASS。

- [ ] **Step 6: 运行 param normalization 测试**

Run:

```bash
pnpm exec vitest run src/lib/param-normalization.test.ts
```

Expected: PASS。`clears stepped split part group targets during normalization` 必须继续通过，证明 pipeline 已经通过 `param-legacy-migration.ts` 保留该行为。

- [ ] **Step 7: 提交 pipeline 接入**

```bash
git add src/lib/param-normalization.ts
git commit -m "refactor: 接入 legacy param migration"
```

## Task 4: 验证没有重复 Legacy Param Migration Implementation

**Files:**
- Verify: `src/lib/param-normalization.ts`
- Verify: `src/lib/param-legacy-migration.ts`

- [ ] **Step 1: 搜索 migration function 定义**

Run:

```bash
rg -n "function migrate(Grid|Custom|SimpleStepped|Stepped)LegacyShape|function normalizeSteppedGroups|function getRawStepped(SmoothingRadius|DisconnectDistance)" src/lib/param-normalization.ts src/lib/param-legacy-migration.ts
```

Expected: all function definitions should be in `src/lib/param-legacy-migration.ts`; `src/lib/param-normalization.ts` should have no matches for those function definitions.

- [ ] **Step 2: 搜索 param-legacy-migration imports**

Run:

```bash
rg -n "param-legacy-migration|migrateGridLegacyShape|migrateCustomLegacyShape|migrateSimpleSteppedLegacyShape|migrateSteppedLegacyShape" src/lib/param-normalization.ts src/lib/param-legacy-migration.ts
```

Expected:

```text
src/lib/param-normalization.ts:<line>:} from "@/lib/param-legacy-migration";
src/lib/param-normalization.ts:<line>:  migrateLegacyShape: migrateGridLegacyShape,
src/lib/param-normalization.ts:<line>:    migrateLegacyShape: migrateCustomLegacyShape,
src/lib/param-normalization.ts:<line>:    migrateLegacyShape: migrateSimpleSteppedLegacyShape,
src/lib/param-normalization.ts:<line>:    migrateLegacyShape: migrateSteppedLegacyShape,
src/lib/param-legacy-migration.ts:<line>:export function migrateGridLegacyShape(params: TrayParams) {
src/lib/param-legacy-migration.ts:<line>:export function migrateCustomLegacyShape(params: CustomLayoutParams) {
src/lib/param-legacy-migration.ts:<line>:export function migrateSimpleSteppedLegacyShape(params: SimpleSteppedLayoutParams) {
src/lib/param-legacy-migration.ts:<line>:export function migrateSteppedLegacyShape(params: SteppedLayoutParams) {
```

- [ ] **Step 3: 运行聚焦测试和类型检查**

Run:

```bash
pnpm exec vitest run src/lib/param-normalization.test.ts
pnpm run typecheck
```

Expected: both PASS。

- [ ] **Step 4: 提交验证记录**

如果 Task 4 没有代码变化，不需要新 commit。  
如果为了修正本计划文件中的问题产生了代码变化：

```bash
git add src/lib/param-normalization.ts src/lib/param-legacy-migration.ts src/lib/param-normalization.test.ts
git commit -m "chore: 验证 legacy param migration 接入"
```

## Task 5: 全量验证

**Files:**
- Verify only unless tests reveal required fixes.

- [ ] **Step 1: 运行项目测试**

Run:

```bash
pnpm run test
```

Expected: PASS。

- [ ] **Step 2: 运行类型检查**

Run:

```bash
pnpm run typecheck
```

Expected: PASS。

- [ ] **Step 3: 运行 lint**

Run:

```bash
pnpm run lint
```

Expected: PASS or existing unrelated warnings only. If lint reports only pre-existing warnings outside files touched by this plan, record the exact files and do not mix unrelated cleanup into this task.

- [ ] **Step 4: 检查工作区**

Run:

```bash
git status --short
```

Expected: clean working tree after all required commits.

## 自查

- Spec coverage:
  - Legacy Param Migration 作为唯一 Implementation：Task 2、Task 3、Task 4。
  - Param Normalization Pipeline 保留 orchestration：Task 3。
  - `splitPartGroupId` 清理行为：Task 1、Task 2、Task 3。
  - 不移动 split assembly derived-field helpers：Task 3 明确保留。
  - 全量验证：Task 5。
- Placeholder scan:
  - 本计划不包含占位标记或延后实现要求。
  - 每个代码变更步骤都给出目标文件和具体代码片段。
- Type consistency:
  - Public migration function names are `migrateGridLegacyShape`, `migrateCustomLegacyShape`, `migrateSimpleSteppedLegacyShape`, and `migrateSteppedLegacyShape`.
  - Internal helper names remain `getRawSteppedSmoothingRadius`, `getRawSteppedDisconnectDistance`, `normalizeSteppedGroups`, and `requireNumber`.
  - Pipeline field remains `migrateLegacyShape`.
