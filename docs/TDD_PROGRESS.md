# TDD 改造进度日志

## 维护规则
- 后续每次推进 TDD，都在“进度记录”最上方新增一条记录。
- 只记录已经落地且已验证的进展，不记录计划中的动作。
- 每条记录至少包含：日期、范围、改动摘要、验证命令、覆盖率影响、当前判断、下一步。
- 如果某次改进主要依赖集成测试验证，需要明确写出来，避免把集成验证误写成单元覆盖。

## 当前判断
- 项目的 TDD 基础设施已经齐备：`vitest`、`jsdom`、统一测试初始化、单测/集成拆分、覆盖率报告都已建立。
- 当前 TDD 改造对核心领域逻辑已经进入“中后段”，但对 hooks、UI 编排层和渲染层仍处于“前中段”。
- 已进入稳定 TDD 节奏的区域主要集中在 `src/lib`，尤其是 stepped layout/model、pricing、draft、grid/custom layout service、`outline-geometry`、`stepped-outline-preview`、`stepped-tray-model`、`tray-model`、`custom-tray-model`、`stl-export`、`jscad-to-three`，以及 worker service / worker 入口链路。
- 高价值 UI 面板里，`SteppedPanel` 已经进入有意义的 TDD 主循环，`ParameterPanel` 与 `SimpleSteppedPanel` 的边界状态也开始被回归覆盖；当前最大的空白点主要剩下 hooks 编排层统计缺口，以及更大范围的 UI 包装层。

## 本次基线快照
- 日期：2026-04-13
- 源码文件数：94
- 测试文件数：47
- graphify god node 与测试映射：
  - `TrayWorkerService`：已由 `src/lib/worker/worker-service.test.ts` 覆盖
  - `createDraft()` / `updateDraft()` / `readIndex()`：已由 `src/lib/local-drafts.test.ts` 覆盖
  - `deriveSimpleSteppedLayout()`：已由 `src/lib/simple-stepped-layout.test.ts` 覆盖
  - `generateOutlineGeom2()`：已由 `src/lib/outline-geometry.test.ts` 覆盖核心公共路径

## 验证基线
- `npm run test:unit`
  - 结果：41 个测试文件通过，153 个测试通过
- `npm run test:integration`
  - 结果：6 个测试文件通过，28 个测试通过
- `npm run test:coverage`
  - 结果：statements 62.13%，branches 55.63%，functions 60.25%，lines 62.43%

## 覆盖率解读
- `src/lib` 是当前 TDD 改造主战场。高价值且覆盖较强的模块包括：
  - `grid-model-service.ts`、`custom-layout-service.ts`、`simple-stepped-layout.ts`、`simple-stepped-tray-model.ts`
  - `stepped-connectivity.ts`、`stepped-bridge-warning.ts`、`stepped-global-optimize.ts`
  - `outline-geometry.ts`、`stepped-outline-preview.ts`、`stepped-tray-model.ts`
  - `tray-model.ts`、`custom-tray-model.ts`
  - `stl-export.ts`、`jscad-to-three.ts`
  - `pricing.ts`、`local-drafts.ts`、`worker-service.ts`、`tray.worker.ts`
- `src/hooks` 实际已有一批有价值的集成测试，但当前覆盖率命令排除了 `*.integration.test.ts`，所以 hooks 在覆盖率报告里表现为 `0%`，这个数字低估了真实验证进度。
- `src/components` 对 `LayoutCanvas`、`TrayViewer`、`SteppedDraftDialog` 和部分 canvas 面板已有回归保护，但多数面板组件和 UI 包装层还没有进入稳定 TDD 闭环。

## 高优先级缺口
- 尚未被直接计入覆盖率的 hook 编排层：
  - `src/hooks/useCanvasZoom.ts`
  - `src/hooks/useCanvasKeyboard.ts`
  - `src/hooks/useUndoHistory.ts`
  - `src/hooks/useActionPanelResize.ts`
  - `src/hooks/useLiveSlotUpdates.ts`
