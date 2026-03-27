# ~~移动端 UI 优化方案~~ [已归档]

> **注意**：本文档中涉及的移动端专用布局（底部 Tab 切换、全屏视图切换、移动端专用容器）
> 已在 2026-03-27 的布局收敛重构中全部移除。项目现在采用单一桌面优先布局。
> 以下内容仅供参考，其中关于 Pointer Events、折叠面板等通用改进已独立落地。

---

## 一、现状问题分析

### 1.1 整体布局问题

当前移动端采用上下堆叠布局（参数面板占 50vh，视口占 50vh），定义在 [page.tsx](src/app/page.tsx#L98-L144)：

| 问题 | 严重程度 | 说明 |
|---|---|---|
| 参数面板 `max-h-[50vh]` 截断 | 高 | CustomPanel 有 6 个展开段落 + 操作按钮，50% 屏幕高度远不够，用户需在狭小区域反复滚动 |
| 视口仅 50vh | 高 | 2D 画布编辑空间极小，拖拽凹槽、精确定位非常困难 |
| 根容器 `overflow-hidden` | 中 | 整个应用被锁定在一屏内，auto-scroll 逻辑实际不生效 |
| 子组件零响应式设计 | 中 | 仅 `page.tsx` 使用了 `lg:` 断点，所有子组件在任何屏幕宽度下呈现完全相同的 UI |

### 1.2 自定义模式（CustomPanel）问题

[CustomPanel.tsx](src/components/CustomPanel.tsx) 包含 **6 个始终展开的 `iron-panel` 段落**：

1. **托盘尺寸** — 2 个滑块 + 裁剪按钮
2. **添加凹槽** — 圆形预设 3×N 网格 + 椭圆预设 2×N 网格
3. **结构参数** — 4 个滑块（间距、底板厚度、孔深、圆角）
4. **底板孔位** — 开关 + 选择器 + 详情
5. **统计信息** — 凹槽数量、报价、宽高深尺寸
6. **操作按钮** — 自动预览、锻造、导出、重置、参数导入导出

**核心痛点**：所有段落始终平铺展开，没有折叠/手风琴机制。在手机上用户必须在 50vh 的狭小滚动区内来回翻找，编辑效率极低。

### 1.3 2D 画布交互问题

| 问题 | 位置 | 说明 |
|---|---|---|
| **无触摸事件支持** | [LayoutCanvas.tsx L574-L578](src/components/LayoutCanvas.tsx#L574-L578) | 仅绑定 `onMouseDown/Move/Up`，移动端无法拖拽凹槽 |
| **AlignmentToolbar 溢出** | [AlignmentToolbar.tsx L270](src/components/AlignmentToolbar.tsx#L270) | 约 20 个按钮水平排列，窄屏直接溢出 |
| **键盘快捷键不可用** | [useCanvasKeyboard.ts](src/hooks/useCanvasKeyboard.ts) | Delete/Ctrl+D/Ctrl+Z/Space 等无触摸替代方案 |
| **右键菜单不可用** | [CanvasContextMenu.tsx](src/components/canvas/CanvasContextMenu.tsx) | 移动端无右键，删除/复制/旋转操作入口缺失 |

---

## 二、优化方案

### 2.1 【高优先级】参数面板折叠化（Collapsible Sections）

**目标**：将 CustomPanel 的 6 个段落改为可折叠的手风琴式面板，移动端默认折叠次要段落，桌面端默认全部展开。

**实现方式**：

1. **改造 `SectionHeader` 组件**（[SectionHeader.tsx](src/components/ui/SectionHeader.tsx)）：
   - 增加 `collapsible?: boolean` 和 `defaultOpen?: boolean` props
   - 可折叠时，显示展开/收起箭头图标（ChevronDown/ChevronUp）
   - 点击标题行切换折叠状态
   - 添加 `max-h` + `overflow-hidden` + CSS transition 实现平滑动画

2. **CustomPanel 段落折叠策略**：

   | 段落 | 移动端默认 | 桌面端默认 | 理由 |
   |---|---|---|---|
   | 托盘尺寸 | **展开** | 展开 | 最基础参数，首次必须设置 |
   | 添加凹槽 | **展开** | 展开 | 核心操作入口 |
   | 结构参数 | **折叠** | 展开 | 高级参数，非每次必改 |
   | 底板孔位 | **折叠** | 展开 | 高级参数，非每次必改 |
   | 统计信息 | **折叠** | 展开 | 只读信息，按需查看 |
   | 操作按钮 | **始终展开** | 始终展开 | 核心操作入口，不可折叠 |

3. **交互细节**：
   - 使用 `useMediaQuery` 或 Tailwind `lg:` 断点检测判断是否为移动端
   - 折叠时显示简要摘要（如结构参数折叠后显示"间距 2mm / 底厚 3mm / 孔深 14mm"）
   - 段落标题区域增大点击热区（`py-3`），方便手指操作

4. **可选：使用 shadcn/ui Collapsible 组件**：
   - 项目已接入 shadcn/ui，可安装 `@radix-ui/react-collapsible`
   - 或直接用 `<details>/<summary>` 原生 HTML 实现，保持轻量

### 2.2 【高优先级】移动端布局重构

**目标**：让参数面板和画布之间可以灵活切换，而非固定 50/50 分割。

**Tab 切换模式（推荐）**
- 移动端 `<1024px` 时，参数面板和画布不再上下堆叠
- 改为底部 Tab 切换：「参数配置」|「2D 布局」|「3D 预览」
- 当前活跃 Tab 占满全屏高度（扣除 header + tab bar）
- 优点：每个视图有充足空间；缺点：不能同时看参数和画布


### 2.3 【高优先级】画布触摸事件支持

**目标**：让移动端可以在 2D 画布上拖拽凹槽、缩放和平移。

**实现方式**：

1. **将 Mouse Events 迁移为 Pointer Events**（[LayoutCanvas.tsx](src/components/LayoutCanvas.tsx)）：
   - `onMouseDown` → `onPointerDown`
   - `onMouseMove` → `onPointerMove`  
   - `onMouseUp` → `onPointerUp`
   - 添加 `touch-action: none` CSS 防止浏览器默认手势
   - Pointer Events 同时兼容鼠标和触摸，一套代码适配两端

2. **双指缩放/平移**：
   - 检测双指触摸（`e.touches.length === 2`）时进入缩放/平移模式
   - 单指触摸保持为拖拽凹槽
   - 可利用现有 [useCanvasZoom.ts](src/hooks/useCanvasZoom.ts) 的 `handleWheel` 逻辑

3. **长按触发上下文菜单**：
   - 替代桌面端右键菜单
   - 长按凹槽 500ms 弹出操作菜单（删除/复制/旋转）

### 2.4 【中优先级】AlignmentToolbar 移动端适配

**目标**：工具栏在窄屏上不溢出。

**实现方式**（[AlignmentToolbar.tsx](src/components/AlignmentToolbar.tsx)）：

1. **移动端改为两行或网格布局**：
   - `<1024px` 时使用 `flex-wrap` 换行，或改为 `grid grid-cols-6` 网格
   - 缩小按钮尺寸（`w-7 h-7` → `w-6 h-6`）

2. **或使用水平滚动**：
   - 添加 `overflow-x-auto` + 隐藏滚动条样式
   - 简单有效，但不够直观

3. **或折叠为下拉菜单**：
   - 移动端仅显示常用按钮（删除、复制、撤销）
   - 其余按钮收入 "更多" 菜单

### 2.5 【中优先级】触摸替代快捷键

**目标**：为移动端提供桌面端键盘快捷键的替代操作。

| 桌面快捷键 | 移动端替代方案 |
|---|---|
| `Delete` 删除 | 选中后显示悬浮删除按钮；或左滑删除手势 |
| `Ctrl+D` 复制 | 长按弹出菜单中的"复制"选项 |
| `Ctrl+Z` 撤销 | 工具栏常驻撤销按钮（已有 Undo/Redo 按钮） |
| `Space+拖拽` 平移 | 双指拖拽平移 |
| `Scroll` 缩放 | 双指捏合缩放 |
| `R` 旋转 | 长按弹出菜单中的"旋转"选项；或凹槽上显示旋转手柄 |
| `Shift+拖拽` 框选 | 双指框选（较复杂）；或工具栏加"框选模式"按钮 |

### 2.6 【低优先级】其他移动端体验改善

1. **Header 响应式**（[page.tsx L55-L90](src/app/page.tsx#L55-L90)）：
   - 小屏幕缩小标题字号，隐藏版本标签
   - 添加 `flex-wrap` 或将副标题移至第二行

2. **按钮尺寸增大**：
   - 添加凹槽按钮 `h-8` → 移动端 `h-10`（满足 44px 最小触摸目标）
   - 兼容 Apple HIG 和 Material Design 的触摸目标规范

3. **ModeTabs 优化**（[ModeTabs.tsx](src/components/ModeTabs.tsx)）：
   - 极窄屏幕 `<375px` 时缩小 padding 和 tracking

4. **3D 预览降级**：
   - 移动端可选择降低 3D 渲染质量（减少面数）
   - 或默认显示 2D 布局，3D 预览需手动切换

---

## 三、实施优先级与路线图

### Phase 1：快速见效（1-2天）
- [ ] `SectionHeader` 改造为可折叠组件
- [ ] `CustomPanel` 移动端次要段落默认折叠
- [ ] 安装 `@radix-ui/react-collapsible`（如用 shadcn 方案）

### Phase 2：核心交互（2-3天）
- [ ] `LayoutCanvas` Mouse Events → Pointer Events 迁移
- [ ] 双指缩放/平移支持
- [ ] 长按触发上下文菜单

### Phase 3：布局重构（2-3天）
- [ ] 移动端布局从 50/50 改为 Tab 切换或 Bottom Sheet
- [ ] AlignmentToolbar 移动端适配
- [ ] 触摸替代快捷键方案

### Phase 4：细节打磨（1天）
- [ ] Header 响应式
- [ ] 触摸目标尺寸优化
- [ ] 3D 预览降级策略

---

## 四、关键文件索引

| 文件 | 需改动内容 |
|---|---|
| [src/components/ui/SectionHeader.tsx](src/components/ui/SectionHeader.tsx) | 增加折叠能力 |
| [src/components/CustomPanel.tsx](src/components/CustomPanel.tsx) | 使用可折叠 SectionHeader |
| [src/components/ParameterPanel.tsx](src/components/ParameterPanel.tsx) | 同步改造（阵列模式面板） |
| [src/app/page.tsx](src/app/page.tsx) | 移动端布局重构 |
| [src/components/LayoutCanvas.tsx](src/components/LayoutCanvas.tsx) | Pointer Events + 触摸手势 |
| [src/components/AlignmentToolbar.tsx](src/components/AlignmentToolbar.tsx) | 移动端溢出修复 |
| [src/hooks/useCanvasZoom.ts](src/hooks/useCanvasZoom.ts) | 双指缩放支持 |
| [src/components/canvas/CanvasContextMenu.tsx](src/components/canvas/CanvasContextMenu.tsx) | 长按触发支持 |

---

## 五、设计决策记录

- **折叠方案**：用户建议将选项折叠，确认采用手风琴式可折叠面板
- **折叠粒度**：按现有 `iron-panel` 段落级别折叠，不做更细粒度拆分
- **桌面端不受影响**：桌面端保持全部展开的默认行为，仅移动端默认折叠次要项
- **操作按钮不折叠**：锻造/导出等核心按钮始终可见