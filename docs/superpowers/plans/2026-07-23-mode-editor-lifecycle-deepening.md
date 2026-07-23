# Mode Editor 生命周期架构深化实施计划

> 日期：2026-07-23
>
> 状态：已完成（2026-07-23）
>
> 实施对象：Mode Editor、Mode Workspace、Mode Viewport Workspace、Draft Binding、参数导入、异步预览生命周期
>
> 推荐顺序：`基线校正 → 类型收口 → Session Epoch → Draft 两阶段加载 → Mode Editor Adapter → 单点切换 → 删除旧路径 → 全量验收`

## 1. 目标

本计划深化 **Mode Editor Module**，使页面只通过一个较小的 Interface 获得当前 Mode 的 Workspace、Viewport 和 overlays，并通过一个意图入口触发 Mode 生命周期或 Session 替换。

目标收益：

- **Locality**：Mode 切换、重置、参数导入、Draft 加载、交互清理和异步失效集中在 Mode Editor Module。
- **Leverage**：页面不再了解 Workspace 与 Viewport 的配对规则，也不再拥有 active Mode。
- **Depth**：调用者只使用 `active + perform`，Mode 特有的替换顺序和风险判断隐藏在 Implementation 内。
- **类型安全**：Mode 与参数快照使用判别联合绑定，删除跨 Mode 的弱类型提交和强制转换。
- **并发安全**：Session 替换后，旧异步请求不能再修改几何、体积、加载状态、诊断或 toast。

本计划取代下列历史文档中“两个 Registry 分别选择 Workspace 与 Viewport”的设计段落，但保留这些文档作为历史记录：

- `docs/superpowers/specs/2026-07-07-mode-interaction-state-design.md`
- `docs/superpowers/plans/2026-07-08-mode-interaction-state.md`
- `docs/superpowers/plans/2026-07-13-left-panel-architecture-deepening.md`

## 2. 已确认的不变量

### 2.1 Mode 切换

- active Mode 由 Mode Editor Module 拥有，页面不再保存或修改它。
- 源 Mode 负责退出；目标 Mode 不执行普通切换清理。
- 普通切换保留各 Mode 的：
  - 已提交参数；
  - Undo History；
  - Draft Binding；
  - Unsaved Draft Changes；
  - 独立的 `2d/3d` 视图选择；
  - Session Epoch。
- 普通切换只取消源 Mode 的 Working Edit，并清除源 Mode 的瞬态交互。

### 2.2 Session 替换

以下操作属于 Session 替换：

- reset；
- 外部参数导入；
- Draft 加载。

Session 替换必须原子完成：

```text
准备并校验输入
→ 重新读取目标风险
→ 原子替换目标参数
→ 清空 Undo History 和 Working Edit
→ 更新或清除 Draft Binding
→ 清除目标瞬态交互
→ 目标 Viewport 回到 2D
→ Session Epoch 递增
→ 切换 active Mode（跨 Mode 时）
→ 反馈成功
```

首次写入前发生错误时，参数、Undo History、Draft Binding、Mode Interaction State、Viewport 和 active Mode 全部保持不变。

### 2.3 风险门

- 外部参数导入始终需要确认。
- reset 仅在目标存在 Unsaved Draft Changes 时确认。
- Draft 加载仅在会覆盖 Unsaved Draft Changes 时确认。
- cancel 不修改任何状态。
- 用户确认后、提交前必须重新读取风险。
- 若风险指纹发生变化，停止提交并刷新确认内容，不能沿用旧确认。

风险指纹至少包含：

```ts
interface ReplacementRiskFingerprint {
  currentDraftId: string | null;
  hasUnsavedChanges: boolean;
  paramsRevision: number;
}
```

### 2.4 异步生命周期

- 每个 Mode Editing Session 拥有独立 Session Epoch。
- Session 替换递增目标 Epoch；普通切换不递增。
- 整体预览、轮廓预览、CAD split 和优化请求都捕获发起时的 Epoch。
- 旧 Epoch 的结果不能更新：
  - geometry；
  - volume；
  - loading；
  - diagnostics；
  - toast。
- 旧结果包含 geometry 时必须 dispose。
- 旧请求的 `finally` 不能清除新请求的 loading。
- 已开始的导出使用开始时捕获的不可变快照继续完成，不受后续 Session 替换影响。