- 仍未进入 TDD 主循环的 UI / panel 层：
  - `src/components/SteppedPanel.tsx`
  - `src/components/ParameterPanel.tsx`
  - `src/components/SimpleSteppedPanel.tsx`
  - `src/components/ui/` 下的大部分文件

## 下一波 TDD 建议
1. 继续沿高价值 UI 面板推进，优先补 `ParameterPanel` 和 `SimpleSteppedPanel` 里仍未覆盖的状态分支，或者转向 `LayoutCanvas` / `TrayViewer` 这类用户可感知度更高的交互面。
2. 调整覆盖率策略，让 hook 集成测试能在进度统计里被看见，或者单独建立一份 hooks 集成覆盖基线。
3. 如果继续深挖 worker，可以补 `GENERATE_SIMPLE_STEPPED` 分支，完成 `tray.worker.ts` 的剩余未覆盖路径。
4. 如果想继续做 `lib` 层扫尾，可补 `download-port.ts`、`id-factory.ts` 这类剩余轻量桥接文件。

## 进度记录

### 2026-04-13 - 补齐下载与 ID 桥接测试
- 范围：继续推进 `lib` 层扫尾 TDD，将 `download-port.ts` 与 `id-factory.ts` 这两个轻量桥接文件纳入单测闭环。
- 改动摘要：
  - 新增 `src/lib/download-port.test.ts`，覆盖 Blob URL 创建、临时锚点挂载、下载文件名透传、点击触发，以及 DOM / URL 清理回收。
  - 新增 `src/lib/id-factory.test.ts`，覆盖 `randomIdFactory.createId()` 对 `crypto.randomUUID()` 的代理行为。
  - 对下载测试显式 mock 了 `HTMLAnchorElement.prototype.click()`，避免 jsdom 导航噪声污染全量测试输出。
  - 通过这组测试把两个长期显示为 `0%` 的桥接文件从 coverage 空洞里清掉。
- 验证命令：
  - `npx vitest run src/lib/download-port.test.ts src/lib/id-factory.test.ts`
  - `npm run test:unit`
  - `npm run test:coverage`
  - `npm run lint`
- 覆盖率影响：
  - 总 statements 从 `66.91%` 提升到 `67.16%`
  - `lib` 整体从 `87.43%` 提升到 `87.93%` statements
  - `src/lib/download-port.ts` 达到 `100%` statements / `100%` branches
  - `src/lib/id-factory.ts` 达到 `100%` statements / `100%` branches
- 当前判断：
  - `lib` 层剩余的轻量桥接空白已经进一步收缩，当前更值得继续推进的目标重新回到 `LayoutCanvas` 一类用户可感知交互面，或者更大体量的 mode hooks。
  - 当前 coverage 里的明显 “低成本高收益” 空白已经越来越少，后续单次增量会更依赖复杂交互和编排层测试。
- 下一步：
  - 优先补 `LayoutCanvas` / `TrayViewer` 的高价值交互回归，或者转向 `useTrayModel.ts` / `useCustomLayout.ts` 这类 mode hooks 的覆盖可见性。

### 2026-04-13 - 补齐 useCanvasZoom 手势与缩放测试
- 范围：继续推进 hooks 编排层 TDD，将 `useCanvasZoom.ts` 的滚轮缩放、双指手势和 viewBox 推导纳入 unit coverage。
- 改动摘要：
  - 新增 `src/hooks/useCanvasZoom.test.ts`，覆盖初始 `viewBox`、`adjustZoom()` 钳制、`setPan()` 对可视窗口的联动，以及 `resetZoom()` 回归默认状态。
  - 补充滚轮缩放测试，覆盖 `ctrl/meta` 手势时的 `preventDefault()` 路由，以及缩放增减后回到基准值的行为。
  - 补充双指 pinch / pan 测试，覆盖触摸开始建档、移动时的缩放与平移联动，以及 `handleTouchEnd()` 之后忽略后续 move 的路径。
  - 通过这组测试把 `LayoutCanvas` 依赖的核心缩放 hook 从 coverage 空白项推进到稳定可回归状态。
