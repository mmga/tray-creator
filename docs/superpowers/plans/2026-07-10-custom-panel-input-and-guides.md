# 自定义面板输入与提示优化实施计划

> **执行要求：** 按任务逐项完成；每项包含测试、验证和独立 Git 提交。

**目标：** 允许固定托盘尺寸完整输入后再校验，细化固定可用区域虚线，并压缩圆形自定义直径入口为预设下方的一行控件。

**实现方式：** 将数字输入的临时文本状态封装在通用 `ParamSlider` 内，提交时才调用父级参数更新；画布仅调整固定区域的视觉常量；`CustomPanel` 只调整圆形分组的 DOM 顺序和 Flex 布局。

**技术栈：** React 19、TypeScript、Tailwind CSS、Vitest、Testing Library。

---

## 任务一：修复参数输入的中间编辑状态

**文件：**

- 修改：`src/components/ui/ParamSlider.tsx`
- 修改：`src/components/ui/ParamSlider.test.tsx`

1. 先增加失败测试：以 `value={260}`、`min={10}` 渲染，依次输入 `"1"`、`"10"`、`"100"`；断言文本不会回弹，且 `onChange` 在失焦前未调用。
2. 为 `ParamSlider` 添加字符串草稿状态和聚焦状态。输入事件只写草稿；`onBlur` 与 Enter 共享 `commitDraft()`：有限数且处于 `effectiveMin/effectiveMax` 时调用 `handleValueChange`，否则恢复 `String(safeValue)`。
3. 使用 `useEffect` 在未聚焦时将外部 `safeValue` 同步到草稿，保持滑块更新、导入与撤销后的显示一致。
4. 保留方向键阻止逻辑和滑块的即时 `onValueChange` 行为；新增无效文本失焦恢复的断言。
5. 验证并提交：

```bash
pnpm vitest run src/components/ui/ParamSlider.test.tsx src/components/ui/ParamSlider.radix.test.tsx
pnpm typecheck
git add src/components/ui/ParamSlider.tsx src/components/ui/ParamSlider.test.tsx
git commit -m "fix: 支持完整输入托盘尺寸"
```

## 任务二：统一固定可用区域的提示线样式

**文件：**

- 修改：`src/components/canvas/CanvasOverlayLayer.tsx`
- 修改：`src/components/canvas/canvas-components.test.tsx`

1. 增加固定可用区域覆盖层断言，分别验证正常和越界颜色仍为金色、红色。
2. 将 `data-fixed-usable-area` 的 `strokeWidth` 和 `strokeDasharray` 复用托盘外框的细线参数：`0.2 / zoom` 与 `${0.5 / zoom} ${0.5 / zoom}`；保留不可交互与现有颜色条件。
3. 验证并提交：

```bash
pnpm vitest run src/components/canvas/canvas-components.test.tsx
pnpm typecheck
git add src/components/canvas/CanvasOverlayLayer.tsx src/components/canvas/canvas-components.test.tsx
git commit -m "style: 细化固定托盘可用区域提示"
```

## 任务三：重排圆形自定义直径控件

**文件：**

- 修改：`src/components/CustomPanel.tsx`
- 修改：`src/components/panels.test.tsx`

1. 在面板测试中断言圆形预设按钮在“自定义直径”之前；断言标签、输入框和“添加”按钮位于同一个 Flex 行容器。
2. 将自定义直径控件移动到圆形预设网格之后，结构为单行：`Label`（不换行）、可伸缩 `Input`、固定宽度 `Button`；保留 `htmlFor="custom-circle-diameter"`、最小/最大值、步进和 `handleAddCustomCircleSlot`。
3. 验证并提交：

```bash
pnpm vitest run src/components/panels.test.tsx
pnpm typecheck
git add src/components/CustomPanel.tsx src/components/panels.test.tsx
git commit -m "style: 调整圆形自定义直径入口"
```

## 任务四：全量回归

**文件：** 无预期修改；仅在发现问题时做必要最小修复。

1. 运行：

```bash
pnpm vitest run
pnpm vitest run --config vitest.integration.config.ts
pnpm typecheck
pnpm lint
git diff --check
git status --short
```

2. 若产生回归修复，使用 `test: 覆盖自定义面板输入回归` 单独提交；若无修改，不创建空提交。

## 自检

- 尺寸输入、固定区域样式和圆形入口布局各有单独任务覆盖。
- 不改变参数上下限、持久化、越界规则、随机排版或生成导出行为。
- 所有测试命令与提交文件路径均已明确。
