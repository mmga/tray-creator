# Stepped CAD Split Orchestration 设计

## 目标

把 CAD-only 的 split preview 与 split-part export 编排从 **Stepped Layout Core** 移入 `stepped-cad` Adapter，使共享 Module 只暴露 `stepped` 与 `stepped-cad` 真正共有的编辑能力。

本轮保持所有用户可见行为、参数格式和 CAD 几何生成规则不变。它只调整 Module ownership 与 Interface，不提前实施 Split Interface Profile 的生成 Seam 改造。

## 领域决策

- **Stepped Layout Core** 拥有 group 与 slot 编辑、undo、outline preview、whole-model preview/export、base-hole derived fields 和 layout optimization。
- **Stepped CAD Split Orchestration** 拥有 split-preview generation、invalidation、disposal 和 split-part export。
- `stepped-cad` Adapter 组合 **Stepped Layout Core** 与 **Stepped CAD Split Orchestration**。
- 普通 `stepped` runtime Interface 不暴露 CAD-only split 能力。
- group split-part target 仍通过 **Stepped Layout Core** 的共享 group action 更新；CAD Adapter 复用该 action，不重复实现 snapshot、参数更新或 preview invalidation 规则。

这些决策已记录在 `CONTEXT.md`。

## 当前摩擦

`src/hooks/useSteppedLayoutController.ts` 当前同时拥有共享 stepped 行为和 CAD-only split 行为：

- options 同时接收 whole-model 与 split-model generation/export Implementation。
- return Interface 总是暴露 split preview state、split preview commands、split export command 和 group split target command。
- shared controller 管理 split preview 的 Three.js 资源与失效清理。
- 普通 `useSteppedLayout` 必须通过 `Omit` 和解构丢弃六个 CAD-only 字段。
- `useSteppedWorkspace` 与 `useSteppedViewportWorkspace` 接收普通 stepped/CAD stepped union，并通过 feature flag 与 `"field" in model` 判断 CAD 能力。

这导致 shared controller 的 Interface 表达了错误的能力集合，也让 CAD-only 行为的修改需要同时理解普通 stepped 路径。普通模式为隐藏不属于自己的能力而产生的 unused destructuring warning 是这项边界泄漏的直接症状。

## 方案比较

### 方案一：独立 CAD Split Orchestration Hook

新增 CAD-only hook，由 `useSteppedCadLayout` 组合 shared controller 与 split lifecycle。

优点：

- shared controller 的 Interface 恢复为真正共享能力。
- CAD split lifecycle 获得明确 ownership 和较高 locality。
- 普通 stepped 不再需要删除或探测 CAD 字段。
- 可以保留现有 model service，行为迁移风险较低。

缺点：

- CAD Adapter 需要显式组合两个 hook 的返回值。
- shared preview invalidation 与 CAD split cleanup 之间需要一个明确 Seam。

### 方案二：只提取 split helper

把 worker 调用与下载逻辑移入 helper，但状态和 public Interface 仍留在 shared controller。

优点是改动小；缺点是依赖方向、Interface 污染和 Workspace/Viewport 的能力探测都不变。该方案只缩短文件，属于 Shallow 调整。

### 方案三：完整拆分 CAD Layout Controller

让 CAD Adapter 自行拥有全部 controller composition，包括 group actions、preview 与 export。

它能形成最彻底的边界，但会复制或重新抽象大量已稳定的 stepped 共享行为。本轮收益不足以覆盖测试面与回归风险。

## 选定方案

采用方案一。

新增 `useSteppedCadSplitOrchestration` Module，作为 CAD split lifecycle 的 Deep Implementation。`useSteppedCadLayout` 是组合 Seam：先调用 `useSteppedLayoutController` 获取共享能力，再把必要的 params、shared invalidation signal 和 group action 传给 CAD split Module，最后组合成 CAD Adapter Interface。

## Module 与 Interface

### Stepped Layout Core

`useSteppedLayoutController` 保留：

- params 与 `setParams`
- group/slot 编辑 commands
- undo 与 snapshot
- outline preview
- whole-model preview state 与 generation
- whole-model export
- layout optimization
- `updateGroupSplitPartTarget`

`useSteppedLayoutController` 删除：

- `generateSplitPreview` option
- `exportSplitParts` option
- `splitPreviewParts`
- `isGeneratingSplitPreview`
- `handleGenerateSplitPreview`
- `clearSplitPreview`
- `handleExportSplitParts`

`updateGroupSplitPartTarget` 保留在 shared Interface，是因为它复用统一的 group update、undo 和 invalidation 规则；普通 `useSteppedLayout` 可以通过一个窄的 return type 隐藏该 action，但不再需要运行时解构 CAD lifecycle 字段。

### Stepped CAD Split Orchestration

新增 hook 接收：

- 当前 `SteppedLayoutParams`
- shared preview invalidation signal 或等价的稳定失效依据
- `generateSteppedCadSplitPreview`
- `exportSteppedCadSplitPartFiles`

返回：

- `splitPreviewParts`
- `isGeneratingSplitPreview`
- `handleGenerateSplitPreview`
- `clearSplitPreview`
- `handleExportSplitParts`

model service 继续拥有 worker communication、CAD generation result 转换与文件导出细节。新 hook 只拥有 React lifecycle、命令校验、toast、状态切换与 Three.js resource disposal。

### Workspace Adapter

