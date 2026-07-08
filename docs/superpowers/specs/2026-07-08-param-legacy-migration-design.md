# Param Legacy Migration 设计

## 目标

深化 **Param Normalization Pipeline**，让 **Legacy Param Migration** 成为唯一的 legacy shape repair Implementation。

本次调整要消除 `src/lib/param-normalization.ts` 和 `src/lib/param-legacy-migration.ts` 之间的重复规则。`param-normalization.ts` 保留 pipeline orchestration、required-field validation、Slot Instance normalization、derived-field clamp/fill；`param-legacy-migration.ts` 负责 grid、custom、simple stepped、stepped 的旧参数形状迁移。

## 领域决策

- **Legacy Param Migration** 是 **Param Normalization Pipeline** 内部的 compatibility step。
- **Legacy Param Migration** 在 required-field validation 之后运行，在 Slot Instance normalization 和 derived-field clamp/fill 之前运行。
- **Legacy Param Migration** 拥有旧参数形状修复，不拥有 Slot Definition 匹配、Slot Geometry Snapshot 修复、字段 clamp 或 UI side effects。
- **Param Normalization Pipeline** 继续通过 **Slot Instance Factory** 修复 Slot Geometry Snapshot。

这些决策已记录在 `CONTEXT.md`。

## 当前摩擦

`src/lib/param-legacy-migration.ts` 已经存在，并且文件注释说明它从 `param-normalization.ts` 提取 legacy migration step，但当前没有任何调用点 import 它。

同时，`src/lib/param-normalization.ts` 仍然定义同名 migration functions：

- `migrateGridLegacyShape`
- `migrateCustomLegacyShape`
- `migrateSimpleSteppedLegacyShape`
- `migrateSteppedLegacyShape`
- `normalizeSteppedGroups`
- `getRawSteppedSmoothingRadius`
- `getRawSteppedDisconnectDistance`

这造成两个问题：

- locality 弱：legacy 规则名义上被提取，但实际修改仍发生在 normalization 主文件。
- 行为分叉风险：`param-legacy-migration.ts` 已经落后于当前 `param-normalization.ts`，例如 stepped groups 里的旧 `splitPartGroupId` 清理只存在于当前 normalization 主文件。

## 选定方案

保留并接入 `src/lib/param-legacy-migration.ts`，让它成为 **Legacy Param Migration** 的唯一 Implementation。

这不是新增抽象，而是完成已经开始的提取：现有 `ParamNormalizationPipeline` 仍以 `migrateLegacyShape` 作为其中一个 step，调用点只需要从 `param-legacy-migration.ts` import 对应 functions。

## 模块形状

`src/lib/param-legacy-migration.ts` 导出：

- `migrateGridLegacyShape(params: TrayParams): void`
- `migrateCustomLegacyShape(params: CustomLayoutParams): void`
- `migrateSimpleSteppedLegacyShape(params: SimpleSteppedLayoutParams): void`
- `migrateSteppedLegacyShape(params: SteppedLayoutParams): void`

它内部可以保留 private helpers：

- `requireNumber`
- `getRawSteppedSmoothingRadius`
- `getRawSteppedDisconnectDistance`
- `normalizeSteppedGroups`

`src/lib/param-normalization.ts` 不再定义这些 migration functions。它只 import 4 个 public migration functions，并继续把它们挂到对应 `ParamNormalizationPipeline`。

本轮不移动这些 non-legacy helpers：

- `getRawSteppedSplitRecessEnabled`
- `getRawSteppedSplitGrooveType`
- `getRawSteppedSplitLocatorsEnabled`

它们服务 stepped derived-field compatibility 和 clamp/fill，不是本轮 legacy migration 提取的必要范围。

## 数据流

导入和 Draft 加载：

