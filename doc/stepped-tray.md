# 自定义阶梯底座（Stepped Tray）— 功能文档

> 文档创建/更新日期：2026-03-25

---

## 1. 功能概述

「自定义阶梯底座」是 tray-creator 的第四种建模模式，在顶部标签栏以第四个选项入口。

**核心概念**：每个凹槽有独立的「生长高度（bottomHeight）」，使凹槽柱体从底板向上生长到不同高度，形成阶梯状结构，适用于高度差异明显的混合模型（如骑兵配步兵、巨型模型配普通步兵）。

---

## 2. 当前实现状态（2026-03-25）

- **开发状态**：已全部完成（共 80 项功能测试用例，全部通过）
- **只支持圆形凹槽**（不支持椭圆）

---

## 3. 三维结构说明

```
顶部视图（每个凹槽是一个柱体）：

   ┌──────────────────────────┐
   │  ╭──╮         ╭──╮      │
   │  │  │  ╭──╮   │  │      │
   │  ╰──╯  │  │   ╰──╯      │
   │         ╰──╯             │
   └──────────────────────────┘

侧面视图（阶梯高度差异）：

   ─────┬───────────┐
        │           │  ← 高柱（bottomHeight 大）
   ─────┘           │
   ─────────────────┤  ← 底座平台（共享底座高度）
   █████████████████ base
```

**几何生成逻辑**（由底向上）：

1. **底座（baseSolid）**：所有柱子中最低 `bottomHeight` 作为底座统一高度，使用形态学闭运算（Morphological Closing）从槽位轮廓生成平滑底座外形
2. **额外柱体（tallColumns）**：高于底座高度的柱体部分，独立生成再用 union 合并
3. **凹槽减材（holes）**：从每个柱顶向下挖 `holeDepth` 深度的圆孔

---

## 4. 参数说明

### 全局参数（SteppedLayoutParams）

| 参数              | 类型   | 说明                              | 默认值   |
| ----------------- | ------ | --------------------------------- | -------- |
| `trayWidth`       | number | 托盘宽度 (mm)                     | 自动计算 |
| `trayDepth`       | number | 托盘深度 (mm)                     | 自动计算 |
| `spacing`         | number | 凹槽间距 / 底板外扩量 (mm)        | 2.0      |
| `holeDepth`       | number | 凹槽深度，从柱顶向下挖的深度 (mm) | 5.0      |
| `smoothingRadius` | number | 底座轮廓平滑半径 (mm)             | 3.0      |

### 每槽参数（SteppedSlot）

| 参数           | 类型     | 说明                                    | 默认值   |
| -------------- | -------- | --------------------------------------- | -------- |
| `bottomHeight` | number   | 生长高度，柱体从底板向上生长的高度 (mm) | 10.0     |
| `shape`        | "circle" | 形状（仅支持 circle）                   | "circle" |
| `width`        | number   | 凹槽直径 (mm)                           | —        |
| `height`       | number   | 凹槽直径（与 width 相同，均为直径）     | —        |
| `rotation`     | number   | 旋转角度（圆形无意义，保留字段）        | 0        |

---

## 5. 架构与文件

### 类型定义

- `src/types/custom-tray.ts`
  - `AppMode`: `"grid" | "custom" | "simple-stepped" | "stepped"`
  - `SteppedSlot`: 继承 `FreeSlot`，新增 `bottomHeight: number`
  - `SteppedLayoutParams`: 全局参数结构

### 配置

- `src/lib/config.ts`
  - `STEPPED_LAYOUT_DEFAULTS`: 默认参数
  - `STEPPED_SLOT_DEFAULTS`: 新增槽位时的默认单槽参数
  - `STEPPED_LIMITS`: 参数范围与 UI 元数据（label、min、max、step、unit）

### 状态管理