- 验证命令：
  - `npx vitest run src/hooks/useCanvasZoom.test.ts`
  - `npm run test:unit`
  - `npm run test:coverage`
  - `npm run lint`
- 覆盖率影响：
  - 总 statements 从 `65.71%` 提升到 `66.91%`
  - `hooks` 整体从 `15.95%` 提升到 `21.31%` statements，branches 提升到 `26.74%`
  - `src/hooks/useCanvasZoom.ts` 达到 `100%` statements / `91.66%` branches / `100%` lines
- 当前判断：
  - 画布交互编排层里最核心的一条缩放 / 手势链路已经进入 unit-level 回归面，`LayoutCanvas` 的高频交互风险进一步下降。
  - hooks 层剩余的主要空白已经更多集中在体量更大的 mode hooks，以及 coverage 统计仍未计入的 integration-only 路径。
- 下一步：
  - 继续补 `LayoutCanvas` 的高价值交互回归，或者转向 `download-port.ts`、`id-factory.ts` 这类轻量桥接文件做 `lib` 层扫尾。

### 2026-04-13 - 补齐 hooks 编排层基础单测
- 范围：继续推进 hooks 编排层 TDD，将键盘交互、撤销历史、侧栏缩放和 live update 批处理拉入 unit coverage。
- 改动摘要：
  - 新增 `src/hooks/useCanvasKeyboard.test.ts`，覆盖方向键微调、可编辑目标忽略、复制粘贴、删除、撤销、Escape 清空与快捷键提示切换。
  - 新增 `src/hooks/useActionPanelResize.test.ts`，覆盖拖拽宽度钳制、`pointerup` / `pointercancel` 清理，以及页面隐藏时终止 resize 的行为。
  - 新增 `src/hooks/useUndoHistory.test.ts` 与 `src/hooks/useLiveSlotUpdates.test.ts`，覆盖连续操作合并窗口、强制入栈、50 条历史上限、RAF 批处理、立即 flush 和卸载清理。
  - 通过这组测试把此前在覆盖率统计里几乎不可见的 hooks 编排层，拉进了可量化、可回归的单测闭环。
- 验证命令：
  - `npx vitest run src/hooks/useUndoHistory.test.ts src/hooks/useLiveSlotUpdates.test.ts src/hooks/useActionPanelResize.test.ts src/hooks/useCanvasKeyboard.test.ts`
  - `npm run test:unit`
  - `npm run test:coverage`
- 覆盖率影响：
  - 总 statements 从 `62.13%` 提升到 `65.71%`
  - `hooks` 整体从 `0%` 提升到 `15.95%` statements，branches 提升到 `23.4%`
  - `src/hooks/useCanvasKeyboard.ts` 达到 `95.77%` statements / `84.61%` branches
  - `src/hooks/useActionPanelResize.ts` 达到 `97.43%` statements / `66.66%` branches
  - `src/hooks/useLiveSlotUpdates.ts` 达到 `93.54%` statements / `78.57%` branches
  - `src/hooks/useUndoHistory.ts` 达到 `100%` statements / `100%` branches
- 当前判断：
  - hooks 层终于不再完全依赖 integration tests 才能被验证，部分高频交互编排已经进入 unit-level 回归面。
  - `useCanvasZoom.ts` 以及更大体量的 mode hooks 仍未被当前 coverage 统计看见，hooks 层还有明显纵深可挖。
- 下一步：
  - 优先补 `useCanvasZoom.ts`，或者继续向 `LayoutCanvas` 这种 hook 编排承载点补一轮用户可感知交互回归。