`useSteppedWorkspace` 改为只接收 `UseSteppedLayoutReturn` 以及显式可选的 split commands，而不是接收普通/CAD model union。

普通 stepped Adapter 不传 split commands。`useSteppedCadWorkspace` 从 CAD model 提取并显式传入：

- `handleExportSplitParts`
- `updateGroupSplitPartTarget`

因此删除 `enableSplitExport` 与 `"handleExportSplitParts" in model`、`"updateGroupSplitPartTarget" in model` 检测。

### Viewport Adapter

`useSteppedViewportWorkspace` 改为只接收共享 stepped model 以及显式可选的 split preview Interface。

普通 stepped Adapter 不传 split preview Interface。`useSteppedCadViewportWorkspace` 显式传入：

- `splitPreviewParts`
- `isGeneratingSplitPreview`
- `handleGenerateSplitPreview`

因此删除 `supportsSplitPreview` 与相关 `"field" in model` 检测。

这保留 shared Workspace/Viewport 的 leverage，同时让 CAD Adapter 明确拥有 CAD-only wiring。

## 数据流

### 普通 stepped

1. `useSteppedLayout` 调用 `useSteppedLayoutController`。
2. shared controller 调用普通 stepped model service 生成 whole-model preview 或 export。
3. Workspace 与 Viewport 只消费共享 Interface。
4. 调用链中不存在 split preview state 或 split-part export command。

### CAD stepped whole model

1. `useSteppedCadLayout` 调用 `useSteppedLayoutController`。
2. shared controller 调用 CAD model service 生成 whole-model preview 或 export。
3. 共享 group/slot、undo、outline 与 optimization 行为保持不变。

### CAD stepped split preview/export

1. `useSteppedCadLayout` 把当前 params 交给 `useSteppedCadSplitOrchestration`。
2. CAD split Module 校验 split configuration。
3. 生成命令调用 `generateSteppedCadSplitPreview`，保存返回的 preview parts。
4. 导出命令调用 `exportSteppedCadSplitPartFiles`，保持现有下载行为。
5. CAD Workspace/Viewport Adapter 显式把 commands 与 state 接到现有 UI Interface。

## 生命周期与资源释放

- params 发生会使 shared preview stale 的变化时，现有 split preview 同步失效并释放。
- 重新生成 split preview 前释放上一组 preview parts。
- clear command 释放当前 preview parts 并清空 state。
- hook 卸载时释放仍持有的 Three.js geometry/material resources。
- 异步生成完成后若结果已过期，不允许旧结果覆盖较新的 state；若当前 Implementation 已有对应保护则迁移并保持，若没有则本轮至少保持当前行为，不顺带扩大并发语义。

shared controller 不直接调用 CAD hook。失效通过 CAD Adapter 可观察的 shared state/版本或由组合层提供的 callback Seam 传递，依赖方向始终为 CAD Adapter 指向 shared core。

## 错误处理

保持现有用户可见语义：

- 没有可拆分 parts 时不调用 worker，并显示现有提示。
- split configuration 无效时保留现有校验文案。
- generation/export 异常继续转换为现有 toast。
- `isGeneratingSplitPreview` 在成功和失败后都恢复。
- 部分生成资源在异常路径中必须释放。

本轮不改变 model service 的错误类型，不新增跨 Module 的异常抽象。

## 测试

新增或更新聚焦测试：

- `useSteppedLayoutController`：
  - public Interface 不再包含 split preview/export lifecycle。
  - whole-model preview invalidation、undo 与 group actions 保持原行为。
- `useSteppedCadSplitOrchestration`：
  - 生成 split preview 时维护 loading state 和 preview parts。
  - 重新生成、失效、clear 与 unmount 会释放旧资源。
  - generation/export 校验与失败 toast 保持现有行为。
- `useSteppedLayout`：
  - 不再通过解构丢弃 CAD-only 字段。
- Workspace/Viewport Adapter：
  - 普通 stepped 不传 split commands。
  - CAD stepped 显式传递 split export 与 split preview Interface。

验证顺序：

1. 相关 hook 与 Adapter 测试。
2. 完整 Vitest。
3. `tsc --noEmit`。
4. ESLint，并区分本轮新增问题与仓库已有 warning。

## 迁移与兼容性

这是内部架构重构，不改变：

- 参数文件 schema 或 version。
- browser Draft 格式。
- split group 配置字段。
- worker request/response contract。
- STL 文件命名与下载行为。
- Split Interface Profile、groove 或 Locator Pin 几何规则。

因此不需要数据迁移或兼容分支。

## 回滚边界

回滚范围限制在：

- `src/hooks/useSteppedLayoutController.ts`
- `src/hooks/useSteppedLayout.ts`
- `src/hooks/useSteppedCadLayout.ts`
- 新增的 CAD split orchestration hook
- `src/workspaces/stepped*/`
- `src/viewports/stepped*/`
- 相关测试
- `CONTEXT.md`

如果组合 Seam 引入非预期行为，可以把 split lifecycle 暂时恢复到 shared controller，不需要回滚参数、Draft、worker 或 CAD geometry Implementation。

## 非目标

- 不改变 **Split Interface Profile** 的推导或消费方式。
- 不调整 split merge、groove type 或 Locator Pin 规则。
- 不重写 CAD model service。
- 不拆分所有 stepped shared Workspace/Viewport JSX。
- 不修复与本边界无关的 Draft mode、UI 或 geometry 问题。