- `src/hooks/useSteppedLayout.ts` — 完整状态管理 Hook
  - `addSlot(width)` — 添加圆形凹槽
  - `removeSlot(id)` — 删除凹槽
  - `updateSlotPosition(id, x, y)` — 拖拽更新位置
  - `updateMultipleSlots(updates)` — 批量移动
  - `updateSlotRotation(id, rotation)` — 旋转（圆形无视觉效果，保留接口兼容性）
  - `duplicateSlots(ids)` — 复制凹槽
  - `trimBaseplate()` — 裁剪底板到最小尺寸
  - `updateSlotBottomHeight(id, bottomHeight)` — 单槽高度更新
  - `updateSelectedSlotsBottomHeight(ids, bottomHeight)` — 批量高度更新
  - `handleGenerate()` — 触发 3D 建模（通过 Worker）
  - `handleExportSTL()` — 导出 STL
  - `outlinePreview` — 2D 轮廓预览数据

### 3D 建模

- `src/lib/stepped-tray-model.ts`
  - `createSteppedTrayModel(params): Geom3` — 主建模函数
  - `calculateSteppedTrayDimensions(params)` — 计算输出尺寸
  - `calculateEffectiveBaseplate(params)` — 计算有效底板边界
  - 依赖 `src/lib/outline-geometry.ts` 进行形态学闭运算轮廓生成

### Worker 通信

- `src/lib/worker/tray.worker.ts` — `GENERATE_STEPPED` 消息处理
- `src/lib/worker/worker-service.ts` — `generateStepped(params)` 异步方法

### UI 组件

- `src/components/SteppedPanel.tsx` — 左侧参数面板
  - 添加凹槽（仅圆形预设）
  - 选中凹槽 bottomHeight 编辑
  - 全局结构参数（spacing / holeDepth / smoothingRadius）
  - 统计信息（重量 / 报价 / 尺寸）
  - 操作按钮（锻造 / 导出 / 导出参数 / 发送配置 / 重置）

### 2D 编辑器

复用 `src/components/LayoutCanvas.tsx`，完全支持：

- 拖拽、旋转、多选、框选
- 碰撞检测（红色警告）
- 对齐辅助线
- 缩放/平移（useCanvasZoom）
- 键盘快捷键（Delete、Ctrl+Z、Escape 等）
- 选中槽位上方显示绿色「底部 Xmm」标签

### 导入导出

- `src/lib/param-io.ts`
  - `exportParams("stepped", params)` — 导出 JSON
  - `importParams(file, "stepped")` — 导入 JSON
  - `validateSteppedParams(params)` — 校验
  - `custom → stepped` 迁移支持（自动映射共享默认值）

### 价格计算

- `src/lib/pricing.ts` — `calculateSteppedPrice(params, volume)` — 已按真实几何体积估重，并综合打印机时、有效占地和设计复杂度定价
- 公式细节与样本校准见 `doc/stepped-pricing-formula.md`

---

## 6. 关键设计决策

### 6.1 几何模型演进

- **原始设计（已弃用）**：整体大块 + 减材孔（类似 Custom 模式）
- **当前设计（Session 2 重构）**：底板 + 柱体向上生长（union）+ 再减材孔

### 6.2 底座轮廓生成

- 使用形态学闭运算（`outline-geometry.ts`）：先对各柱体的外扩圆做 union，再做 closing（inflate + convex hull + deflate）生成平滑轮廓
- 内置绕序验证（CCW 检查）和自动降级（若失败退回各圆柱合并）

### 6.3 椭圆支持移除

- 阶梯底座模式**仅支持圆形凹槽**（与 Custom 模式不同）
- 不开放椭圆 UI 入口
- `addSlot(width)` 接口只接受直径，始终创建圆形

### 6.4 自动预览

- 参数变化后 500ms 防抖自动触发建模
- 可通过面板开关取消自动预览
- 建模完成后不自动切换到 3D 视图（需用户手动点击预览）

---

## 7. 凹槽预设（仅圆形）

| 预设 | 直径(mm) | 适用场景  |
| ---- | -------- | --------- |
| 25   | 25       | 小型步兵  |
| 28.5 | 28.5     | 中型步兵  |
| 32   | 32       | 标准步兵  |
| 40   | 40       | 大型/精英 |
| 50   | 50       | 超大型    |
| 60   | 60       | 巨型      |

---

## 8. 已知限制

- 底板形状由形态学轮廓算法决定，不支持手动绘制边界
- 凹槽旋转对圆形无视觉意义（代码保留兼容性）
- 超大型托盘（>250mm）在部分设备上建模较慢
