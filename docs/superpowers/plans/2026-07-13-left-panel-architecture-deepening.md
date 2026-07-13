# 左侧操作面板架构深化重构计划

> 日期：2026-07-13  
> 实施顺序：`5 → 4 → 1 → 3 → 2`  
> 范围：左侧面板、阶梯/CAD 阶梯面板、Mode Workspace、托盘结果投影、Draft Action Area  
> 原则：不修改建模规则、定价公式、参数文件格式或 Draft Compatibility

## 1. 背景与目标

本计划基于 `CONTEXT.md` 中的领域语言和现有 Mode Workspace 决策，对左侧操作面板改造后的架构摩擦进行深化。

目标不是把大文件机械拆成更多小文件，而是建立具有更高 **Depth** 的 Module：用更小的 Interface 隐藏更多行为，使业务知识和副作用获得 **Locality**，并让调用者通过稳定的 Seam 获得更高 **Leverage**。

实施顺序固定为：

```text
DOM 顺序修复
  → 阶梯/CAD 面板领域拆分
  → Mode Workspace 收回副作用
  → 统一托盘结果投影
  → 深化 Draft Action Area
```

每个阶段独立提交、独立验证、可单独回滚。

## 2. 阶段 5：消除 CSS `order-*` 隐式工作流

### 2.1 问题

当前部分面板通过 `order-1` 至 `order-7` 改变视觉顺序，导致源码、DOM、键盘、读屏和视觉顺序不一致。Mode 的工作流因此成为散落在样式字符串中的隐式 Interface。

### 2.2 决策

直接调整源码与 DOM 顺序，删除所有用于菜单编排的 `order-*`。

- Custom：布局编辑 → 托盘边界 → 制造结构 → 底板孔位 → 统计。
- Simple Stepped：行管理 → 添加凹槽 → 阶梯结构 → 统计。
- Stepped：添加凹槽 → 选中 Slot Instance 操作 → 分组管理 → 阶梯结构 → 底板孔位 → 优化 → 统计。
- “选中凹槽”保持固定 DOM 位置，有选择时按需展开，不预留空白。
- 不新增当前行或当前分组选择器。
- 不修改业务回调或参数规则。

### 2.3 验收

- DOM、视觉、Tab 键和读屏顺序一致。
- 选中状态变化不改变其他区块的相对顺序。
- 面板测试直接断言 DOM 顺序，不检查 Tailwind 类名。

## 3. 阶段 4：沿领域 Seam 拆分阶梯面板

### 3.1 问题

现有 `SteppedPanel` 同时拥有普通阶梯和 CAD-only 行为，Interface 包含大量平行 Props，并通过 `mode` 与可选回调控制 Split Assembly Groove、Locator Pin、拆件归并和分件导出。

这与 `CONTEXT.md` 中 **Stepped Layout Core** 和 **Stepped CAD Split Orchestration** 的领域 Seam 不一致。

### 3.2 根 Module

建立两个独立入口：

```tsx
<SteppedLayoutPanel binding={layoutBinding} />

<SteppedCadPanel
  layout={layoutBinding}
  split={splitBinding}
/>
```

绑定采用“只读投影 + 单一意图入口”：

```ts
interface SteppedLayoutPanelBinding {
  readonly view: SteppedLayoutPanelView;
  perform(
    intent: SteppedLayoutPanelIntent,
  ): Promise<SteppedPanelResult>;
}

interface SteppedCadSplitPanelBinding {
  readonly view: SteppedCadSplitPanelView;
  perform(
    intent: SteppedCadSplitPanelIntent,
  ): Promise<SteppedPanelResult>;
}
```

### 3.3 不变量

- 普通阶梯 Interface 不包含 `mode`、Split Assembly Groove、Locator Pin、归并目标或分件导出。
- CAD Module 组合 **Stepped Layout Core** 与 **Stepped CAD Split Orchestration**。
- 普通布局意图只处理分组、Slot Instance、预览、优化和完整模型。
- CAD split 意图只处理装配设置、分件目标、分件预览和分件导出。
- 面板不读取原始 `SteppedLayoutParams`。
- 第一轮 Adapter 后继续调用现有 Hook，不重写 **Stepped Layout Core**。
- 不引入只有一个 Adapter 的通用 Variant Seam。
- 本阶段不改造 Draft Action Area 或下载链路。

### 3.4 迁移结束后删除

- `SteppedPanel`
- `showSplitAssemblyMode`
- `mode?: "stepped" | "stepped-cad"`
- `splitActions?`
- `onExportSplitParts?`
- `onUpdateGroupSplitPartTarget?`
- 原约 35 项平行 Props

