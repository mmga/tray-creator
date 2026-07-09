# Stepped CAD Profile Generation Seam 设计

## 目标

让 `buildSteppedCadSplitProfilePlan()` 生成的 `layerProfiles` 成为 stepped CAD split body 的实际 generation Seam，消除 `stepped-cad-tray-model.ts` 对 contact、male 和 female footprint 的第二次推导。

本轮只改变 split body 的内部构造路径。Locator Pin、slot holes、base holes、split unit metadata、导出格式和用户参数保持不变。

## 领域决策

- **Split Interface Profile** 是 stepped CAD split body 使用的 male/female footprint 唯一来源。
- split profile plan 把 **Split Interface Profile** 投影成最终 body、recess-shell 和 tenon 2D bands。
- tray model 只能挤出并组合这些 bands，不能根据 partitions、groove type 或 interface heights 再推导 pocket、recess 或 tab geometry。
- Locator Pin 是局部后处理，不改变 **Split Interface Profile** 的 outline semantics。
- slot holes 与 base holes 在 profile-derived body 完成后应用。

这些关系已记录在 `CONTEXT.md`。

## 当前断点

`src/lib/stepped-cad-split-profiles.ts` 已经提供：

- `SteppedCadSplitInterfaceProfile`
  - contact footprint
  - male footprint
  - female footprint
  - male/female depth
  - active 或 suppressed state
- `SteppedCadLayerProfilePlan`
  - `body-band`
  - `recess-shell-band`
  - `tenon-band`
- `SteppedCadSplitProfileUnit`
  - unit identity
  - base/top height
  - interface profiles
  - final layer profiles

但是 `createSteppedCadSplitParts()` 当前只读取 `interfaceProfiles`，然后由 `buildBodyFromInterfaceProfiles()` 再次：

- 根据 split unit 与 partitions 构造 body solids。
- 根据 female footprint 创建 3D cutter 并 subtract。
- 根据 male footprint 创建 3D tab 并 union。

同一文件还保留未使用的 `buildSplitUnitBody()` 及其 pocket/recess/tab 推导 helper。结果是 profile plan 虽然存在，却不是实际 generation Seam；要判断最终几何必须同时阅读 profile Module 和 tray model 中第二套规则。

## 方案比较

### 方案一：直接挤出 `layerProfiles`

新增一个窄 body builder，只接收 `SteppedCadLayerProfilePlan[]`：

1. 跳过无有效高度或空 footprint 的 layer。
2. 把每个 layer 从 `fromHeight` 挤出到 `toHeight`。
3. union 所有有效 layer solids。
4. 返回完整 split body，后续再应用 Locator Pin 与 holes。

优点：

- profile plan 成为唯一 body geometry contract。
- tray model 不再理解 recess/tenon outline 规则。
- 可以删除大量重复 helper 和未使用路径。
- 现有 holes、Locator Pin 与 metadata 流程无需重写。

缺点：

- 会改变 body CSG 的构造顺序，需要几何 regression 覆盖。
- 相邻 layer 的 union 仍需要现有 cleanup 处理。

### 方案二：新旧 body 双算并比较

同时执行旧 body path 和 layer profile path，通过 volume、bounds 或 polygon count 选择结果。

优点是可以观察迁移差异；缺点是保留两套权威 Implementation，而且 volume/bounds 相同不能证明 interface face topology 正确。它增加运行成本，也让 Seam 更模糊。

### 方案三：profile plan 拥有全部 split generation

把 split unit partition、slot/base holes、Locator Pin 和导出 metadata 全部搬入 profile plan。

它能形成更大的统一 Module，但会把局部 body Seam 改造扩大为 split generation 重写。Locator Pin 和 holes 并不需要参与 male/female profile 推导，本轮迁移它们没有足够收益。

## 选定方案

采用方案一。

`stepped-cad-split-profiles.ts` 继续拥有 split body 的全部 2D 决策；`stepped-cad-tray-model.ts` 只把 plan 机械地转换为 3D，并拥有无法自然表达为完整 planar bands 的 Locator Pin 和 holes 后处理。

## Module 与 Interface

### Split Profile Module

保留现有 public Interface：

```ts
buildSteppedCadSplitProfilePlan(request): SteppedCadSplitProfilePlan
```

其中每个 `SteppedCadSplitProfileUnit.layerProfiles` 是该 unit 的最终 body extrusion input。

`SteppedCadLayerProfilePlan` 保持：

```ts
interface SteppedCadLayerProfilePlan {
  kind: "body-band" | "recess-shell-band" | "tenon-band";
  fromHeight: number;
  toHeight: number;
  footprint: Geom2;
  interfaceHeight?: number;
}
```

本轮不扩展 plan 以携带 holes、Locator Pin 或 export labels。

### Tray Model

新增内部 Deep helper，命名为：

```ts
buildBodyFromLayerProfiles(layerProfiles)
```

该 helper：

- 只依赖 `SteppedCadLayerProfilePlan[]`。
- 不接收 split unit、partitions、assembly mode、groove type 或 groove depth。
- 不检查 `kind` 后重新解释语义；所有 kind 都按明确的 height range 与 footprint 挤出。
- 对所有有效 solids 执行一次 union。
- 没有有效 solid 时返回 `null`。

`createSteppedCadSplitParts()` 通过 `unitKey` 取得 profile unit，并把 `profileUnit.layerProfiles` 交给该 helper。

### 保留的现有结构

tray model 继续构造现有 split units 与 partitions，因为以下后处理仍需要它们：

