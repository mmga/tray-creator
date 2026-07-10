# 自定义固定托盘尺寸实施计划

> **面向执行代理：** 必须逐任务执行；每个任务都先补测试、运行失败测试、实现最小代码、运行通过测试并创建独立提交。

**目标：** 为自定义模式提供可选固定托盘外尺寸，同时保持自动尺寸与既有参数文件完全兼容。

**架构：** 在自定义布局数学模块集中解析尺寸模式、实际托盘尺寸和固定上沿可用区域。模型、报价、导出、草稿摘要和视口都消费这一个计算来源；画布碰撞模型以可选边界校验器承载固定模式越界状态，其他模式不传该校验器。

**技术栈：** Next.js、React、TypeScript、Vitest、JSCAD、Testing Library。

---

### 任务 1：数据契约、参数归一化与实际托盘尺寸

**文件：**

- 修改：`src/types/custom-tray.ts`
- 修改：`src/lib/custom-config.ts`
- 修改：`src/lib/custom-layout-math.ts`
- 修改：`src/lib/custom-layout-actions.ts`
- 修改：`src/lib/param-normalization.ts`
- 测试：`src/lib/custom-layout-math.test.ts`
- 测试：`src/lib/param-normalization.test.ts`

- [ ] 先在 `custom-layout-math.test.ts` 写失败测试：缺失模式解析为 `auto`；固定模式返回原始 `trayWidth/trayDepth`；自动模式仍从凹槽和边界间距派生尺寸；固定可用区域按侧面斜面、圆角与边界间距向内收缩。
- [ ] 运行 `pnpm test -- src/lib/custom-layout-math.test.ts src/lib/param-normalization.test.ts`，确认新断言失败。
- [ ] 在 `CustomLayoutParams` 增加 `traySizingMode?: "auto" | "fixed"`；在默认参数中写入 `"auto"`，将自定义长度和宽度下限改为 `10`、步进改为 `0.1`。
- [ ] 在 `custom-layout-math.ts` 增加 `resolveCustomTraySizingMode(params)`、`calculateCustomTrayFootprint(params)` 与固定上沿轮廓/槽位边界检测 helper；自动分支保留现有有效底板计算，固定分支返回配置的底部外尺寸。
- [ ] 在 `updateCustomLayoutParam` 中只更新模式字段，不移动 `slots`、不改写长度宽度。
- [ ] 在 `clampAndFillCustomDerivedFields` 中把非 `"fixed"` 值归一化为 `"auto"`，并使用新的 `10–5000`、`0.1mm` 限制钳制长度和宽度。
- [ ] 重新运行上述两个测试文件，确认通过。
- [ ] 提交：`git commit -m "feat: 增加自定义托盘尺寸模式"`。

### 任务 2：模型、报价、导出与草稿摘要统一实际尺寸

**文件：**

- 修改：`src/lib/custom-tray-model.ts`
- 修改：`src/lib/custom-layout-service.ts`
- 修改：`src/hooks/useCustomLayout.ts`
- 修改：`src/lib/pricing.ts`
- 修改：`src/lib/draft-summary.ts`
- 测试：`src/lib/custom-tray-model.test.ts`
- 测试：`src/lib/custom-layout-service.test.ts`
- 测试：`src/lib/pricing.test.ts`
- 测试：`src/lib/local-drafts.test.ts`

- [ ] 写失败测试：固定模式模型边界等于固定外尺寸，凹槽相对左下角坐标不被内容中心重置，空白固定托盘可生成；固定模式报价、文件名和草稿摘要使用设置的长度宽度；自动模式旧断言保持不变。
- [ ] 运行 `pnpm test -- src/lib/custom-tray-model.test.ts src/lib/custom-layout-service.test.ts src/lib/pricing.test.ts src/lib/local-drafts.test.ts`，确认失败点只涉及新模式。
- [ ] 将 `createCustomTrayModel` 改为消费 `calculateCustomTrayFootprint`：自动模式保留内容中心归一化，固定模式将槽位坐标直接映射到固定底板的左下角坐标系。
- [ ] 将 `calculateCustomTrayDimensions`、`calculateCustomPrice`、`getCustomSTLFilename`、`exportCustomModelFiles` 与 `buildCustomDraftSummary` 改为消费统一实际尺寸；固定空白托盘仍由模型生成，报价继续通过无凹槽守卫返回 `0`。
- [ ] 更新 `useCustomLayout` 导出调用，不再把只适用于自动模式的 `effectiveDimensions` 当作固定模式文件名来源。
- [ ] 重新运行上述四个测试文件，确认通过。
- [ ] 提交：`git commit -m "feat: 固定托盘尺寸贯通模型与业务数据"`。