### 3.5 测试

- layout binding 意图契约测试。
- split binding 意图契约测试。
- 普通阶梯不存在 CAD 操作的静态和渲染测试。
- CAD 分件禁用、失效和错误测试。
- Slot Instance、预览锁定、优化和性能入口回归。

## 4. 阶段 1：深化 Mode Workspace

### 4.1 公共 Interface

```ts
interface ModeWorkspace {
  panel: ReactNode;
  overlays: ReactNode;
}
```

页面只负责：

```tsx
{activeWorkspace.overlays}
<aside>{activeWorkspace.panel}</aside>
```

### 4.2 删除的 Interface

- `ModeWorkspace.mode`
- `ModeWorkspace.commands`
- `draftDialogProps`
- 面板的 reset/import fallback
- 面板直接持有的 Draft Binding 输入
- `(params: unknown) => void` 及相关强制转换

### 4.3 类型安全参数映射

```ts
type ParamsByMode = {
  grid: TrayParams;
  custom: CustomLayoutParams;
  "simple-stepped": SimpleSteppedLayoutParams;
  stepped: SteppedLayoutParams;
  "stepped-cad": SteppedLayoutParams;
};
```

### 4.4 唯一外部参数提交路径

每个 **Mode Workspace Adapter** 唯一拥有：

- Draft Binding
- Draft Action Area 构造
- Draft Manager Dialog overlay
- 参数导入
- Draft 加载
- 重置
- Mode Interaction State 清理

统一提交顺序：

```text
读取外部输入
→ 校验版本和 Mode
→ Param Normalization Pipeline
→ 原子替换模型状态
→ 清理 Mode Interaction State
→ 更新或清除 Draft Binding
→ 反馈成功
```

失败发生在首次写入前时，模型、Mode Interaction State、Draft Binding 和弹层状态全部保持不变。

### 4.5 Mode 特有规则

- Simple Stepped 清除 `activeRowId`。
- Stepped/CAD 清除选中 Slot Instance 和预览分组。
- Grid/Custom 不为不存在的交互状态建立假 Adapter。
- 切换 Mode 不清除参数或 Draft Binding。
- CAD 参数文件与 Draft Compatibility 规则留在 CAD Adapter 内。
- Mode Workspace Registry 只选择 Adapter，不拥有 Mode 特有规则。

## 5. 阶段 3：建立 Tray Result Projection

### 5.1 领域定义

**Tray Result Projection** 已加入 `CONTEXT.md`：从当前 Mode 的已规范化参数、派生布局和生成状态中一次性形成的只读结果，供固定摘要与展开详情共同消费。

### 5.2 Interface

```ts
type TrayResultProjection =
  | GridTrayResultProjection
  | CustomTrayResultProjection
  | SimpleSteppedTrayResultProjection
  | SteppedTrayResultProjection;
```

公共结果包含：

- Slot Count
- 最终打印尺寸
- 报价及显示精度
- 重量及可用性
- 构建尺寸警告
- 生成状态
- 预览状态

Mode 特有结果保留真实领域含义：

- Grid：行列和 **Grid Footprint Area**。
- Custom auto：**Effective Baseplate**。
- Custom fixed：**Fixed Tray Outer Footprint**。
- Simple Stepped：行数、最小底板和当前打印边框。
- Stepped/CAD：分组结果和定价明细。

展示入口收缩为：

```tsx
<TrayResultSummary result={result} />
```

### 5.3 不变量

- 固定摘要和展开详情必须使用同一个投影实例。
- 展示 Implementation 不调用定价、尺寸或重量函数。
- `generating`、`stale` 和 `buildLimit` 是独立事实，可同时存在。
- 未生成重量使用显式 unavailable，不伪装成 `0g`。
- 非有限数值不得显示为 `NaN` 或 `Infinity`。
- 超尺寸是警告，不阻止生成和导出。
- 普通阶梯与 CAD 复用 **Stepped Layout Core** 的公共结果。
- “Trim 到凹槽占用区域”属于编辑意图，应移回简易阶梯编辑区。

### 5.4 迁移结束后删除

- `StatsCard`
- 当前 `ResultSummary` 的平行 Props Interface
- 四类面板内联统计区
- 面板中的重复报价、尺寸和重量计算

### 5.5 测试

- 每个 Mode 的 Slot Count、尺寸、报价和重量。
- Custom auto/fixed 的 footprint 语义。
- Grid 使用 **Grid Footprint Area**。
- 同时存在 oversized、generating、stale 时不丢失状态。
- 固定摘要和展开详情消费同一投影。
- 非有限派生值的安全呈现。

