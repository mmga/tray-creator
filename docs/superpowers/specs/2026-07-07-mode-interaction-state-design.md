# Mode Interaction State 设计

## 目标

深化 mode editor orchestration，让 **Mode Interaction State**、**Mode Workspace** 和 **Mode Viewport Workspace** 的协作集中在一个更深的 Module 后面。

本次调整要让 `src/app/page.tsx` 只保留 page shell 职责：持有当前 Mode、渲染 active workspace 和 active viewport、切换 Mode 时触发 transient state reset。Page 不应知道 stepped / stepped-cad 专属的 selected slot、preview group 或 reset wiring。

## 领域决策

- **Mode Interaction State** 是 Mode-local transient editor state。
- **Mode Interaction State** 属于一个 active Mode editing workflow，不属于 page shell，也不属于 registry。
- 当左侧 panel controls 和右侧 viewport interactions 都读写同一份 transient editor state 时，**Mode Workspace** 和 **Mode Viewport Workspace** 可以共享 **Mode Interaction State**。
- **Mode Workspace Registry** 只选择 active **Mode Workspace Adapter**，不拥有 mode-specific workflow rules。
- **Mode Viewport Workspace Registry** 只选择 active **Mode Viewport Workspace Adapter**，不拥有 mode-specific viewport rules。

这些决策已记录在 `CONTEXT.md`。

## 当前摩擦

`stepped` 和 `stepped-cad` 的 shared interaction state 现在绕过了 mode-local orchestration：

- `src/viewports/stepped/useSteppedViewportWorkspace.tsx`
  - 拥有 `selectedSlotIds` 和 `previewGroupId`。
  - 从 `LayoutCanvas` 接收 selection updates。
  - 把 `previewGroupId` 投影为 viewport overlay focus。
- `src/hooks/useModeViewportWorkspaces.tsx`
  - 除了返回 `activeViewport`，还额外暴露 `steppedSelectedSlotIds`、`steppedPreviewGroupId`、`setSteppedPreviewGroupId`、`resetSteppedViewportState`。
  - 这些字段是 stepped-specific knowledge，不属于 registry。
- `src/app/page.tsx`
  - 解构 stepped-specific state。
  - 手动传给 `useModeWorkspaces`。
- `src/hooks/useModeWorkspaces.tsx`
  - 为所有 modes 的 registry Interface 增加 stepped-only 参数。
  - 只把这些参数转发给 `stepped` 和 `stepped-cad` Adapter。

这削弱了 locality：理解一个 stepped 交互要跨 viewport Adapter、两个 registry、page shell、workspace Adapter。也削弱了 leverage：registry 的 Interface 变宽，但大部分 modes 不需要这些字段。

## 选定方案

新增一个 mode editor orchestration Module，内部同时创建 models、Mode Interaction State、active **Mode Workspace** 和 active **Mode Viewport Workspace**。

这个 Module 是 page shell 和 mode-local adapters 之间的更深 Seam。Page 调用它后只拿到：

- `activeWorkspace`
- `activeViewport`

Mode Interaction State 留在这个 Module 内部，只有需要它的 adapters 会接收对应字段。

## 模块形状

新增 `src/hooks/useModeEditorWorkspaces.tsx`。

它拥有：

- current Mode input。
- grid / custom / simple-stepped / stepped / stepped-cad model hook 调用。
- stepped / stepped-cad 当前共享的 **Mode Interaction State**。
- `useModeViewportWorkspaces` 调用。
- `useModeWorkspaces` 调用。

它返回：

- `activeWorkspace`
- `activeViewport`

`useModeWorkspaces` 保持 registry role：

- 输入各 Mode model。
- 输入只对相关 adapters 可见的 Mode Interaction State。
- 选择 active **Mode Workspace Adapter**。
- 不再让 page shell 传入 stepped-only 参数。

`useModeViewportWorkspaces` 保持 registry role：

- 输入各 Mode model。
- 输入只对相关 adapters 可见的 Mode Interaction State。
- 选择 active **Mode Viewport Workspace Adapter**。
- 返回 `activeViewport`，不再返回 stepped-only state。

`useSteppedViewportWorkspace` 不再创建 `selectedSlotIds` 和 `previewGroupId`。它消费 mode editor orchestration 传入的 Mode Interaction State，并继续负责 viewport wiring：

- `LayoutCanvas.commands.selectionChanged` 写入 selected slot ids。
- `buildSteppedLayoutEditorViewportModel` 读取 preview group id。
- `resetTransientState` 清空 shared interaction state。

`useSteppedWorkspace` 和 `useSteppedCadWorkspace` 消费同一份 Mode Interaction State：

- panel 读取 selected slot ids。
- panel 读取和更新 preview group id。
- reset/import/Draft load 后调用同一份 reset。

## 数据流

初始化：