### 2.5 Interface 约束

- 外部 Interface 固定为 `active + perform`。
- 内部使用静态装配、类型安全的 Mode Editor Catalog。
- Grid、Custom、Base Converter、Stepped 各有一个 Mode Editor Adapter。
- Workspace 与 Viewport 保持不同 Module，由 Mode Editor Adapter 配对。
- `perform` 只处理 Mode 生命周期和 Session 替换，不扩张为全局命令总线。
- 不为假设能力建立通用 Interface；至少出现两个真实 Adapter 后才建立新的能力 Seam。

## 3. 目标 Interface

### 3.1 页面可见 Interface

```ts
interface ModeEditor {
  readonly active: {
    readonly mode: AppMode;
    readonly panel: React.ReactNode;
    readonly viewport: React.ReactNode;
    readonly overlays: React.ReactNode;
  };
  perform(intent: ModeEditorIntent): Promise<ModeEditorResult>;
}
```

`ModeEditorIntent` 限定为：

```ts
type ModeEditorIntent =
  | { type: "switch-mode"; mode: AppMode }
  | { type: "request-reset"; mode: AppMode }
  | { type: "request-param-import"; file: File }
  | { type: "select-import-mode"; mode: AppMode }
  | { type: "request-draft-load"; mode: AppMode; draftId: string }
  | { type: "confirm-replacement" }
  | { type: "cancel-replacement" };
```

结果只表达调用者下一步需要知道的状态：

```ts
type ModeEditorResult =
  | { status: "completed" }
  | { status: "awaiting-confirmation" }
  | { status: "cancelled" }
  | { status: "error"; message: string };
```

保存、重命名、删除和导出 Draft 仍由 Draft Module 处理；它们不属于 Mode 生命周期，不进入 `perform`。

### 3.2 内部 Adapter Interface

```ts
interface ModeEditorAdapter<M extends AppMode> {
  readonly mode: M;
  readonly workspace: ModeWorkspace;
  readonly viewport: ModeViewportWorkspace;
  readReplacementRisk(): ReplacementRiskFingerprint;
  deactivate(): void;
  prepareReset(): PreparedModeReplacement<M>;
  prepareDraftLoad(draftId: string): PreparedModeReplacement<M>;
  commitReplacement(replacement: PreparedModeReplacement<M>): void;
}
```

`deactivate()` 只处理普通离开：

- 取消 Working Edit；
- 清除瞬态交互；
- 保留参数、历史、Draft Binding、视图选择和 Epoch。

`commitReplacement()` 是同步、不抛出业务校验错误的提交段。所有读取、迁移、兼容性判断和 normalization 必须在 prepare 阶段完成。

### 3.3 类型安全快照

将 Import Candidate 收口为 Mode 与 Param Snapshot 成对的判别联合：

```ts
type ImportCandidate = {
  [M in AppMode]: {
    readonly mode: M;
    readonly snapshot: ModeParamSnapshot<M>;
    readonly report: ParamImportReport;
  };
}[AppMode];
```

Mode Editor Catalog 只能把 `M` 的 `ModeParamSnapshot<M>` 交给 `ModeEditorAdapter<M>`，不提供 `unknown` 或跨 Mode 的通用 commit。

## 4. 实施阶段

## 阶段 0：建立绿色基线

### 目标

先修正与当前领域定义不一致的旧测试，避免架构迁移掩盖既有失败。

### 涉及文件

- `src/hooks/useSteppedLayout.integration.test.ts`
- 必要时仅补充测试夹具，不修改生产行为

### 步骤

1. 将测试中仍假设 `activeGroupId` 持久化在参数内的断言，改为通过 Mode Interaction State 观察。
2. 保留现有 Stepped 参数持久化格式，不把交互状态重新写回参数。
3. 单独运行该集成测试，确认 8 个用例全部通过。
4. 运行当前 unit 与 integration 套件，记录迁移前基线。

### 验证

```bash
pnpm test:unit
pnpm test:integration
```

### 提交

```text
test: align stepped integration baseline with interaction state
```

### 回滚边界

只包含测试契约校正，可独立回滚，不影响生产代码。