### 2026-04-13 - 补齐网格与简易阶梯面板边界状态测试
- 范围：继续推进高价值 UI 面板 TDD，补 `ParameterPanel` 与 `SimpleSteppedPanel` 的边界状态。
- 改动摘要：
  - 在 `src/components/panels.test.tsx` 中新增 `ParameterPanel` 的超限状态测试，覆盖超出锻造极限提示、已生成体积的耗材显示，以及自动预览在超限时的 `isBlocked` 路由。
  - 新增 `SimpleSteppedPanel` 的禁用态测试，覆盖未选中行时的添加凹槽禁用、不可 Trim 时的禁用态，以及尺寸超限时主按钮和提示文案的回归。
  - 通过这组测试把两个面板从“正常操作能走通”推进到“边界状态不回退”的层次。
- 验证命令：
  - `npx vitest run src/components/panels.test.tsx`
  - `npm run test:unit`
  - `npm run test:coverage`
- 覆盖率影响：
  - 总 statements 从 `62.1%` 提升到 `62.13%`
  - `src/components/ParameterPanel.tsx` 的 branches 从 `60%` 提升到 `76.66%`
  - `src/components/SimpleSteppedPanel.tsx` 的 branches 从 `68.42%` 提升到 `84.21%`
- 当前判断：
  - 高价值面板已经不只覆盖“可点击路径”，开始覆盖真实使用中容易回退的超限、禁用和阻断状态。
  - 当前 UI 层更值得继续深挖的目标，已经逐步转向 `LayoutCanvas`、`TrayViewer` 和更复杂的交互容器。
- 下一步：
  - 在 `LayoutCanvas` 或 `TrayViewer` 中继续补一轮高价值交互回归，或者转向 hooks 覆盖率统计可见性。

### 2026-04-13 - 补齐 SteppedPanel 状态交互测试
- 范围：继续推进高价值 UI 面板 TDD，优先补 `SteppedPanel` 的状态型交互。
- 改动摘要：
  - 在 `src/components/panels.test.tsx` 中新增 `SteppedPanel` 的组预览切换测试，覆盖 pointer 按住预览、释放恢复、键盘锁定预览与取消锁定。
  - 新增 bridge warning 与草稿操作测试，覆盖桥接预警文案显示、`更新草稿` 和 `草稿列表` 两个草稿动作按钮的回调路由。
  - 通过这组测试把 `SteppedPanel` 从“基础动作可点”推进到“关键状态转换可回归”的层次。
- 验证命令：
  - `npx vitest run src/components/panels.test.tsx`
  - `npm run test:unit`
  - `npm run test:coverage`
- 覆盖率影响：
  - 总 statements 从 `61.56%` 提升到 `62.1%`
  - `src/components/SteppedPanel.tsx` 从 `48.57%` 提升到 `65.71%` statements
  - `components` 整体从 `59.47%` 提升到 `62.95%` statements
- 当前判断：
  - `SteppedPanel` 已开始进入有意义的 TDD 主循环，不再只是覆盖基础点击路径。
  - UI 层接下来的高价值目标更适合放在 `ParameterPanel`、`SimpleSteppedPanel` 的剩余状态分支，以及 hooks 统计可见性。
- 下一步：
  - 在 `ParameterPanel` 或 `SimpleSteppedPanel` 中继续补一轮状态分支与禁用态回归测试。

### 2026-04-13 - 补齐导出与渲染桥接测试
- 范围：将 `stl-export.ts` 与 `jscad-to-three.ts` 纳入单测闭环。
- 改动摘要：
  - 新增 `src/lib/stl-export.test.ts`，覆盖 STL 序列化、浏览器下载触发、Blob URL 回收，以及 grid/custom/simple-stepped 三类文件名生成规则。
  - 新增 `src/lib/jscad-to-three.test.ts`，覆盖 cuboid 到 Three.js `BufferGeometry` 的转换结果、位置/法线属性生成、包围盒计算和法线归一化。
  - 通过这组测试把导出 / 渲染桥接链路带入回归面，减少 UI 层调用这些公共接口时的隐性风险。
