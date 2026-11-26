# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

这是一个基于 Next.js 的战锤微缩模型移动托盘（Movement Tray）参数化 3D 建模 Web 应用。用户通过调整参数实时预览 3D 模型，并可导出为 STL 文件用于 3D 打印。项目以静态导出方式部署。

## 常用命令

包管理器：**pnpm**

```bash
# 开发模式
pnpm dev

# 生产构建（静态导出到 out/）
pnpm build

# 启动生产服务器
pnpm start

# ESLint
pnpm lint
```

> 项目使用 Vitest 进行单元与集成测试，并同时使用 ESLint + TypeScript strict mode。

## 核心架构

### 五种建模模式

项目支持五种托盘建模模式，每种模式有独立的参数类型、建模逻辑和 UI 面板：

1. **Grid Mode（网格模式）**
   - 类型：`TrayParams` (src/types/tray.ts)
   - 建模：`createTrayModel()` (src/lib/tray-model.ts)
   - Hook：`useTrayModel()` (src/hooks/useTrayModel.ts)
   - UI：`ParameterPanel` (src/components/ParameterPanel.tsx)
   - 特点：规则网格排列的圆形凹槽

2. **Custom Mode（自定义布局）**
   - 类型：`CustomLayoutParams` (src/types/custom-tray.ts)
   - 建模：`createCustomTrayModel()` (src/lib/custom-tray-model.ts)
   - Hook：`useCustomLayout()` (src/hooks/useCustomLayout.ts)
   - UI：`CustomPanel` + `LayoutCanvas` (2D 编辑器)
   - 特点：自由放置圆形/椭圆形凹槽，支持旋转

3. **Base Converter Mode（底盘生成）**
   - 类型：`BaseConverterParams` (src/types/custom-tray.ts)
   - 建模：`createBaseConverterModel()` (src/lib/base-converter-model.ts)
   - Hook：`useBaseConverter()` (src/hooks/useBaseConverter.ts)
   - UI：`BaseConverterPanel` + `BaseConverterPreview`
   - 特点：普通底盘、简版六边孔与转换底盘，几何由参数快照重建

4. **Stepped Mode（自定义阶梯底座）**
   - 类型：`SteppedLayoutParams` (src/types/custom-tray.ts)
   - 建模：`createSteppedCadTrayModel()` (src/lib/stepped-cad-construction.ts)
   - Hook：`useSteppedLayout()` (src/hooks/useSteppedLayout.ts)
   - UI：`SteppedPanel` + `LayoutCanvas` (2D 编辑器)
   - 特点：每个凹槽有独立的生长高度，使用形态学闭运算生成平滑底座轮廓

5. **Storage Stepped Mode（阶梯收纳展示台）**
   - 类型：`StorageSteppedParams` (src/types/storage-stepped.ts)
   - 计划/校验：`deriveStorageSteppedPlan()`、`validateStorageSteppedParams()` (src/lib/storage-stepped-plan.ts)
   - 建模：`createStorageSteppedBodyModel()`、`createStorageSteppedTrayModel()` (src/lib/storage-stepped-model.ts)
   - Hook：`useStorageStepped()` (src/hooks/useStorageStepped.ts)
   - UI：`StorageSteppedPanel` + `StorageSteppedViewer` + `LayoutCanvas`（固定边界 2D 编辑）
   - 特点：三级空心主体 + 三块可互换整宽托盘；托盘总厚固定 6 mm，主体与托盘按零件指纹分别缓存

### 3D 建模流程

```
参数输入 → Web Worker → JSCAD 建模 → Three.js 渲染 → STL 导出
```

1. **Web Worker 架构** (src/lib/worker/)
   - `worker-service.ts`: 主线程服务，管理 Worker 通信
   - `tray.worker.ts`: Worker 线程，执行 JSCAD 建模计算
   - 目的：避免阻塞 UI 线程

2. **JSCAD 建模** (src/lib/)
   - 使用 `@jscad/modeling` 进行 CSG（构造实体几何）建模
   - 核心操作：布尔运算（union/subtract/intersect）、拉伸、变换
   - 公差管理：`getSlotTolerance()` (src/lib/config.ts)

3. **Three.js 渲染** (src/components/TrayViewer.tsx)
   - 使用 `@react-three/fiber` 和 `@react-three/drei`
   - 转换：`jscadToThreeGeometry()` (src/lib/jscad-to-three.ts)

4. **STL 导出** (src/lib/stl-export.ts)
   - 使用 `@jscad/stl-serializer` 生成二进制 STL

### 关键工具函数

- **model-utils.ts**: 共享建模工具（底板创建、磁吸孔减除）
- **outline-geometry.ts**: 阶梯模式的轮廓生成（形态学闭运算）
- **collision.ts**: 2D 编辑器的碰撞检测
- **config.ts**: 集中管理所有参数默认值、范围、公差、预设
- **param-io.ts**: 参数 JSON 导入/导出（含校验与钳位）
- **pricing.ts**: 报价计算逻辑

### 部署

项目使用静态导出 (`output: "export"`)，构建产物输出到 `out/` 目录。

### 状态管理

每种模式使用独立的自定义 Hook 管理状态：

- `useTrayModel()`: Grid 模式参数、几何体、体积、价格
- `useCustomLayout()`: Custom 模式参数、槽位管理、碰撞检测
- `useBaseConverter()`: 底盘生成参数与几何
- `useSteppedLayout()`: Stepped 模式参数、槽位管理
- `useStorageStepped()`: 收纳阶梯参数、三阶托盘编辑、按零件缓存、装配/提起/单件视图与导出

