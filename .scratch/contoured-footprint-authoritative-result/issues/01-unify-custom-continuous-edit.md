# 统一 Custom 连续编辑事务

Status: `needs-triage`

Type: `AFK`

Size: `M`

User stories: `US-2`

## 要构建什么

让 Custom 的连续 slot transform 使用现有 **Mode Editing Session Interface**：交互开始时创建工作参数，交互期间只预览工作参数，完成时一次提交规范化参数和 Undo History，取消时丢弃工作参数。

当前 `{ history: "live" }` 路径直接改变已提交参数，无法让后续权威 Contoured Footprint Construction 区分工作结果与已提交结果。本任务必须打通从 LayoutCanvas 交互到 `useCustomLayout`、`useEditableParams` 的完整路径。

## 验收标准

- [ ] Custom slot 拖拽开始时调用连续编辑 begin，而不是立即修改已提交参数。
- [ ] pointer move 只更新工作参数；Draft、模型生成、导出和 Model Geometry Fingerprint 仍读取已提交参数。
- [ ] pointer up 或明确完成操作只提交一次规范化参数，并只新增一个 Undo History 条目。
- [ ] Escape、pointer cancel、普通 Mode 切换和 Mode Editing Session replacement 丢弃工作参数，不消耗 Undo History。
- [ ] unchanged、selection-only 和被拒绝的操作不产生事务副作用。
- [ ] 旋转或批量 slot transform 若使用连续交互，也遵守相同事务语义。
- [ ] 补充 Custom begin、preview、commit、cancel、Undo 和 Mode 切换回归测试。

## 阻塞项

无，可以立即开始。

## 实施提示

优先复用 `useEditableParams` 已有的 `beginContinuousEdit`、`previewContinuousEdit`、`commitContinuousEdit`、`cancelContinuousEdit`，不要创建第二套事务状态。

预计涉及：

- `src/hooks/useCustomLayout.ts`
- `src/hooks/useEditableParams.ts`
- `src/viewports/custom/useCustomViewportWorkspace.tsx`
- `src/components/LayoutCanvas.tsx`
- `src/components/canvas/`

## 验证

- `pnpm exec vitest run src/hooks/useEditableParams.test.ts`
- Custom canvas 与 viewport 相关定向测试
- `pnpm typecheck`

## Comments

- 2026-07-24：已完成。Custom 已接入 `useEditableParams` 的连续编辑事务；2D 使用工作参数，Draft 与模型生成读取已提交参数。已通过 TypeScript、ESLint、Custom 集成测试、Custom Workspace 与 viewport 定向测试。