- 验证命令：
  - `npx vitest run src/lib/stl-export.test.ts`
  - `npx vitest run src/lib/jscad-to-three.test.ts`
  - `npm run test:unit`
  - `npm run test:coverage`
- 覆盖率影响：
  - 总 statements 从 `59.45%` 提升到 `61.56%`
  - `src/lib/stl-export.ts` 达到 `100%` statements / `100%` lines
  - `src/lib/jscad-to-three.ts` 达到 `97.64%` statements / `100%` lines
- 当前判断：
  - `lib` 层核心建模、协议、导出和渲染桥接链路已经基本进入 TDD 主循环。
  - 当前最值得继续推进的区域已经明显转向高价值 UI 面板和 hooks 统计可见性。
- 下一步：
  - 从 `SteppedPanel`、`ParameterPanel`、`SimpleSteppedPanel` 中选一个高价值面板继续推进。

### 2026-04-13 - 补齐 worker 入口边界测试
- 范围：将 `tray.worker.ts` 纳入单测闭环。
- 改动摘要：
  - 新增 `src/lib/worker/tray.worker.test.ts`，覆盖 grid 生成成功、stepped 调试日志分支、outline preview 耗时回传、STL 导出响应、异常错误回传。
  - 通过模块 mock 将测试聚焦在 worker 运行时协议和消息分发，不把断言耦合到底层建模实现。
- 验证命令：
  - `npx vitest run src/lib/worker/tray.worker.test.ts`
  - `npm run test:unit`
  - `npm run test:coverage`
- 覆盖率影响：
  - 总 statements 从 `58.75%` 提升到 `59.45%`
  - `src/lib/worker/tray.worker.ts` 达到 `91.17%` statements / `91.17%` lines
  - `lib/worker` 整体达到 `87.61%` statements / `88.18%` lines
- 当前判断：
  - worker service 和 worker 入口两端都已进入 TDD 主循环。
  - `lib` 层剩余的高价值空白点已经更多集中在导出 / 渲染桥接链路，而不是核心建模与协议层。
- 下一步：
  - 优先在高价值 UI 面板、hooks 统计可见性、以及 `stl-export.ts` / `jscad-to-three.ts` 中选一条继续推进。

### 2026-04-13 - 补齐网格与自定义托盘模型测试
- 范围：将 `tray-model` 与 `custom-tray-model` 纳入单测闭环。
- 改动摘要：
  - 新增 `src/lib/tray-model.test.ts`，覆盖网格模式的间距轴推导、边界间距推导、外形尺寸计算、启用底板磁吸孔后的体积与边界回归。
  - 新增 `src/lib/custom-tray-model.test.ts`，覆盖自定义模式的空槽位尺寸回退、旋转槽位边界推导、启用底板磁吸孔后的体积与边界回归。
  - 通过这组测试把通用模型装配链路和 `model-utils` 的公共行为一并带入回归面。
- 验证命令：
  - `npx vitest run src/lib/tray-model.test.ts`
  - `npx vitest run src/lib/custom-tray-model.test.ts`
  - `npm run test:unit`
  - `npm run test:coverage`
- 覆盖率影响：
  - 总 statements 从 `56.98%` 提升到 `58.75%`
  - `src/lib/tray-model.ts` 达到 `100%` statements / `100%` lines
  - `src/lib/custom-tray-model.ts` 达到 `100%` statements / `100%` lines
  - `src/lib/model-utils.ts` 达到 `89.47%` statements / `100%` lines
- 当前判断：
  - 核心模型装配链路已经基本进入 TDD 主循环。
  - 当前主要风险面已经转向 `tray.worker.ts`、hooks 统计可见性，以及高价值 UI 面板。
- 下一步：
  - 从 `src/lib/worker/tray.worker.ts` 开始补 worker 入口边界测试。