## 6. 阶段 2：深化 Draft Action Area

### 6.1 Interface

采用“状态投影 + 单一意图入口”，并以判别能力隔离 CAD：

```ts
type DraftActionAreaAdapter =
  | StandardActionAreaAdapter
  | SteppedCadActionAreaAdapter;

interface StandardActionAreaAdapter {
  readonly state: StandardActionAreaState;
  perform(
    intent: StandardActionIntent,
  ): Promise<DraftActionResult>;
}
```

能力判别：

- Preview：`manual | automatic`
- Delivery：`whole | stepped-cad-split`
- Standard Intent 不包含分件导出。
- CAD Intent 才包含分件导出。
- Manual Preview 不包含自动预览切换意图。

### 6.2 Intent 范围

允许：

- 生成
- 完整导出
- CAD 分件导出
- 自动预览
- Manual Draft Save
- 打开 Draft Manager Dialog
- 参数导入导出
- 重置

禁止：

- 布局编辑
- Slot Instance 编辑
- Viewport 操作
- CAD 装配参数编辑
- 任意菜单描述数组

所有可用性使用：

```ts
type Availability =
  | { state: "available" }
  | { state: "busy"; label: string }
  | { state: "blocked"; reason: string };
```

renderer 不重新推导禁用条件。

### 6.3 所有权

```text
Mode Workspace Adapter
  → 构造 Draft Action Area Adapter
  → Draft Action Area 生成 actions
  → 面板仅接收 actions: ReactNode
  → Draft Manager Dialog 放入 overlays
```

### 6.4 不变量

- `ParamIOButtons` 删除，文件选择与菜单呈现进入 Draft Action Area Implementation。
- Adapter state 不含原始 params，只含呈现事实。
- Availability 同时包含禁用状态和原因，renderer 不重新计算业务条件。
- 导入、Draft 加载和重置复用 Mode Workspace 的唯一提交路径。
- 操作失败保持模型、Mode Interaction State 和 Draft Binding 不变。
- Manual Draft Save 成功持久化后才更新 Draft Binding。
- 普通阶梯 Interface 不包含 CAD 分件意图。
- 不接受任意菜单描述数组或 React 菜单贡献。
- 意图联合不得扩张为全局命令总线。

### 6.5 迁移结束后删除

- `PanelActionSection` 的旧 Interface
- `ParamIOButtons`
- Radix 菜单片段向调用者的泄漏
- 四种 params 联合
- `unknown` 导入
- 可选 CAD 回调
- 面板内 Draft 状态拼装

## 7. 提交与回滚策略

建议使用五个独立提交：

1. `refactor: align panel DOM order with workflow`
2. `refactor: separate stepped layout and CAD panel seams`
3. `refactor: deepen mode workspace ownership`
4. `refactor: unify tray result projection`
5. `refactor: deepen draft action area`

禁止在同一提交中跨阶段清理遗留 Interface。每阶段先建立新路径并完成测试，再删除旧路径，避免新旧双向同步。

若任一阶段回归，可回滚该阶段提交，不需要迁移用户数据。

## 8. 测试与验收

每阶段执行：

```bash
pnpm test
pnpm typecheck
pnpm exec eslint <本阶段文件> --max-warnings=0
pnpm build
git diff --check
```

总体验收：

- 页面只消费 `panel + overlays`。
- 普通阶梯类型中不存在 CAD-only 行为。
- 参数导入、Draft 加载和重置失败保持原状态。
- 摘要与展开详情结果完全一致。
- 自动预览和 CAD 分件能力由类型限制。
- 键盘、读屏和视觉顺序一致。
- 参数文件、Draft Compatibility、定价公式和建模输出不变。

生产构建若因 Google Fonts 网络访问失败，应与代码编译失败分开记录。

## 9. 已知风险

- 阶梯面板迁移期间，若同时保留旧 Props 和新 binding，容易形成两个竞争 Seam；兼容层必须单向且短期存在。
- 意图联合类型必须保持领域粒度，不能退化为 `set(path, value)` 或全局命令总线。
- Tray Result Projection 必须消费既有规范派生 Module，不复制定价或 footprint 公式。
- Mode Workspace Adapter 会增加编排代码，这是为了换取 Locality，不应再次把副作用拆回面板。
- 测试应穿过新 Interface 验证可观察行为，迁移完成后删除测试旧 Shallow Module 的用例。
