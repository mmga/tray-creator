# 自定义阶梯模式 2D 编辑卡顿审查与优化计划

> 日期：2026-04-07
> 范围：`stepped` 模式下的 2D 编辑链路
> 说明：本次以静态代码审查为主，未接入浏览器 Profiler 实测数据
> 进展：Phase 0 所需的采样开关、状态栏指标、`20 / 50 / 100` 槽位压力样本已落地，测量流程见 `doc/stepped-2d-perf-measurement-guide.md`

## 1. 结论摘要

当前“自定义阶梯模式 2D 编辑卡顿”的高概率主因，不在 3D 生成或 STL 导出链路，而在 2D 编辑热路径本身：

- 拖拽/旋转时，槽位位置会在 `pointermove` 期间持续写回 React 状态。
- 每次状态变更都会带动 `page -> stepped hook -> LayoutCanvas -> SteppedPanel` 整条链路重新计算。
- `LayoutCanvas` 会在每次渲染中重复做多轮碰撞检测。
- `useSteppedLayout` 会在每次参数变更时同步重算分组轮廓预览，且轮廓生成使用了 JSCAD union / outline 提取，计算量明显高于普通 UI 派生值。
- 还存在一段当前没有被 UI 使用的 `bridgeWarning` 计算，属于纯消耗。

如果只做一个优先级最高的改动，建议先做：

1. 将拖拽中的“实时位置”从全局 `params` 状态中拆出去，改为画布本地临时态或 `requestAnimationFrame` 批量提交。
2. 在拖拽期间暂停或降级 `outlinePreview` / `bridgeWarning` 这类 stepped 专属派生计算。

## 2. 当前热路径

### 2.1 2D 编辑时并不会持续触发 3D 建模

`src/app/page.tsx` 中，`TrayViewer` 只在右侧切到 `3d` 时渲染；2D 编辑态主要渲染的是 `LayoutCanvas`。

- `src/app/page.tsx:148-197`

这意味着当前卡顿优先不应归因于 worker 中的 3D 建模。

### 2.2 拖拽时的主路径

当前 stepped 模式拖拽大致是下面这条链：

1. `LayoutCanvas.handlePointerMove` 持续触发位置更新。
2. 对单选/多选槽位逐个调用 `onUpdateSlot`。
3. `useSteppedLayout.updateSlotPosition` 每次都 `map` 整个 `slots` 数组并 `invalidatePreview`。
4. `page.tsx` 因 `steppedModel.params` 变化重新渲染。
5. `LayoutCanvas`、`SteppedPanel`、各种派生值重新计算。
6. stepped 专属的轮廓预览与桥接分析一起重跑。

这条路径解释了为什么“同样是 2D 编辑，阶梯模式会比普通 custom 模式更容易卡”。

## 3. 审查发现

### 3.1 [高优先级] 拖拽时按槽位逐个写回状态，放大了每帧成本

证据：

- `src/components/LayoutCanvas.tsx:351-510`
- `src/components/LayoutCanvas.tsx:503-506`
- `src/hooks/useSteppedLayout.ts:248-256`

问题点：

- `handlePointerMove` 在拖拽期间直接调用 `onUpdateSlot`。
- 多选拖拽时，`selectedIds.forEach(...)` 会为每个选中槽位各触发一次更新。
- `updateSlotPosition` 每次都会重新 `map` 整个 `slots` 数组并标记预览过期。

影响：

- 如果一次拖拽事件中选中了 `N` 个槽位，就可能发生 `N` 次 React 状态写入。
- 每次写入都可能触发整棵编辑树重渲染。
- 这会把“手势频率”直接放大成“状态更新频率 × 选中槽位数”。

结论：

- 这是当前最直接、最应该先收敛的热路径。

### 3.2 [高优先级] `LayoutCanvas` 在一次渲染里重复做多轮 O(n²) 碰撞计算

证据：

- `src/components/LayoutCanvas.tsx:282-305`
- `src/components/LayoutCanvas.tsx:683-695`
- `src/components/LayoutCanvas.tsx:856-889`
- `src/components/LayoutCanvas.tsx:1017-1048`

问题点：

- `checkSlotCollision` 会遍历所有槽位，并为每一对候选槽位构造多边形后做 SAT 检测。
- 同一轮渲染里，这套逻辑至少被重复使用了三次：
  - 计算 `collisionErrorCount`
  - 构造 `collisionMap`
  - 生成 collision connector lines

影响：

- 拖拽导致高频重渲染时，这三轮重复计算会叠加。
- 当前实现没有统一的“本帧碰撞结果缓存”，也没有 broad-phase 空间索引。
- 当槽位数量上来后，复杂度会非常快地恶化。

结论：

- 这是 2D 画布层最明显的计算热点。