### 2026-04-13 - 补齐阶梯托盘装配模型测试
- 范围：将 `stepped-tray-model` 纳入单测闭环。
- 改动摘要：
  - 新增 `src/lib/stepped-tray-model.test.ts`，覆盖空输入时的占位实体、基于槽位边界的尺寸推导、分组最低高度钳制、孔深变化对体积的影响。
  - 通过公共接口测试把 `createSteppedTrayModel()` 和 `calculateSteppedTrayDimensions()` 拉入回归面，而不把测试耦合到内部实现细节。
- 验证命令：
  - `npx vitest run src/lib/stepped-tray-model.test.ts`
  - `npm run test:unit`
  - `npm run test:coverage`
- 覆盖率影响：
  - 总 statements 从 `54.62%` 提升到 `56.98%`
  - `src/lib/stepped-tray-model.ts` 达到 `92.03%` statements / `92.3%` lines
- 当前判断：
  - 阶梯模式已经把“几何生成 -> 预览装配 -> 3D 装配模型”这一整条主链路拉进了 TDD 主循环。
  - 当前最大的模型层缺口已经收敛到 `tray-model.ts` 和 `custom-tray-model.ts`。
- 下一步：
  - 在 `tray-model.ts` 与 `custom-tray-model.ts` 中优先挑一条继续补装配层回归测试。

### 2026-04-13 - 补齐几何与预览链路测试
- 范围：将 `outline-geometry` 与 `stepped-outline-preview` 纳入单测闭环。
- 改动摘要：
  - 新增 `src/lib/outline-geometry.test.ts`，覆盖空输入、负平滑半径钳制、单圆平滑保持原始半径、多轮廓取最大面积、退化回退路径、点列转换接口。
  - 新增 `src/lib/stepped-outline-preview.test.ts`，覆盖空数据返回 `null`、分组结果按高度排序、低组轮廓包含高组槽位包络的预览装配行为。
  - 通过本次补测，`generateOutlineGeom2()` 对外主路径和 `buildSteppedOutlinePreview()` 的关键装配路径已进入可回归状态。
- 验证命令：
  - `npx vitest run src/lib/outline-geometry.test.ts`
  - `npx vitest run src/lib/stepped-outline-preview.test.ts`
  - `npm run test:unit`
  - `npm run test:coverage`
- 覆盖率影响：
  - 总 statements 从 `47.18%` 提升到 `54.62%`
  - `src/lib/outline-geometry.ts` 达到 `86.14%` statements / `92%` lines
  - `src/lib/stepped-outline-preview.ts` 达到 `95.45%` statements / `95.12%` lines
- 当前判断：
  - 几何核心与预览装配链路已经基本进入 TDD 主循环。
  - 当前最值得继续推进的风险面已经下移到 tray model 装配链路和 worker 入口。
- 下一步：
  - 继续从 `src/lib/stepped-tray-model.ts`、`src/lib/tray-model.ts`、`src/lib/custom-tray-model.ts` 中挑一条装配链路推进。

### 2026-04-13 - 基线盘点
- 范围：检查当前 TDD 改造状态，并建立长期记录文件。
- 改动摘要：
  - 读取了 graphify 摘要、项目结构、测试分布和近期提交。
  - 执行了单测、集成测试和覆盖率命令，建立可量化基线。
  - 新建本文件，作为后续 TDD 进展的唯一记录入口。
- 验证命令：
  - `npm run test:unit`
  - `npm run test:integration`
  - `npm run test:coverage`
- 当前判断：
  - 核心领域逻辑已经进入有意义的 TDD 闭环。
  - hook 编排层和 UI 组合层还没有达到同等严格度。
  - 现有覆盖率报告低估了 hooks 进展，因为集成测试没有计入当前覆盖率统计。
- 下一步：
  - 从 `src/lib/outline-geometry.ts` 和预览/模型装配链路开始下一轮 TDD 推进。

### 记录模板
- 日期：
- 范围：
- 改动摘要：
- 验证命令：
- 覆盖率影响：
- 当前判断：
- 下一步：