## 阶段 1：收口快照与替换类型

### 目标

先建立类型安全的替换输入，使后续迁移不能通过弱类型路径提交错误 Mode 的参数。

### 涉及文件

- 新增 `src/mode-editor/types.ts`
- 新增 `src/mode-editor/catalog.ts`
- `src/lib/mode-param-snapshot.ts`
- `src/lib/historical-param-artifact-reader.ts`
- `src/lib/param-io.ts`
- `src/components/ParamImportDialog.tsx`
- `src/lib/param-io.test.ts`
- `src/components/ParamImportDialog.test.tsx`
- 新增 `src/mode-editor/catalog.test.ts`

### 步骤

1. 建立 `ModeParamSnapshot<M>`、`PreparedModeReplacement<M>`、风险指纹和 `ModeEditorIntent`。
2. 把 Import Candidate 改为 `mode + snapshot` 判别联合。
3. 让历史参数读取与 normalization 输出已配对快照。
4. 建立静态 Catalog 构造函数，运行时验证四个 AppMode：
   - 不缺失；
   - 不重复；
   - key 与 Adapter 的 `mode` 一致。
5. 更新导入对话框只消费候选展示数据，不拥有提交逻辑。
6. 删除导入链路中的 `params as ...`、`unknown` commit 和 `targetMode + params` 分离结构。

### 测试先行

- 错误 Mode 的快照在 TypeScript 编译期不可提交。
- Catalog 缺失、重复或 key 不匹配时测试失败。
- 自动识别和人工选择 Mode 后都生成正确判别分支。
- 旧版本参数仍经过原有 Draft Compatibility 和 normalization。

### 验证

```bash
pnpm test:unit -- src/lib/param-io.test.ts src/components/ParamImportDialog.test.tsx src/mode-editor/catalog.test.ts
pnpm typecheck
```

### 提交

```text
refactor: pair mode with typed replacement snapshots
```

## 阶段 2：建立 Session Epoch 与异步所有权

### 目标

在接入新的替换入口前，先确保所有异步结果都受 Session 生命周期约束。

### 涉及文件

- `src/hooks/useEditableParams.ts`
- `src/hooks/usePreviewLifecycle.ts`
- `src/hooks/useSteppedOutlinePreview.ts`
- `src/hooks/useSteppedCadSplitOrchestration.ts`
- `src/hooks/useTrayModel.ts`
- `src/hooks/useCustomLayout.ts`
- `src/hooks/useBaseConverter.ts`
- `src/hooks/useSteppedLayoutController.ts`
- 对应测试文件：
  - `src/hooks/useEditableParams.test.ts`
  - `src/hooks/usePreviewLifecycle.test.ts`
  - `src/hooks/useSteppedOutlinePreview.integration.test.ts`
  - `src/hooks/useSteppedCadSplitOrchestration.test.ts`

### 步骤

1. 在 `useEditableParams` 中建立 Session Epoch，并使 Session 替换一次只递增一次。
2. 模型 Hook 对外暴露一致的 Session 替换原语；现有 `setParams` 别名逐步退场。
3. 为整体预览、轮廓预览、CAD split 和优化请求捕获：
   - Session Epoch；
   - 请求序号；
   - loading 所有权 token。
4. 每个更新点在写入前同时验证 Epoch 和请求序号。
5. 旧 geometry 结果立即 dispose。
6. `finally` 仅允许 loading 所有者清除 loading。
7. 导出入口捕获不可变参数与 geometry 快照，后续不再读取活动 Session。

### 必测并发场景

- A 请求开始，替换 Session，A 成功返回：结果被丢弃并 dispose。
- A 请求开始，替换 Session，B 请求开始，A `finally`：B 的 loading 保持。
- A 请求开始，替换 Session，A 失败：不写 diagnostics，不发 toast。
- 普通 Mode 切换后返回：Epoch 未变化，合法请求仍可落地。
- 导出开始后替换 Session：导出继续使用旧快照完成。

### 验证

```bash
pnpm test:unit -- src/hooks/useEditableParams.test.ts src/hooks/usePreviewLifecycle.test.ts src/hooks/useSteppedCadSplitOrchestration.test.ts
pnpm test:integration -- src/hooks/useSteppedOutlinePreview.integration.test.ts
pnpm typecheck
```