### 3.3 [高优先级] stepped 专属 `outlinePreviewAuto` 在每次参数变化时同步重算

证据：

- `src/hooks/useSteppedLayout.ts:564-637`
- `src/lib/outline-geometry.ts`
- `src/lib/stepped-connectivity.ts`
- `src/app/page.tsx:169-190`
- `src/components/LayoutCanvas.tsx:1060-1078`

问题点：

- `outlinePreviewAuto` 依赖整个 `params`。
- 每次拖拽/旋转导致 `params` 改变时，都会重新：
  - 对每个 group 做 `slots.filter`
  - 计算高组上下文
  - 做 cluster 分组
  - 调用 `generateOutline(...)`
- `generateOutline` 内部并不是普通数组运算，而是包含 JSCAD 几何 union、outline 提取、内缩与重采样。

影响：

- 这部分开销是 stepped 模式独有的。
- 它很可能正是“普通 custom 还能接受，但 stepped 2D 明显卡顿”的关键差异项。

结论：

- 这段逻辑不应该和拖拽中的每一帧强绑定。

### 3.4 [高优先级] `bridgeWarning` 每次参数变化都重算，但当前没有消费者

证据：

- `src/hooks/useSteppedLayout.ts:639-686`
- 全局搜索 `bridgeWarning`，未发现 UI 侧消费

问题点：

- `bridgeWarning` 会重复遍历 `groups` / `slots`，并再次调用连通性分析。
- 但当前返回值没有被页面或面板使用。

影响：

- 属于 stepped 编辑链路中的纯浪费计算。
- 在拖拽高频更新下，会白白占用主线程时间。

结论：

- 这是非常适合立刻下掉或延后计算的“纯收益”项。

### 3.5 [中优先级] `SteppedPanel` 也会在拖拽期间参与整面板重渲染

证据：

- `src/app/page.tsx:92-114`
- `src/components/SteppedPanel.tsx:81-85`
- `src/components/SteppedPanel.tsx:152-155`
- `src/components/SteppedPanel.tsx:407-421`

问题点：

- `SteppedPanel` 与 `LayoutCanvas` 共用同一个 `steppedModel.params`。
- 拖拽时即使用户只操作画布，左侧面板也会跟着刷新。
- 面板中还包含多次 `params.slots.filter(...)` 的分组计数逻辑。

影响：

- 这不是最大热点，但会持续放大拖拽时的渲染开销。
- UI 越复杂，这部分额外成本越明显。

结论：

- 面板需要和高频画布编辑解耦，至少不要在每个 `pointermove` 上一起重渲。

### 3.6 [中优先级] `effectiveDimensions` 在 stepped hook 中存在依赖缺失

证据：

- `src/hooks/useSteppedLayout.ts:139-171`

问题点：

- `effectiveDimensions` 的 `useMemo` 只依赖 `calculateEffectiveDimensions`。
- 但 `calculateEffectiveDimensions` 自身不依赖 `params`，而是读 `paramsRef.current`。
- 结果是 `effectiveDimensions` 可能不会随着 `params` 变化而重新计算。

影响：

- 这是正确性问题，不一定是本次卡顿主因。
- 但它会影响尺寸统计、超限提示，以及后续性能验收时的判断可靠性。

结论：

- 建议作为顺手修复项纳入同一轮优化。

## 4. 优化目标

本轮优化建议以“2D 操作流畅度”作为唯一主目标，先不把精力分散到 3D 建模端。

建议目标：

- 20 个槽位：拖拽基本稳定在 60 FPS 附近，无明显黏滞。
- 50 个槽位：拖拽过程单帧主线程预算控制在 8-10ms 内。
- 100 个槽位：允许轻微掉帧，但不能出现明显输入延迟或鼠标/手指跟手性丢失。
- 轮廓预览可以允许“稍后更新”，但拖拽手感必须优先。

## 5. 分阶段优化计划

### Phase 0：先补观测，再动刀

目标：

- 在真正改结构前，把耗时点量化出来，避免误判。

建议动作：

- 在 `LayoutCanvas` 中给以下阶段加 `performance.mark/measure`：
  - `handlePointerMove`
  - collision 计算
  - slot 渲染数据准备
- 在 `useSteppedLayout` 中给以下逻辑单独计时：
  - `outlinePreviewAuto`
  - `bridgeWarning`
- 在 stepped 模式准备 20 / 50 / 100 槽位测试样本。
- 用 React Profiler 验证拖拽期间哪些组件在重复 commit。

产出：

- 一份真实耗时表，而不是只靠复杂度猜测。

### Phase 1：切断拖拽热路径对全局状态的强耦合

目标：

- 让拖拽中的每一帧不再直接驱动整个 `params` 树重渲。