- slot/base hole ownership。
- Locator Pin point selection 与 contact clipping。
- part labels、height range 和 export metadata。

这是一条明确的过渡边界：split units 提供 part ownership；profile plan 提供 body geometry。

## 数据流

1. `buildSteppedCadFeatureGraph(params)` 生成 group footprints、heights 和 holes。
2. `buildSteppedCadSplitProfilePlan({ graph, params })`：
   - partition split units。
   - 推导 **Split Interface Profile**。
   - 生成每个 unit 的 final `layerProfiles`。
3. `createSteppedCadSplitParts()` 按 `unitKey` 配对现有 split unit 与 profile unit。
4. `buildBodyFromLayerProfiles(profileUnit.layerProfiles)` 挤出并 union split body。
5. tray model 应用 Locator Pin pins/sockets。
6. tray model subtract slot holes 与 base holes。
7. tray model cleanup、orient、volume validation 并生成 part metadata。

body generation 不再读取 `profileUnit.interfaceProfiles`。Locator Pin 后处理可以读取 interface depth/state 来确定 pin/socket vertical placement，但不得读取 male/female footprint 重新构造主体 groove。

## 删除重复 Implementation

完成切换后删除：

- `buildBodyFromInterfaceProfiles`
- 未使用的 `buildSplitUnitBody`
- 仅被旧 body path 使用的 pocket/recess/tab map helpers
- 仅被这些 helper 使用的 male/female offset/inset constants 与 geometry helpers

保留：

- `buildSolidFromFootprint`
- `buildInterfaceLocatorMap`
- Locator Pin point、band 和 clearance helpers
- Locator Pin 仍依赖的 support footprint/partition helpers
- split unit、partition、hole 和 metadata helpers

删除范围由 TypeScript、ESLint 和 `rg` 引用审计确认，不凭函数所在代码块批量删除。

## 几何与错误处理

### Layer extrusion

- `toHeight <= fromHeight` 的 layer 不产生 solid。
- 空 footprint 不产生 solid。
- 单个 layer 挤出异常沿用 `buildSolidFromFootprint()` 的 `null` 语义。
- 至少一个有效 solid 时生成 body；全部无效时该 split part 被跳过。

### Profile issues

- `suppressed-empty-inset` 与 `suppressed-empty-clip` 已由 profile Module 反映到 `layerProfiles`。
- tray model 不重试、不回退到旧 3D recess/tab path。
- `SteppedCadSplitProfilePlan.issues` 本轮继续用于测试与诊断，不新增用户提示或 worker contract。

### Final validation

- Locator Pin 与 holes 应用失败的现有行为不变。
- cleanup 与 positive-volume orientation 顺序不变。
- 最终绝对 volume 小于等于 `MIN_VALID_VOLUME` 时继续跳过 part。
- 不保留 runtime feature flag 回退到旧 body path。

## 测试

### Profile plan tests

保留并扩展 `src/lib/stepped-cad-split-profiles.test.ts`：

- two-height recess fixture 生成 body band 与单一 recess-shell band。
- upper unit 生成 tenon band。
- inset 后为空时不生成 recess-shell/tenon band。
- merged groups 仍映射到同一个 profile unit。

### Tray model generation tests

扩展 `src/lib/stepped-cad-tray-model.test.ts` 或现有 user repro tests：

- two-height recess 的实际 split body 来自 planned shell/tenon bands。
- profile recess 与 inset recess 均保持 part 数、height range、positive volume 和预期 fit 差异。
- Locator Pin 开启后 pins/sockets 仍改变 geometry，但不改变 profile footprint contract。
- slot holes 与 base holes 仍被应用。
- merged split units 保持 labels 与 part ownership。
- 代表性 fixture 的 coplanar face fragmentation 不回退。

测试应验证公开 `createSteppedCadSplitParts()` 结果与几何性质，不通过 mock profile builder 断言内部调用。

### 边界审计

生产代码完成后：

- tray model 不再引用 `maleFootprint` 或 `femaleFootprint` 构造 body。
- `buildBodyFromInterfaceProfiles` 与 `buildSplitUnitBody` 不存在。
- `profileUnit.layerProfiles` 是 `createSteppedCadSplitParts()` 的 body input。
- `buildSteppedCadSplitProfilePlan` 仍是唯一 profile derivation entry。

## 兼容性

本轮不改变：

- `SteppedLayoutParams`。
- 参数文件或 Draft schema/version。
- worker request/response。
- split part filename、label 或 manifest。
- public model service Interface。
- groove、clearance、Locator Pin 参数。

无需数据迁移。

## 回滚边界

回滚范围限制在：

- `src/lib/stepped-cad-tray-model.ts`
- `src/lib/stepped-cad-split-profiles.test.ts`
- `src/lib/stepped-cad-tray-model.test.ts`
- 必要的 geometry regression fixture/tests
- `CONTEXT.md`

如 layer extrusion 暴露不可接受的几何回归，可恢复 `buildBodyFromInterfaceProfiles()` 调用和相关 helper；不需要回滚参数、worker、导出或候选 2 的 CAD orchestration 重构。

## 非目标

- 不调整 **Profile Recess** 或 **Inset Recess** 语义。
- 不调整 assembly clearance、inset distance 或 groove depth。
- 不迁移 Locator Pin 为 planar profile。
- 不修改 split merge 规则。
- 不改变 holes、metadata、文件名或下载行为。
- 不保留新旧 body path 的 runtime 双轨。