### 提交

```text
refactor: bind async preview results to mode session epochs
```

### 回滚边界

本阶段不改变页面编排或用户入口；可在 Mode Editor 切换前独立回滚。

## 阶段 3：把 Draft 加载拆成 prepare/commit

### 目标

让 Draft Module 只负责读取、兼容性判断、normalization 和 Draft Binding 数据准备，不再直接替换模型。

### 涉及文件

- `src/hooks/useModeDrafts.ts`
- `src/workspaces/shared.tsx`
- `src/workspaces/draft-action-area.ts`
- `src/components/DraftManagerDialog.tsx`
- `src/components/DraftManagerDialog.test.tsx`
- 新增 `src/hooks/useModeDrafts.test.ts`
- `src/lib/draft-session.ts`
- `src/lib/draft-session.test.ts`
- 四个 Mode Workspace Adapter 的 Draft 组装位置

### 步骤

1. 从 `UseModeDraftsOptions` 删除 `setParams` 和 `onAfterLoad`。
2. 把 `loadDraft(id)` 拆为：
   - `prepareDraftLoad(id)`：只读，返回规范化快照、Draft id、标题和序列化基线；
   - `commitLoadedDraftBinding(prepared)`：只更新 Draft Binding 和对话框状态。
3. Draft Manager 的加载动作改为发送 `request-draft-load` 意图。
4. Mode Editor Adapter 负责在一个同步提交段内：
   - 替换参数；
   - 提交 Draft Binding；
   - 清理交互；
   - 重置 Viewport；
   - 递增 Epoch。
5. 准备失败时保持对话框、模型和 Draft Binding 不变，并通过当前错误反馈路径报告。

### 测试先行

- prepare 成功不修改参数或 Draft Binding。
- 旧 Draft 经过兼容和 normalization 后形成正确 typed snapshot。
- prepare 失败不关闭对话框。
- commit 后 Draft Binding 的序列化基线等于加载结果。
- 加载其他 Draft 的风险由 Mode Editor 决定，Draft Module 不自行确认。

### 验证

```bash
pnpm test:unit -- src/hooks/useModeDrafts.test.ts src/components/DraftManagerDialog.test.tsx src/lib/draft-session.test.ts
pnpm typecheck
```

### 提交

```text
refactor: split draft loading into prepare and commit
```

## 阶段 4：装配 Mode Editor Adapter 与每 Mode Viewport 状态

### 目标

建立四个真实 Adapter，并消除 Workspace 与 Viewport 的独立 switch 配对。

### 涉及文件

- 新增 `src/mode-editor/adapters.tsx`
- `src/mode-editor/catalog.ts`
- `src/workspaces/types.ts`
- `src/viewports/types.ts`
- `src/viewports/grid/useGridViewportWorkspace.tsx`
- `src/viewports/custom/useCustomViewportWorkspace.tsx`
- `src/viewports/base-converter/useBaseConverterViewportWorkspace.tsx`
- `src/viewports/stepped/useSteppedViewportWorkspace.tsx`
- `src/workspaces/grid/useGridWorkspace.tsx`
- `src/workspaces/custom/useCustomWorkspace.tsx`
- `src/workspaces/base-converter/useBaseConverterWorkspace.tsx`
- `src/workspaces/stepped/useSteppedWorkspace.tsx`
- 新增 `src/mode-editor/adapters.test.tsx`
- 新增 `src/viewports/modeViewportWorkspace.test.tsx`

### 步骤

1. Grid、Custom、Base Converter、Stepped 各装配一个 Mode Editor Adapter。
2. 每个 Adapter 显式配对同 Mode 的 Workspace、Viewport 和 Session 操作。
3. 每个 Viewport Workspace 自己拥有 `2d/3d` 状态，删除共享 `rightView`。
4. 把 Viewport 生命周期拆为两个语义：
   - `deactivate()`：普通离开，不重置视图；
   - `resetForSessionReplacement()`：回到 2D 并清理目标瞬态 Viewport 状态。