建议动作：

- 为 `LayoutCanvas` 增加“临时交互态”：
  - 拖拽中的坐标存在本地 ref / state
  - `pointerup` 时再一次性提交到 `params`
- 多选拖拽统一走 `onUpdateMultipleSlots`，不要继续逐个 `onUpdateSlot`。
- 如果仍需实时提交，则至少用 `requestAnimationFrame` 合并同一帧内的更新。
- 旋转也采用相同策略，不要每次角度变化都全树同步。

预期收益：

- 这是体感提升最大的阶段。
- 先把“每个 pointermove 都带动整页刷新”降到最低。

### Phase 2：把碰撞检测改成“单次求值，多处复用”

目标：

- 一轮渲染内只算一次碰撞结果。

建议动作：

- 将 `collisionErrorCount`、`collisionMap`、connector lines 共用同一份碰撞结果。
- 预先生成 `pairCollisions` 或 `collisionGraph`，渲染阶段只消费结果。
- 增加 broad-phase：
  - 先按 AABB / bounding circle 过滤
  - 再对候选对做 SAT
- 如果槽位数量继续上升，再引入 spatial hash / uniform grid。
- 对 `getEllipsePolygon` 的结果按槽位 version 做缓存，避免同一槽位在一帧内重复生成多边形。

预期收益：

- 大幅降低 `LayoutCanvas` 的重复 CPU 消耗。

### Phase 3：把 stepped 专属重计算从拖拽热路径移走

目标：

- 轮廓预览和桥接分析不再阻塞手势流畅度。

建议动作：

- 拖拽期间暂停 `outlinePreviewAuto`，拖拽结束后再刷新。
- 或者为 `outlinePreviewAuto` 增加节流，例如 100-150ms 更新一次。
- `bridgeWarning` 因当前无 UI 消费，先移除实时计算；如果后续要展示，再改成按需计算。
- 如果 stepped 轮廓预览必须实时更新，优先考虑：
  - `startTransition`
  - worker 化
  - 或使用更轻量的近似轮廓作为交互态预览

预期收益：

- 这是 stepped 模式区别于 custom 模式的最大差异优化项。

### Phase 4：减少无关面板和衍生统计的跟随重渲染

目标：

- 让左侧面板不再为每次细小移动付出全额代价。

建议动作：

- 将 `SteppedPanel` 拆成更细颗粒的 memo 组件。
- 对 group slot count 先构建 `Map<groupId, count>`，不要在 render 中反复 `filter`。
- 将与拖拽无关的统计值做 memo 化，或只在提交后刷新。
- `CanvasStatusBar` 中按单选查找槽位的逻辑也可改为使用现成映射。

预期收益：

- 体感收益次于 Phase 1/2/3，但能让整体更稳定。

### Phase 5：修复正确性问题并建立回归基线

目标：

- 避免性能优化后留下错误数据或隐藏状态问题。

建议动作：

- 修复 `useSteppedLayout` 中 `effectiveDimensions` 的依赖问题。
- 补一组最小回归用例：
  - 拖拽后位置正确提交
  - 多选拖拽不会丢槽位
  - 拖拽结束后轮廓预览能恢复
  - group 预览与碰撞高亮结果不错误

## 6. 建议实施顺序

推荐顺序：

1. Phase 0：先测量，确认热点占比。
2. Phase 1：拆分拖拽临时态，统一多选批量更新。
3. Phase 3：暂停/节流 `outlinePreviewAuto`，移除无用 `bridgeWarning` 实时计算。
4. Phase 2：重构碰撞检测为单次求值。
5. Phase 4：处理左侧面板和次要渲染噪音。
6. Phase 5：补正确性修复和回归。

原因：

- Phase 1 + Phase 3 最有机会最快改善手感。
- 如果先做碰撞重构，但仍保留“拖拽中整页高频重渲 + 实时 JSCAD 轮廓生成”，体感改善可能不够明显。

## 7. 本轮不建议优先投入的方向

- 先优化 worker 内的 3D 建模
- 先优化 STL 导出
- 先优化视觉样式或 SVG 元素数量

原因：

- 当前代码表明 2D 编辑卡顿主要发生在主线程交互与 stepped 派生计算层，而不是 3D 生成链路。

## 8. 最小可执行版本

如果想先做一轮“小改动验证收益”，建议只做下面 4 项：

1. 多选拖拽改为单次 `onUpdateMultipleSlots` 提交。
2. 拖拽期间不实时提交 `params`，只在 `pointerup` 提交。
3. 拖拽期间暂停 `outlinePreviewAuto`。
4. 移除当前无消费者的 `bridgeWarning` 实时计算。

这 4 项的实现成本相对可控，而且非常接近当前卡顿主因。
