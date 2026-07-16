# Stepped CAD Profile Generation Seam 实施计划

> **面向自动化执行者：** 必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans`，逐项执行本计划。所有步骤使用 checkbox（`- [ ]`）跟踪。

**目标：** 让 `SteppedCadSplitProfileUnit.layerProfiles` 成为 stepped CAD split body 的唯一 3D extrusion input，删除 tray model 中重复的 male/female body 推导。

**架构：** `stepped-cad-split-profiles.ts` 继续拥有全部 split body 2D 决策；`stepped-cad-tray-model.ts` 用一个只接收 `SteppedCadLayerProfilePlan[]` 的 helper 挤出并 union body。Locator Pin、slot holes、base holes、split unit ownership 和 metadata 继续留在 tray model 后处理。

**技术栈：** TypeScript、JSCAD、Vitest、ESLint。

---

## 文件结构

- 修改 `src/lib/stepped-cad-split-profiles.test.ts`
  - 加强 profile plan 的 layer contract characterization，锁定 recess-shell、tenon 和 suppressed interface 行为。
- 修改 `src/lib/stepped-cad-tray-model.ts`
  - 新增 `buildBodyFromLayerProfiles()`。
  - 让 `createSteppedCadSplitParts()` 只用 `profileUnit.layerProfiles` 构造 split body。
  - 删除旧 interface body path 及仅由它使用的 helper、type、constant 和 import。
- 验证 `src/lib/stepped-cad-tray-model.test.ts`
  - 覆盖 part ownership、holes、profile/inset groove、Locator Pin 和 positive geometry。
- 验证 `src/lib/stepped-cad-user-repro.test.ts`
  - 覆盖代表性 fixture、coplanar fragments、vertical face count 和 upper tab footprint。

### 任务 1：锁定 Split Profile Plan 的 final layer contract

**文件：**
- 修改：`src/lib/stepped-cad-split-profiles.test.ts`

- [x] **步骤 1：加强 empty inset 的 suppressed layer 断言**

在测试 `suppresses inset recess interfaces when the upper contact outline vanishes after inset` 中，紧接现有 `plan.issues` 断言后加入：

```ts
const lowerUnit = plan.units.find((unit) => unit.baseHeight === 0);
const upperUnit = plan.units.find((unit) => unit.baseHeight === 10);