1. `param-io` 解析文件并识别 Mode。
2. `normalizeParamsForMode` 选择对应 **Param Normalization Pipeline**。
3. Pipeline 校验必需字段。
4. Pipeline 调用 **Legacy Param Migration** 修复旧参数形状。
5. Pipeline 调用 Slot Instance normalization，并通过 **Slot Instance Factory** 修复 Slot Geometry Snapshot。
6. Pipeline clamp/fill derived fields。
7. 归一化后的 params 进入 runtime editor。

custom 到 stepped migration：

1. `migrateCustomParamsToStepped` 先运行 custom pipeline。
2. 构造 stepped params。
3. 运行 stepped pipeline。
4. stepped pipeline 继续使用同一个 `migrateSteppedLegacyShape`，保持导入和转换路径一致。

## 职责分配

**Legacy Param Migration** 拥有：

- grid legacy defaults，例如 `spacingIndependent`、`spacingX`、`spacingY`、`boundarySpacing`。
- custom slot id 修复和 boundary spacing compatibility。
- simple stepped rows/slots old-shape repair。
- stepped bottomHeight 到 groups/groupId migration。
- stepped group defaults、group structure override defaults、旧 `splitPartGroupId` 清理。

**Legacy Param Migration** 不拥有：

- required-field validation。
- Slot Definition matching。
- Slot Geometry Snapshot normalization。
- tray size clamp。
- base-hole derived fields。
- simple stepped core normalization。
- import file wrapper parsing。
- Draft storage or Draft Binding。

**Param Normalization Pipeline** 拥有：

- step ordering。
- mode dispatch。
- validation / migration / Slot Instance normalization / derived-field clamp 的 orchestration。

## 错误处理

现有错误行为保持不变：

- 缺失 required numeric fields 仍由 `param-normalization.ts` validation step 抛错。
- invalid simple stepped rows 仍在 simple stepped legacy migration 中抛 `rows[index]: 无效的行数据`。
- invalid stepped groups 仍在 stepped legacy migration 中抛 `groups[index]: 无效的分组数据`。
- 缺失 stepped `groups` 且无法迁移时仍抛 `缺少或无效的字段: groups`。

迁移 functions 继续 mutate params in place，因为当前 pipeline step Interface 就是 `(params) => void`。

## 测试

更新或新增聚焦测试：

- `src/lib/param-normalization.test.ts`
  - 验证 legacy stepped `splitPartGroupId` 在 normalization 后被清理。
  - 保留现有 grid/custom/simple stepped/stepped import compatibility 覆盖。
- 可新增 `src/lib/param-legacy-migration.test.ts`
  - 只在需要直接验证 migration step 行为时新增。
  - 首选通过 `param-normalization.test.ts` 覆盖 public pipeline Interface，避免测试绕过 pipeline ordering。

最重要的测试 surface 是 **Param Normalization Pipeline** 的 Interface。`param-legacy-migration.ts` 是 pipeline 内部 step，直接测试只用于难以通过 pipeline 观察的 legacy-only repair。

## 迁移计划

这是内部重构，不需要修改参数文件版本、Draft storage 或 UI behavior。

实施顺序：

1. 补充 regression test，锁定 stepped legacy `splitPartGroupId` 清理行为。
2. 同步 `param-legacy-migration.ts` 到当前 `param-normalization.ts` 的 migration 行为。
3. 让 `param-normalization.ts` import migration functions。
4. 删除 `param-normalization.ts` 内重复 migration Implementation。
5. 运行 `param-normalization.test.ts`、全量测试、typecheck、lint。

## 回滚边界

回滚范围限制在：

- `src/lib/param-legacy-migration.ts`
- `src/lib/param-normalization.ts`
- `src/lib/param-normalization.test.ts`
- 可选的 `src/lib/param-legacy-migration.test.ts`
- `CONTEXT.md`

如果接入后出现非预期行为，可以恢复 `param-normalization.ts` 内部 migration functions，并让 pipeline 重新使用本地 Implementation。该回滚不需要迁移用户数据。