1. `page.tsx` 持有 `mode`。
2. `page.tsx` 调用 `useModeEditorWorkspaces({ mode })`。
3. `useModeEditorWorkspaces` 创建所有 Mode models。
4. `useModeEditorWorkspaces` 创建 stepped-family Mode Interaction State。
5. `useModeEditorWorkspaces` 创建 active **Mode Viewport Workspace** 和 active **Mode Workspace**。
6. `page.tsx` 渲染 active panel、active viewport、Draft dialog。

Viewport selection：

1. 用户在 `LayoutCanvas` 中选择 stepped slot。
2. stepped viewport Adapter 写入 Mode Interaction State 的 selected slot ids。
3. stepped workspace Adapter 把 selected slot ids 传给 `SteppedPanel`。
4. `SteppedPanel` 显示移动到组等 selected-slot controls。

Preview group：

1. 用户在 `SteppedPanel` 中切换 group preview。
2. stepped workspace Adapter 写入 Mode Interaction State 的 preview group id。
3. stepped viewport Adapter 读取 preview group id。
4. `LayoutCanvas` overlay 聚焦对应 group。

Reset：

1. 切换 Mode 时，page 调用当前 `activeViewport.resetTransientState()`。
2. stepped / stepped-cad reset 清空 Mode Interaction State。
3. reset params、import params、Draft load 后，workspace Adapter 调用同一 reset。

## 职责分配

mode editor orchestration Module 拥有：

- 创建所有 Mode models。
- 创建 Mode Interaction State。
- 把 Mode Interaction State 注入需要它的 workspace / viewport adapters。
- 返回 active workspace 和 active viewport。

Page shell 拥有：

- 当前 Mode state。
- header、tabs、layout shell。
- 渲染 active workspace、active viewport 和 Draft dialog。
- 切换 Mode 时调用 active viewport transient reset。

Registry Modules 拥有：

- 选择 active Adapter。
- 对 adapters 做最少 wiring。

Registry Modules 不拥有：

- stepped selected slot 规则。
- stepped preview group 规则。
- reset/import/Draft load 的 mode-specific side effects。

Stepped viewport Adapter 拥有：

- canvas wiring。
- viewport tab wiring。
- selected-slot update 的 viewport source。
- preview group 到 overlay focus 的投影。

Stepped workspace Adapter 拥有：

- panel wiring。
- reset/import/Draft load 后触发 transient state reset。
- panel preview group control wiring。

## 错误处理

这是内部 orchestration 重构，不改变参数校验或导入错误行为。

Mode Interaction State 的 reset 必须是幂等的：

- 空 selection reset 不报错。
- 空 preview group reset 不报错。
- 非 stepped Mode 调用 reset 时保持 no-op 或只清空当前 Mode 的 transient state。

如果 active Mode 不支持某个 interaction state，registry 不应向对应 Adapter 注入 stepped-only state。

## 测试

更新或新增聚焦测试：

- `src/app/page.test.tsx`
  - page 能渲染 active workspace 和 active viewport。
  - 切换 Mode 时仍调用 active viewport reset。
  - 测试不再依赖 page 解构 stepped-only state。
- 新增 `src/hooks/useModeEditorWorkspaces.test.tsx`
  - stepped viewport selection update 后，stepped panel 能看到 selected slot ids。
  - stepped panel 设置 preview group 后，viewport overlay 能看到 focused group id。
  - reset params、import params、Draft load 后，Mode Interaction State 被清空。
- 现有 `src/components/panels.test.tsx`
  - 保留 `SteppedPanel` 自身 props-level 行为测试，不把 Mode Interaction State orchestration 塞进 panel test。

最重要的测试 surface 是 mode editor orchestration Module 的 Interface：调用者只知道 Mode input 和 active outputs，测试通过 panel/viewport observable behavior 验证 shared interaction state 是否连通。

## 迁移计划

这是内部重构，不需要修改保存参数、Draft storage 或导入文件格式。

迁移步骤应保持行为等价：

1. 增加 Mode Interaction State 类型和 mode editor orchestration Module。
2. 调整 stepped viewport Adapter 从内部 state 改为消费传入 state。
3. 调整 stepped workspace Adapter 消费同一 state。
4. 收窄 registry return 和 options。
5. 简化 `page.tsx`。
6. 更新测试，验证 selection、preview group、reset 行为未变。

## 回滚边界

回滚范围限制在：

- `src/hooks/useModeEditorWorkspaces.tsx`
- `src/hooks/useModeWorkspaces.tsx`
- `src/hooks/useModeViewportWorkspaces.tsx`
- `src/viewports/stepped/useSteppedViewportWorkspace.tsx`
- `src/viewports/stepped-cad/useSteppedCadViewportWorkspace.tsx`
- `src/workspaces/stepped/useSteppedWorkspace.tsx`
- `src/workspaces/stepped-cad/useSteppedCadWorkspace.tsx`
- `src/app/page.tsx`
- 相关测试
- `CONTEXT.md`

如果重构带来非预期行为，可以恢复由 stepped viewport Adapter 持有 state、registry 暴露 stepped-only 字段、page 手动接线的旧路径；不需要迁移用户数据。