expect(
  lowerUnit?.layerProfiles.some(
    (layer) => layer.kind === "recess-shell-band",
  ),
).toBe(false);
expect(
  upperUnit?.layerProfiles.some((layer) => layer.kind === "tenon-band"),
).toBe(false);
```

这锁定 suppressed **Split Interface Profile** 不会泄漏到 final body layers。

- [x] **步骤 2：加强 two-height fixture 的 tenon band 断言**

在测试 `keeps the two-height recess lower shell as one planned shell band` 中，将 unit 查询改为：

```ts
const lowUnit = plan.units.find((unit) =>
  unit.groupIds.includes("9424be58-80a2-4faf-b54d-b447aede6cb7"),
);
const highUnit = plan.units.find((unit) =>
  unit.groupIds.includes("stepped-default-group"),
);
```

保留现有 low unit 断言，并在其后加入：

```ts
expect(highUnit).toBeDefined();
expect(highUnit?.layerProfiles).toEqual(
  expect.arrayContaining([
    expect.objectContaining({
      kind: "tenon-band",
      fromHeight: 18,
      toHeight: 20,
      interfaceHeight: 20,
    }),
    expect.objectContaining({
      kind: "body-band",
      fromHeight: 20,
      toHeight: 31,
    }),
  ]),
);
```

- [x] **步骤 3：运行 profile plan characterization**

运行：

```bash
./node_modules/.bin/vitest run src/lib/stepped-cad-split-profiles.test.ts
```

预期：PASS，3 tests passed。这里是行为保持重构的 characterization，不要求先出现行为 RED。

- [x] **步骤 4：提交 profile plan contract**

```bash
git add src/lib/stepped-cad-split-profiles.test.ts
git commit -m "test: 锁定 stepped cad final layer profiles"
```

### 任务 2：把 `layerProfiles` 接成实际 generation Seam

**文件：**
- 修改：`src/lib/stepped-cad-tray-model.ts`
- 验证：`src/lib/stepped-cad-split-profiles.test.ts`
- 验证：`src/lib/stepped-cad-tray-model.test.ts`
- 验证：`src/lib/stepped-cad-user-repro.test.ts`

- [x] **步骤 1：运行 architecture RED 并确认旧 path 仍存在**

运行：

```bash
rg -n "buildBodyFromInterfaceProfiles|buildSplitUnitBody|buildInterfacePocketMap|buildInterfaceRecessMap|maleFootprint|femaleFootprint" src/lib/stepped-cad-tray-model.ts
```

预期：命中 `buildBodyFromInterfaceProfiles` 定义与调用、未使用的 `buildSplitUnitBody`、旧 pocket/recess helpers 以及 male/female footprint 读取。这是本轮 architecture RED。

- [x] **步骤 2：收窄 imports、constants 与 local types**

把 `src/lib/stepped-cad-tray-model.ts` 顶部 JSCAD import 改为：

```ts
import {
  booleans,
  extrusions,
  geometries,
  measurements,
  primitives,
  transforms,
} from "@jscad/modeling";
```

删除：

```ts
import { insetGeom2 } from "@/lib/outline-geometry";
```

把 split profile import 改为：

```ts
import {
  buildSteppedCadSplitProfilePlan,
  type SteppedCadLayerProfilePlan,
} from "@/lib/stepped-cad-split-profiles";
```

把 params type import 改为：

```ts
import type { SteppedLayoutParams } from "@/types/custom-tray";
```

删除 destructuring：

```ts
const { offset } = expansions;
```

删除以下 constants：

```ts
const DEFAULT_INTERFACE_GROOVE_INSET = 1;
const INSET_INTERFACE_GROOVE_INSET = 1;
const DEFAULT_INTERFACE_CLEARANCE = 0.1;
```

保留 `INTERFACE_FOOTPRINT_SEGMENTS`，因为 Locator Pin footprint 仍使用它。

删除 local types：

```ts
type InterfacePocket = {
  interfaceHeight: number;
  depth: number;
  footprint: Geom2;
};
```

`PartitionedGroupFootprint` 必须保留，因为 Locator Pin contact clipping 仍通过 `buildSupportFootprint()` 使用它。

- [x] **步骤 3：新增只消费 layer plan 的 body builder**

在 `buildSolidFromFootprint()` 后加入：

```ts
function buildBodyFromLayerProfiles(
  layerProfiles: SteppedCadLayerProfilePlan[],
) {
  const bodySolids = layerProfiles
    .map((layer) =>
      buildSolidFromFootprint(
        layer.footprint,
        layer.fromHeight,
        layer.toHeight,
      ),
    )
    .filter((item): item is Geom3 => item !== null);

  if (bodySolids.length === 0) {
    return null;
  }

  return bodySolids.length === 1
    ? bodySolids[0]
    : (union(...bodySolids) as Geom3);
}
```

该 helper 不读取 `kind`、interface depth、partitions、groove type 或 params。

- [x] **步骤 4：让 split generation 使用 `profileUnit.layerProfiles`**

在 `createSteppedCadSplitParts()` 的 `flatMap` 中，保留 `splitUnitBaseHeight` 和 `profileUnit` 查询，把：

```ts
let body = buildBodyFromInterfaceProfiles(
  splitUnit,
  splitUnitBaseHeight,
  partitions,
  profileUnit.interfaceProfiles,
);
```

替换为：

```ts
let body = buildBodyFromLayerProfiles(profileUnit.layerProfiles);
```

不要修改随后的 Locator Pin、slot holes、base holes、cleanup、volume validation 和 metadata 代码。

- [x] **步骤 5：删除旧 body derivation Implementation**

从 `src/lib/stepped-cad-tray-model.ts` 完整删除以下函数：

```ts
buildBodyFromInterfaceProfiles
buildUnifiedSplitUnitBaseFootprint
buildInterfaceSupportFootprint
insetInterfaceFootprint
buildSplitGrooveMaleFootprint
offsetInterfaceFootprint
buildInterfacePocketMap
buildInterfaceRecessMap
buildSplitUnitBody
```

不要删除以下仍服务 Locator Pin 或 part ownership 的函数：

```ts
getPartitionedGroupFootprints
buildSupportFootprint
resolveSplitAssemblyMode
buildInterfaceLocatorMap
selectInterfaceLocatorPoints
filterLocatorPointsOnFootprint
buildLocatorBandSolids
buildLocatorSolid
```

- [x] **步骤 6：收窄 assembly mode return**

将 `resolveSplitAssemblyMode()` 替换为：

```ts
function resolveSplitAssemblyMode(params: SteppedLayoutParams) {
  return {
    enableRecess:
      params.enableSplitRecess === true ||
      params.splitAssemblyMode === "locator-recess",
    enableLocators:
      params.enableSplitLocators === true ||
      params.splitAssemblyMode === "locator-recess",
  };
}
```

groove type 只由 split profile Module 解释，tray model 不再拥有该规则。

- [x] **步骤 7：运行聚焦 geometry regression**

运行：

```bash
./node_modules/.bin/vitest run src/lib/stepped-cad-split-profiles.test.ts src/lib/stepped-cad-tray-model.test.ts src/lib/stepped-cad-user-repro.test.ts
```

预期：PASS，3 test files、20 tests passed。

关键覆盖：

- profile/inset recess 的 volume 与 lower/upper Z extents。
- merged split unit 的 part ownership。
- Locator Pin pins/sockets。
- slot holes 与 base holes。
- two-height fixture 的 horizontal/vertical face thresholds。
- downloaded fixture 的 full-outline upper tab。

- [x] **步骤 8：运行 TypeScript 与目标 ESLint**

运行：

```bash
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/eslint src/lib/stepped-cad-tray-model.ts src/lib/stepped-cad-split-profiles.test.ts src/lib/stepped-cad-tray-model.test.ts src/lib/stepped-cad-user-repro.test.ts --max-warnings=0
```

预期：两条命令都退出 0。原 `buildSplitUnitBody` unused warning 消失。

- [x] **步骤 9：运行 architecture GREEN**

运行：

```bash
rg -n "buildBodyFromInterfaceProfiles|buildSplitUnitBody|buildInterfacePocketMap|buildInterfaceRecessMap|maleFootprint|femaleFootprint" src/lib/stepped-cad-tray-model.ts
```

预期：无输出。

运行：

```bash
rg -n "buildBodyFromLayerProfiles|profileUnit\\.layerProfiles" src/lib/stepped-cad-tray-model.ts
```

预期：命中 `buildBodyFromLayerProfiles` 定义、函数内 layer extrusion 和 `profileUnit.layerProfiles` 调用。

- [x] **步骤 10：提交 generation Seam**

```bash
git add src/lib/stepped-cad-tray-model.ts
git commit -m "refactor: 以 layer profiles 生成 stepped cad split body"
```

### 任务 3：完整验证与范围审计

**文件：**
- 检查：`src/lib/stepped-cad-split-profiles.ts`
- 检查：`src/lib/stepped-cad-tray-model.ts`
- 检查：相关测试与文档

- [x] **步骤 1：运行完整 unit Vitest**

运行：

```bash
./node_modules/.bin/vitest run
```

预期：68 test files、329 tests passed。

- [x] **步骤 2：运行 integration Vitest**

运行：

```bash
./node_modules/.bin/vitest run --config vitest.integration.config.ts
```

预期：5 test files、27 tests passed。JSDOM 可能输出既有 `Not implemented: navigation to another Document` 提示，但退出码必须为 0。

- [x] **步骤 3：运行 TypeScript**

运行：

```bash
./node_modules/.bin/tsc --noEmit
```

预期：无输出，退出码 0。

- [x] **步骤 4：运行全量 ESLint**

运行：

```bash
./node_modules/.bin/eslint src --max-warnings=0
```

预期：本轮不新增 warning；`buildSplitUnitBody` 的既有 warning 消失。若命令仍因其他既有 warning 退出非 0，应准确记录剩余文件、规则和数量，不报告为通过。

- [x] **步骤 5：审计 Split Interface Profile ownership**

运行：

```bash
rg -n "buildSplitGrooveMaleFootprint|offsetInterfaceFootprint|insetInterfaceFootprint|maleFootprint|femaleFootprint" src/lib/stepped-cad-tray-model.ts
```

预期：无输出。

运行：

```bash
rg -n "maleFootprint|femaleFootprint|buildUnitLayerProfiles|layerProfiles" src/lib/stepped-cad-split-profiles.ts
```

预期：male/female derivation 与 final layer planning 只在 split profile Module 中命中。

- [x] **步骤 6：检查 diff、工作区与提交历史**

运行：

```bash
git diff --check
git status --short
git log -5 --oneline
```

预期：`git diff --check` 和 `git status --short` 无输出；最新提交依次包含 profile layer contract 与 generation Seam。用户原有修改如存在必须保留并单独报告。

- [x] **步骤 7：必要时提交验证修正**

只有完整验证暴露并修复了遗漏时，暂存本候选涉及的精确文件：

```bash
git add src/lib/stepped-cad-split-profiles.test.ts src/lib/stepped-cad-tray-model.ts src/lib/stepped-cad-tray-model.test.ts src/lib/stepped-cad-user-repro.test.ts
git commit -m "test: 完成 stepped cad profile generation 验证"
```

若无额外修正，不创建空提交。

本次完整验证未发现代码遗漏，因此没有创建验证修正提交；仅提交本计划的完成记录。当前验证结果为：单元测试 90 个文件、453 个测试通过；集成测试 5 个文件、30 个测试通过；TypeScript 与全量 ESLint 均通过。ownership 审计确认 tray model 只消费 `profileUnit.layerProfiles` 构造主体，male/female footprint 的推导与 layer planning 仅存在于 split profile Module。
