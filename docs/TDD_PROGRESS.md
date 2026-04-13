# TDD 改造进度日志

## 维护规则
- 后续每次推进 TDD，都在“进度记录”最上方新增一条记录。
- 只记录已经落地且已验证的进展，不记录计划中的动作。
- 每条记录至少包含：日期、范围、改动摘要、验证命令、覆盖率影响、当前判断、下一步。
- 如果某次改进主要依赖集成测试验证，需要明确写出来，避免把集成验证误写成单元覆盖。

## 当前判断
- 项目的 TDD 基础设施已经齐备：`vitest`、`jsdom`、统一测试初始化、单测/集成拆分、覆盖率报告都已建立。
- 当前 TDD 改造对核心领域逻辑已经进入“中后段”，但对 hooks、UI 编排层和渲染层仍处于“前中段”。
- 已进入稳定 TDD 节奏的区域主要集中在 `src/lib`，尤其是 stepped layout/model、pricing、draft、grid/custom layout service、`outline-geometry`、`stepped-outline-preview`、`stepped-tray-model`，以及 `TrayWorkerService`。
- 目前最大的空白点在 `tray-model` / `custom-tray-model`、worker 入口，以及大部分组件面板和 UI 包装层。

## 本次基线快照
- 日期：2026-04-13
- 源码文件数：94
- 测试文件数：42
- graphify god node 与测试映射：
  - `TrayWorkerService`：已由 `src/lib/worker/worker-service.test.ts` 覆盖
  - `createDraft()` / `updateDraft()` / `readIndex()`：已由 `src/lib/local-drafts.test.ts` 覆盖
  - `deriveSimpleSteppedLayout()`：已由 `src/lib/simple-stepped-layout.test.ts` 覆盖
  - `generateOutlineGeom2()`：已由 `src/lib/outline-geometry.test.ts` 覆盖核心公共路径

## 验证基线
- `npm run test:unit`
  - 结果：36 个测试文件通过，133 个测试通过
- `npm run test:integration`
  - 结果：6 个测试文件通过，28 个测试通过
- `npm run test:coverage`
  - 结果：statements 56.98%，branches 52.37%，functions 58.02%，lines 57.1%

## 覆盖率解读
- `src/lib` 是当前 TDD 改造主战场。高价值且覆盖较强的模块包括：
  - `grid-model-service.ts`、`custom-layout-service.ts`、`simple-stepped-layout.ts`、`simple-stepped-tray-model.ts`
  - `stepped-connectivity.ts`、`stepped-bridge-warning.ts`、`stepped-global-optimize.ts`
  - `outline-geometry.ts`、`stepped-outline-preview.ts`、`stepped-tray-model.ts`
  - `pricing.ts`、`local-drafts.ts`、`worker-service.ts`
- `src/hooks` 实际已有一批有价值的集成测试，但当前覆盖率命令排除了 `*.integration.test.ts`，所以 hooks 在覆盖率报告里表现为 `0%`，这个数字低估了真实验证进度。
- `src/components` 对 `LayoutCanvas`、`TrayViewer`、`SteppedDraftDialog` 和部分 canvas 面板已有回归保护，但多数面板组件和 UI 包装层还没有进入稳定 TDD 闭环。

## 高优先级缺口
- 托盘模型装配链路：
  - `src/lib/tray-model.ts`
  - `src/lib/custom-tray-model.ts`
- worker 运行时边界：
  - `src/lib/worker/tray.worker.ts`
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
1. 沿着这次刚补齐的几何/预览/装配链路继续向下推进，优先覆盖 `tray-model.ts` 与 `custom-tray-model.ts`。
2. 为 `src/lib/worker/tray.worker.ts` 增加运行时边界测试，补齐目前只测 service、不测 worker 入口的缺口。
3. 优先给高价值面板补回归测试，例如 `SteppedPanel`、`ParameterPanel`、`SimpleSteppedPanel`，而不是先扩散到低价值 UI 原子组件。
4. 调整覆盖率策略，让 hook 集成测试能在进度统计里被看见，或者单独建立一份 hooks 集成覆盖基线。

## 进度记录

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