5. Adapter 的 `deactivate()` 只处理源 Mode：
   - Stepped 取消连续编辑并清理选中、预览分组；
   - Custom 清理现有瞬态交互；当前不存在可回滚 Working Edit 时不伪造事务；
   - Grid、Base Converter 不建立空能力 Interface。
6. Adapter 的 `commitReplacement()` 固定执行已确认的原子顺序。
7. Catalog 成为唯一配对位置。

### 测试先行

- 每个 AppMode 恰好映射一个相同 Mode 的 Workspace 与 Viewport。
- Grid 设为 3D，切换 Custom 再返回 Grid，Grid 仍为 3D。
- 替换 Custom Session 只把 Custom Viewport 重置为 2D。
- 普通切换只清理源 Mode，目标交互不被误清理。
- 替换目标清空 Undo History、Working Edit 和瞬态交互。
- reset 清除 Draft Binding；Draft 加载绑定目标 Draft；外部导入清除 Draft Binding。

### 验证

```bash
pnpm test:unit -- src/mode-editor/catalog.test.ts src/mode-editor/adapters.test.tsx src/viewports/modeViewportWorkspace.test.tsx
pnpm typecheck
```

### 提交

```text
refactor: pair mode workspaces and viewports in editor adapters
```

## 阶段 5：迁移到单一 Mode Editor 编排

### 目标

由 Mode Editor Module 拥有 active Mode、pending replacement 和风险门；页面退化为纯渲染调用者。

### 涉及文件

- 新增 `src/hooks/useModeEditor.tsx`
- 新增 `src/hooks/useModeEditor.test.tsx`
- `src/app/page.tsx`
- `src/app/page.test.tsx`
- `src/components/ModeTabs.tsx`
- `src/components/ParamImportDialog.tsx`
- 新增 `src/components/ModeReplacementConfirmDialog.tsx`
- 新增 `src/components/ModeReplacementConfirmDialog.test.tsx`
- 四个 Mode Workspace 实现
- 阶段 6 将删除的旧 Hook

### 步骤

1. `useModeEditor()` 无条件创建四个 Model Hook 和四个 Mode Editor Adapter。
2. Hook 内部创建静态 Mode Editor Catalog，并拥有 active Mode。
3. `active` 从同一个 Adapter 投影 `panel`、`viewport` 和合并后的 `overlays`，不向页面暴露内部 Adapter。
4. `perform` 实现以下状态机：

```text
idle
  ├─ switch-mode ───────────────→ deactivate source → activate target → idle
  ├─ request-reset ─────────────→ prepare → risk gate
  ├─ request-param-import ──────→ prepare/选择 Mode → risk gate
  └─ request-draft-load ────────→ prepare → risk gate

risk gate
  ├─ 不需确认 ─────────────────→ recheck risk → commit → idle
  └─ 需要确认 ─────────────────→ awaiting-confirmation

awaiting-confirmation
  ├─ cancel ────────────────────→ idle（零写入）
  └─ confirm ───────────────────→ recheck risk
                                   ├─ 指纹变化 → 刷新确认
                                   └─ 指纹一致 → commit → idle
```

5. 外部导入即使没有 Unsaved Draft Changes，也始终进入确认。
6. 页面删除：
   - `useState<AppMode>`；
   - `setMode`；
   - 对 `resetTransientState()` 的直接调用；
   - Workspace 与 Viewport 的分别选择。
7. ModeTabs 只发送 `switch-mode` 意图。
8. Workspace 内 reset、参数导入和 Draft 加载入口只发送意图，不直接写模型。
9. toast 只在最终提交成功后发出一次；准备失败和提交成功使用不同结果分支。
10. 完成页面切换后不单独提交，立即进入阶段 6 删除旧路径，禁止在 Git 历史中形成双 active Mode 或双提交路径。

### 核心场景测试

| 场景 | 期望 |
|---|---|
| Grid → Custom → Grid | Grid 参数、历史、Draft Binding 和视图保持 |
| Stepped Working Edit 时切换 | 源 Working Edit 取消，已提交参数保持 |
| 无未保存变化时 reset | 不弹确认，原子替换并回到 2D |
| 有未保存变化时 reset | 弹确认；取消后所有状态不变 |
| 外部导入当前 Mode | 始终确认；确认后清除 Draft Binding |
| 外部导入其他 Mode | 确认后替换目标并切换 active Mode |
| Draft 加载且无覆盖风险 | 直接提交并绑定 Draft |
| Draft 加载且有覆盖风险 | 确认后提交；取消零写入 |
| 确认期间风险变化 | 不提交，刷新确认 |
| 准备阶段失败 | active Mode、模型、交互、Draft、Viewport 不变 |