共享 Hook：
- `useUndoHistory()`: 撤销/重做功能
- `useCanvasZoom()`: 2D 编辑器缩放/平移
- `useCanvasKeyboard()`: 2D 编辑器键盘快捷键

### 配置管理原则

所有参数（默认值、范围、公差、预设）集中在 `src/lib/config.ts` 管理，避免硬编码：

- `DEFAULT_TRAY_PARAMS`: Grid 模式默认参数
- `CUSTOM_LAYOUT_DEFAULTS`: Custom 模式默认参数
- `STEPPED_LAYOUT_DEFAULTS`: Stepped 模式默认参数
- `STORAGE_STEPPED_INTERFACE_DEFAULTS` / `STORAGE_STEPPED_HEIGHT_SPECS`: 收纳阶梯接口与高度规格
- `STORAGE_STEPPED_TRAY_PRESETS`: 收纳托盘五个预设
- `BASE_PRESETS`: 从共享圆形 Slot Definitions 派生的底座直径选项
- `ELLIPSE_PRESETS`: 椭圆形凹槽预设
- `PARAM_CONFIG` / `CUSTOM_LIMITS` / `STEPPED_LIMITS` / `STORAGE_STEPPED_LIMITS`: 参数范围与元数据
- `RENDER_CONFIG`: 3D 渲染配置（细分段数、颜色、摄像机）

路径别名：`@/*` → `./src/*`

## 技术栈

- **框架**: Next.js 16 (App Router, 静态导出)
- **UI**: shadcn/ui + Tailwind CSS v4
- **3D 建模**: @jscad/modeling v2.x
- **3D 渲染**: Three.js + @react-three/fiber + @react-three/drei
- **STL 导出**: @jscad/stl-serializer v2.x
- **语言**: TypeScript 5

## 项目结构

```
src/
├── app/                    # Next.js App Router
│   ├── page.tsx           # 主应用页面
│   └── layout.tsx         # 根布局
├── components/            # React 组件
│   ├── ui/               # shadcn/ui 基础组件
│   ├── canvas/           # 2D 编辑器相关组件
│   ├── ParameterPanel.tsx    # Grid 模式参数面板
│   ├── CustomPanel.tsx       # Custom 模式参数面板
│   ├── BaseConverterPanel.tsx # 底盘生成参数面板
│   ├── SteppedPanel.tsx      # Stepped 模式参数面板
│   ├── StorageSteppedPanel.tsx  # 收纳阶梯参数面板
│   ├── StorageSteppedViewer.tsx # 收纳阶梯装配/单件预览
│   ├── LayoutCanvas.tsx      # 2D 编辑器画布
│   ├── TrayViewer.tsx        # 3D 预览视口
│   └── ModeTabs.tsx          # 模式切换标签
├── hooks/                 # 自定义 Hooks
├── lib/                   # 核心逻辑
│   ├── tray-model.ts         # Grid 模式建模
│   ├── custom-tray-model.ts  # Custom 模式建模
│   ├── stepped-cad-construction.ts # Stepped 模式建模
│   ├── storage-stepped-plan.ts     # 收纳阶梯尺寸推导与校验
│   ├── storage-stepped-model.ts    # 收纳主体与托盘建模
│   ├── model-utils.ts        # 共享建模工具
│   ├── outline-geometry.ts   # 轮廓生成算法
│   ├── config.ts             # 配置管理
│   ├── param-io.ts           # 参数导入/导出
│   ├── worker/               # Web Worker
│   └── ...
└── types/                 # TypeScript 类型定义
```

## 开发注意事项

### 建模相关

1. **公差处理**: 所有凹槽尺寸需通过 `getSlotTolerance()` 添加公差，确保模型可打印且底座能顺利放入
2. **坐标系统**: JSCAD 使用中心原点坐标系，2D 编辑器使用左下角原点坐标系，注意转换
3. **性能优化**: 大型模型（>50 凹槽）建模在 Worker 中执行，避免阻塞 UI
4. **形态学闭运算**: Stepped 模式使用 `outline-geometry.ts` 中的算法生成平滑轮廓，包含绕序验证与自动降级处理

### UI/UX

1. **响应式设计**: 桌面优先布局（左侧参数面板 + 右侧视口），窄屏下保留轻量退化样式
2. **实时预览**: 参数变化后自动触发重新建模和渲染
3. **2D 编辑器**: Custom 和 Stepped 模式支持拖拽、旋转、缩放槽位，带碰撞检测和对齐辅助线

## 相关文档

- `doc/requirements.md`: 详细需求文档
- `doc/ui-design.md`: UI 设计规范
- `doc/layout-customizer.md`: 自定义布局功能说明
- `doc/stepped-tray.md`: 阶梯托盘功能说明
- `doc/mobile-ux-optimizations.md`: ~~移动端优化说明~~（已归档，移动端专用布局已移除）
- `doc/layout-symmetry-plan.md`: 对称功能设计
- `docs/superpowers/specs/2026-11-26-storage-stepped-requirements.md`: 阶梯收纳展示台需求规格
- `docs/superpowers/plans/2026-11-26-storage-stepped-mode.md`: 分阶段开发计划与验收
- `docs/validation/storage-stepped/`: 收纳阶梯阶段验收记录、回归矩阵与截图

<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
|------|----------|
| `detect_changes` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context` | Need source snippets for review — token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding which execution paths are impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.

## Agent skills

### Issue tracker

任务与 PRD 使用仓库内的本地 Markdown 文件管理。详见 `docs/agents/issue-tracker.md`。

### Triage labels

任务采用五种标准状态标签。详见 `docs/agents/triage-labels.md`。

### Domain docs

本仓库采用单上下文领域文档布局。详见 `docs/agents/domain.md`。
