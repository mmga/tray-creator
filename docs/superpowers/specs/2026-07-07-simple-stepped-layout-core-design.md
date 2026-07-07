# Simple Stepped Layout Core 设计

## 目标

深化 `simple-stepped` 编辑 Module，让导入、Draft 加载、运行时编辑都经过同一个权威的 Simple Stepped Layout Core 归一化路径。

这次调整要移除 Hook 和导入归一化里的重复规则，同时保留 Hook 层对交互副作用的 ownership。

## 领域决策

- Simple Stepped Layout Core 拥有 `simple-stepped` Mode 的 row/slot 关系修复、托盘尺寸归一化、outer margin 同步，以及 canvas update 到 row-local slot update 的投影。
- 导入、Draft 加载、运行时编辑得到的 simple stepped params 都应该经过同一套 Simple Stepped Layout Core 归一化规则。
- 在 simple stepped Mode 中，最大构建尺寸是用户提示阈值，不是硬归一化上限。
- 当 row 和 slot 内容要求更大尺寸时，Simple Stepped Layout Core 可以允许派生托盘尺寸超过最大构建尺寸。
- Simple Stepped Layout Core 修复 simple stepped Slot Geometry Snapshot 时必须调用 Slot Instance Factory，不直接拥有 Slot Definition 匹配规则。

这些决策已记录在 `CONTEXT.md`。

## 当前摩擦

simple stepped 规则目前分散在多个文件中：

- `src/hooks/useSimpleSteppedLayout.ts`
  - 重建 row membership。
  - 归一化 `slot.y`。
  - 同步 `outerMargin`。
  - 在运行时编辑中处理托盘尺寸限制。
  - 拥有 undo history、preview invalidation 等交互副作用。
- `src/lib/simple-stepped-projection.ts`
  - 已经暴露 `normalizeSimpleSteppedParams`。
  - 已经允许内容所需尺寸超过 `MAX_BUILD_SIZE`。
  - 负责把 canvas update 投影回 row-local slot update。
- `src/lib/param-normalization.ts`
  - 修复导入的 simple stepped rows 和 slots。
  - 调用 Slot Instance Factory 修复 simple stepped snapshots。
  - 重建 `row.slotIds`。
  - 导入后计算托盘尺寸。

这削弱了 locality：一个 simple stepped 不变量变化时，需要同时检查多个文件。也削弱了 leverage：即使意图是同一个不变量，测试仍要分别覆盖导入路径和运行时编辑路径。

## 选定方案

使用 `src/lib/simple-stepped-projection.ts` 作为 Simple Stepped Layout Core 的 Implementation 位置。

这个文件已经是 simple stepped derived layout、托盘尺寸归一化、canvas update projection 的共享位置。深化它可以避免新增 Module，同时保持 Interface 小且贴近现有调用点。

## 模块形状

Simple Stepped Layout Core 暴露：

- `normalizeSimpleSteppedParams(params)`
  - 根据 slot 的实际 `rowId` 修复 `row.slotIds`。
  - 确保 slot `y` 是有限数字。
  - 当 `outerMarginIndependent` 为 false 时同步 `outerMargin`。
  - 确保 tray width/depth 至少满足内容所需最小尺寸。
  - 当内容所需最小尺寸超过 `MAX_BUILD_SIZE` 时，允许 tray width/depth 超过 `MAX_BUILD_SIZE`。
  - 调用 Slot Instance Factory 修复 simple stepped Slot Geometry Snapshot。
- 从 `simple-stepped-layout` 重新导出的现有 derived layout 函数。
- 现有 canvas projection helper，例如 `mapSimpleSteppedCanvasUpdatesToLocal`。

本轮 Interface 保持为普通函数。不新增 class、registry 或 TypeScript interface。

## 数据流

导入和 Draft 加载：

1. `param-io` 解析文件并检查 Mode。
2. `param-normalization` 处理 wrapper、version 和必需 legacy shape migration。
3. simple stepped 分支把 runtime-shape repair 委托给 `normalizeSimpleSteppedParams`。
4. 归一化后的 params 进入 Mode Workspace 或 Draft hook。

运行时编辑：

1. `useSimpleSteppedLayout` 收到本地编辑命令。
2. Hook 应用本地 mutation，并调用 `normalizeSimpleSteppedParams`。
3. Hook 处理 undo history 和 preview invalidation。
4. derived layout 和 viewport projection 消费归一化后的 params。

Canvas 编辑：

1. `LayoutCanvas` 发出 canvas-space slot updates。
2. Simple Stepped Layout Core 把这些 updates 投影成 row-local slot updates。
3. `useSimpleSteppedLayout` 应用 updates，并经过同一个 core function 归一化。

## 职责分配

Simple Stepped Layout Core 拥有：

- simple stepped row membership repair。
- simple stepped tray size normalization。
- simple stepped outer margin synchronization。
- canvas-to-row slot update projection。
- 归一化 simple stepped slots 时调用 Slot Instance Factory。

Simple Stepped Layout Core 不拥有：

- Slot Definition 匹配规则。
- Slot Geometry Snapshot 字段语义，除了调用 Slot Instance Factory。
- undo history。
- preview invalidation。
- active row UI state。
- worker preview/export。
- Draft binding。

## 错误处理

导入路径保留现有校验行为：

- 无效的必需数字字段仍由 `param-normalization` 抛错。
- 无效的 simple stepped slot diameter 或 `x` 仍在 simple stepped 归一化期间抛错。
- 缺失 rows 或 slots 时，在可保守修复的情况下继续修复。
- 缺失或无效 `rowId` 的 slots 会分配给第一个可用 row，保持当前导入行为。

运行时编辑应继续避免普通 UI 操作抛错。Hook 只在从可信 UI 操作构造 params 后调用 core。

## 测试

新增或更新聚焦测试：

- `src/lib/simple-stepped-projection.test.ts`
  - 归一化会根据 slots 重建 `row.slotIds`。
  - `outerMarginIndependent` 为 false 时会同步 `outerMargin`。
  - 当内容要求超过 `MAX_BUILD_SIZE` 时，归一化允许托盘尺寸超过该阈值。
  - 归一化通过 Slot Instance Factory 修复 simple stepped Slot Geometry Snapshot。
- `src/lib/param-normalization.test.ts`
  - simple stepped 导入路径复用同一套归一化行为。
  - 导入 params 会修复 row membership 和 snapshots。
- `src/hooks/useSimpleSteppedLayout.integration.test.ts`
  - 运行时编辑仍会让 preview stale，并保持现有编辑行为。
  - Hook 不再拥有分叉的托盘尺寸归一化规则。

最重要的测试 surface 是 Simple Stepped Layout Core 的 Interface。Hook integration tests 只验证 orchestration 和副作用，不重复覆盖每个归一化不变量。

## 迁移计划

这是内部重构，不需要修改导出参数文件版本。

现有保存的 Draft 和导入文件保持兼容，因为导入路径仍经过 `param-normalization`；simple stepped 分支只是把更多修复工作委托给 Simple Stepped Layout Core。

## 回滚边界

回滚范围限制在：

- `src/lib/simple-stepped-projection.ts`
- `src/hooks/useSimpleSteppedLayout.ts`
- `src/lib/param-normalization.ts`
- 相关测试
- `CONTEXT.md`

如果重构带来非预期行为，可以恢复 Hook-local normalization 和 param-normalization 的 simple stepped 分支，不需要改变存储格式或公开参数文件版本。