### 验证

```bash
pnpm test:unit -- src/hooks/useModeEditor.test.tsx src/app/page.test.tsx src/components/ParamImportDialog.test.tsx src/components/ModeReplacementConfirmDialog.test.tsx
pnpm typecheck
pnpm lint
```

### 提交

```text
本阶段不单独提交；与阶段 6 合并为一个原子提交。
```

### 回滚边界

阶段 5 与阶段 6 共同构成唯一的用户入口切换提交。回滚时整体回滚，不允许只恢复页面状态而保留新的 Adapter 提交路径。

## 阶段 6：删除浅层 Interface 并强化架构守卫

### 目标

通过删除测试确认旧 Module 不再承担价值，防止后续重新引入双 Registry 和旁路提交。

### 涉及文件

- 删除 `src/hooks/useModeEditorWorkspaces.tsx`
- 删除 `src/hooks/useModeEditorWorkspaces.test.tsx`
- 删除 `src/hooks/useModeWorkspaces.tsx`
- 删除 `src/hooks/useModeViewportWorkspaces.tsx`
- `src/workspaces/types.ts`
- `src/viewports/types.ts`
- `src/hooks/useModeEditor.test.tsx`
- `src/mode-editor/catalog.test.ts`
- 必要的静态架构测试

### 删除项

- `ModeWorkspaceImportTarget`
- `getImportTarget`
- `activeWorkspace` 与 `activeViewport` 的独立 switch
- 共享 `rightView`
- 页面持有的 active Mode
- Draft Module 的直接 `setParams`
- Workspace 的直接 reset/import/load commit
- 跨 Mode 参数强制转换
- 旧 `resetTransientState()` 模糊语义

### 架构守卫

新增静态断言或窄范围源码扫描测试：

- `src/app/page.tsx` 不出现 `setMode` 或模型 Hook。
- 旧 Registry 文件不存在。
- 外部输入提交只在 Mode Editor Adapter 内出现。
- Catalog 覆盖所有 `AppMode`。
- Viewport reset 只能从 Session replacement 路径调用。

### 删除测试

- 删除 `ModeEditorCatalog`：四个调用者将重新承担 Mode 配对与选择，说明它是 Deep Module。
- 删除 `ModeEditorAdapter`：参数替换、Draft Binding、Viewport、交互与 Epoch 顺序会散回各入口，说明 Seam 有真实 Leverage。
- 删除旧 Registry：复杂度不会转移到调用者，证明它们原本是 Shallow Module。

### 验证

```bash
rg -n "getImportTarget|ModeWorkspaceImportTarget|useModeWorkspaces|useModeViewportWorkspaces|resetTransientState" src
pnpm typecheck
pnpm lint
```

预期 `rg` 无结果；若保留兼容名称，必须在本阶段说明并给出删除期限，否则不验收。

### 提交

```text
refactor: centralize mode lifecycle in the mode editor
```

## 阶段 7：全量回归与文档收尾

### 自动验证

按以下顺序执行，任何一步失败都停止：

```bash
pnpm test:unit
pnpm test:integration
pnpm test:performance
pnpm typecheck
pnpm lint
pnpm build
git diff --check
```

### 手工验证

逐个 Mode 执行：

1. 编辑参数并制造 Undo History。
2. 绑定 Draft 并制造 Unsaved Draft Changes。
3. 切换到 3D。
4. 切换到其他 Mode 再返回。
5. 验证参数、历史、Draft Binding、未保存状态和视图均保留。
6. 分别执行 reset、外部导入、Draft 加载。
7. 验证风险门、取消零写入、确认后回到 2D。
8. 在预览、轮廓、CAD split、优化进行中执行 Session 替换。
9. 验证旧结果、旧错误和旧 loading 不污染新 Session。
10. 在导出进行中替换 Session，验证导出仍来自开始时快照。

### 文档收尾

