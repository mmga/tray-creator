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

> 项目无测试框架配置（无 Jest/Vitest）。代码质量依赖 ESLint + TypeScript strict mode。

## 核心架构

### 三种建模模式

项目支持三种托盘建模模式，每种模式有独立的参数类型、建模逻辑和 UI 面板：

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

3. **Stepped Mode（阶梯底座）**
   - 类型：`SteppedLayoutParams` (src/types/custom-tray.ts)
   - 建模：`createSteppedTrayModel()` (src/lib/stepped-tray-model.ts)
   - Hook：`useSteppedLayout()` (src/hooks/useSteppedLayout.ts)
   - UI：`SteppedPanel` + `LayoutCanvas` (2D 编辑器)
   - 特点：每个凹槽有独立的生长高度，使用形态学闭运算生成平滑底座轮廓

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
- `useSteppedLayout()`: Stepped 模式参数、槽位管理

共享 Hook：
- `useUndoHistory()`: 撤销/重做功能
- `useCanvasZoom()`: 2D 编辑器缩放/平移
- `useCanvasKeyboard()`: 2D 编辑器键盘快捷键

### 配置管理原则

所有参数（默认值、范围、公差、预设）集中在 `src/lib/config.ts` 管理，避免硬编码：

- `DEFAULT_TRAY_PARAMS`: Grid 模式默认参数
- `CUSTOM_LAYOUT_DEFAULTS`: Custom 模式默认参数
- `STEPPED_LAYOUT_DEFAULTS`: Stepped 模式默认参数
- `BASE_PRESETS`: 底座直径预设（25mm、28.5mm、32mm、40mm、50mm、60mm）
- `ELLIPSE_PRESETS`: 椭圆形凹槽预设
- `PARAM_CONFIG` / `CUSTOM_LIMITS` / `STEPPED_LIMITS`: 参数范围与元数据
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
│   ├── SteppedPanel.tsx      # Stepped 模式参数面板
│   ├── LayoutCanvas.tsx      # 2D 编辑器画布
│   ├── TrayViewer.tsx        # 3D 预览视口
│   └── ModeTabs.tsx          # 模式切换标签
├── hooks/                 # 自定义 Hooks
├── lib/                   # 核心逻辑
│   ├── tray-model.ts         # Grid 模式建模
│   ├── custom-tray-model.ts  # Custom 模式建模
│   ├── stepped-tray-model.ts # Stepped 模式建模
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

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- After modifying code files in this session, run `python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"` to keep the graph current