### 任务 3：固定模式画布可用区域与越界状态

**文件：**

- 修改：`src/viewports/layout-editor/types.ts`
- 修改：`src/viewports/layout-editor/customViewportModel.ts`
- 修改：`src/lib/canvas-collision-model.ts`
- 修改：`src/components/LayoutCanvas.tsx`
- 修改：`src/components/canvas/CanvasOverlayLayer.tsx`
- 修改：`src/components/canvas/CanvasStatusBar.tsx`
- 测试：`src/lib/canvas-collision-model.test.ts`
- 测试：`src/components/LayoutCanvas.test.tsx`
- 测试：`src/components/canvas/canvas-components.test.tsx`

- [ ] 写失败测试：固定模式将槽位直边越界与圆角越界写入 `boundaryReasons`；每个越界槽位只增加一个错误计数；自动模式不增加边界错误；固定画布显示可用区域而不显示有效底板；状态栏/角落提示显示越界槽位数。
- [ ] 运行 `pnpm test -- src/lib/canvas-collision-model.test.ts src/components/LayoutCanvas.test.tsx src/components/canvas/canvas-components.test.tsx`，确认失败。
- [ ] 在视口 `trayFrame` 中增加可选固定尺寸边界描述，只由自定义固定模式传入；自动模式、简易阶梯与阶梯模式保持当前字段值。
- [ ] 扩展 `buildCanvasCollisionState` 的 options，接收每槽边界原因回调；初始化后把固定模式越界原因写入 `collisionMap`，并将越界槽位数累加至 `collisionErrorCount`。
- [ ] 在 `LayoutCanvas` 使用固定模式的真实上沿轮廓校验器，禁止显示动态有效底板框，改用固定 `trayWidth/trayDepth` 判定打印尺寸警告；新增持续的越界槽位数量提示。
- [ ] 在 `CanvasOverlayLayer` 按现有外框样式绘制固定外轮廓，并绘制次级虚线的圆角可用区域；在 `CanvasStatusBar` 使用现有错误数显示越界。
- [ ] 重新运行上述三个测试文件，确认通过。
- [ ] 提交：`git commit -m "feat: 标记固定托盘凹槽越界"`。

### 任务 4：参数面板和模式交互

**文件：**

- 修改：`src/components/CustomPanel.tsx`
- 测试：`src/components/panels.test.tsx`
- 测试：`src/hooks/useCustomLayout.integration.test.ts`
- 测试：`src/viewports/layout-editor/customViewportModel.test.ts`

- [ ] 写失败测试：面板显示“自动 / 固定”尺寸模式切换；自动模式不显示长度宽度编辑控件；固定模式显示 `10–5000mm`、`0.1mm` 精度的长度和宽度输入；切换模式不会发出槽位位置更新；固定视口投影关闭有效底板框并传入固定边界。
- [ ] 运行 `pnpm test -- src/components/panels.test.tsx src/hooks/useCustomLayout.integration.test.ts src/viewports/layout-editor/customViewportModel.test.ts`，确认失败。
- [ ] 在 `CustomPanel` 顶部增加“托盘尺寸”区，使用现有 `Switch`、`ParamSlider` 与 `CUSTOM_LIMITS.trayWidth/trayDepth`；固定模式才渲染长度宽度控件，统计信息继续使用统一实际尺寸。
- [ ] 保持新增凹槽策略不变，不增加画布拖拽改尺寸，不增加“按内容适配尺寸”按钮。
- [ ] 重新运行上述三个测试文件，确认通过。
- [ ] 提交：`git commit -m "feat: 添加固定托盘尺寸设置界面"`。

### 任务 5：完整回归与实现计划收尾

**文件：**

- 修改：`docs/superpowers/plans/2026-07-10-custom-fixed-tray-sizing.md`
- 测试：全部 `src` 测试与类型检查

- [ ] 运行 `pnpm typecheck`。
- [ ] 运行 `pnpm lint`。
- [ ] 运行 `pnpm test`。
- [ ] 若上述命令暴露由本功能引入的问题，补充最小修复和回归测试后重新运行失败命令。
- [ ] 在本计划中勾选实际完成的任务与步骤，并记录验证命令结果。
- [ ] 提交：`git commit -m "test: 验证固定托盘尺寸回归"`。