- 核对 `CONTEXT.md` 中 Mode Editing Session、Mode Editor、Mode Editor Adapter、Mode Editor Catalog 与实现一致。
- 不回写历史计划；只在本计划头部保留取代关系。
- 若实现中出现新的长期不变量，新增 ADR；不把临时迁移细节写入 ADR。

### 提交

```text
test: cover mode editor lifecycle replacements
docs: finalize mode editor lifecycle deepening
```

## 5. 提交与回滚策略

推荐形成六个生产迁移提交：

1. `test: align stepped integration baseline with interaction state`
2. `refactor: pair mode with typed replacement snapshots`
3. `refactor: bind async preview results to mode session epochs`
4. `refactor: split draft loading into prepare and commit`
5. `refactor: pair mode workspaces and viewports in editor adapters`
6. `refactor: centralize mode lifecycle in the mode editor`

测试和文档收尾可并入对应提交；若单独提交，不得包含生产行为变化。

回滚原则：

- 阶段 1 至 4 不改变页面入口，可分别回滚。
- 阶段 5 与阶段 6 是一个原子切换提交，必须整体回滚。
- 不使用长期 feature flag，不保留双写或双 active Mode。

## 6. 明确不在本次范围

- 不重写几何算法、定价、重量或尺寸规则。
- 不改变参数文件和 Draft 文件的对外格式。
- 不解决 Custom Layout Transaction 的完整回滚语义；这是独立架构候选。
- 不统一四个 Mode 的面板业务意图。
- 不建立全局命令总线、事件总线或插件机制。
- 不为只有一个 Implementation 的假设能力建立 Interface。
- 不改变用户可见的 Mode 名称、面板布局或建模流程。

## 7. 完成定义

同时满足以下条件才算完成：

- 页面只消费 `ModeEditor.active` 并调用 `ModeEditor.perform`。
- active Mode 只有一个所有者。
- Workspace 与 Viewport 只在 Mode Editor Catalog 中配对。
- 普通切换和 Session 替换遵守已确认的不变量。
- reset、导入、Draft 加载没有旁路提交。
- 所有异步派生请求受 Session Epoch 和请求所有权保护。
- 每个 Mode 独立保留 `2d/3d` 状态。
- 旧 Registry、弱类型 import target 和共享 `rightView` 已删除。
- 自动验证全部通过。
- 手工并发与风险场景完成并留有可复核记录。

## 8. 最终推荐决策

按本计划的八阶段顺序实施，并把阶段 5 与阶段 6 合并为唯一原子切换提交。

不先做页面改线，也不先删除旧 Registry。先建立类型安全、Session Epoch、Draft prepare/commit 和真实 Adapter，再一次性把页面切换到 `active + perform`。这样可以在迁移前获得并发安全和可测试的 Seam，同时避免双 active Mode、双提交路径和长期兼容层。

## 9. 完成记录

2026-07-23 已完成本计划的生产迁移：

- `useModeEditor` 成为 active Mode、Workspace/Viewport Catalog、替换风险门和 Session 替换提交的唯一所有者。
- reset、参数导入和 Draft 加载统一通过 `ModeEditor.perform`；Draft 加载以 `draftId` 进入，先 prepare 再 commit。
- Mode、参数快照、Workspace 与 Viewport 使用泛型映射保持编译期配对，删除跨 Mode 参数强制转换。
- 普通切换会退出源 Mode；Stepped 同时取消 Working Edit 并清理瞬态交互，不重置目标 Session。
- 删除 `useModeEditorWorkspaces`、`useModeWorkspaces`、`useModeViewportWorkspaces` 及对应旧测试。
- 新增静态架构守卫，防止页面重新持有 Model/Mode 或恢复双 Registry。

自动验证结果：

- unit：94 个测试文件、479 个测试通过；
- integration：4 个测试文件、23 个测试通过；
- performance：1 个测试通过；
- TypeScript、eslint、`git diff --check` 通过；
- Next.js 生产构建与静态预渲染通过；由于执行环境无法访问 Google Fonts，构建验收使用 Next.js 官方测试入口注入本地字体响应，不修改生产字体配置。

按用户最终指示跳过浏览器页面测试；其余完成定义已由自动测试、架构守卫和生产构建覆盖。
