# 右侧编辑面板重构方案

## 背景

当前右侧面板（`AlignmentToolbar`）是一个整体可折叠的侧边栏，内部包含"对齐"和"镜像"两个可折叠 section。收起时只显示一个竖排"编辑辅助"标签 + 选中计数。

**问题**：

1. 收起后无法直接看到有哪些功能分组。
2. 所有功能共享同一个展开/收起状态，不够灵活。
3. 未来新增操作（如"阵列"、"约束"等）时，面板会变得臃肿。

## 目标设计

将面板改为**标签式折叠面板（Tab Accordion）**：

```
┌──────────────────────────────────────────────────┐
│               收起状态 (≈52px宽)                  │
│  ┌──────────┐                                    │
│  │ [对齐图标]│  ← 竖排标签，点击展开"对齐"面板    │
│  │   对齐    │                                    │
│  ├──────────┤                                    │
│  │ [镜像图标]│  ← 竖排标签，点击展开"镜像"面板    │
│  │   镜像    │                                    │
│  ├──────────┤                                    │
│  │ (未来...)│  ← 预留空间，新操作自动追加         │
│  │          │                                    │
│  └──────────┘                                    │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│       展开状态 (≈248~420px宽)                     │
│  ┌──────┬────────────────────────────────┐       │
│  │▌对齐 │  [对齐面板内容]                 │   ← 点│
│  │      │  边缘对齐: 左 中 右 上 中 下   │   击标│
│  │      │  自动排布: 一排 一列            │   签切│
│  │      │  排布间距: 使用当前槽距         │   换  │
│  ├──────┤                                │       │
│  │ 镜像 │                                │       │
│  ├──────┤                                │       │
│  │(更多)│                                │       │
│  └──────┴────────────────────────────────┘       │
└──────────────────────────────────────────────────┘
```

### 交互规则

1. **默认收起**：所有标签以图标+文字竖排排列，面板不占横向空间。
2. **点击标签**：展开面板，显示该标签对应的配置内容。
3. **再次点击已展开的标签**：收起面板，回到全部收起状态。
4. **切换标签**：无需先收起，直接切换显示内容。
5. **选中计数**：展开时在面板顶部显示当前选中凹槽数。

### 扩展性

- 每个操作标签是一个配置对象 `{ id, icon, label, component }`。
- 新增操作只需追加配置，无需修改面板容器逻辑。

## 文件变更计划

### 1. 拆分 AlignmentToolbar 为独立面板组件

**当前**：`AlignmentToolbar.tsx` (≈520 行) 包含所有逻辑 + UI。

**重构后**：

| 文件                                    | 职责                                    |
| --------------------------------------- | --------------------------------------- |
| `src/components/canvas/EditSidebar.tsx` | 新容器组件，管理标签切换与展开/收起状态 |
| `src/components/canvas/AlignPanel.tsx`  | 提取"对齐"区块的 UI 和逻辑              |
| `src/components/canvas/MirrorPanel.tsx` | 提取"镜像"区块的 UI 和逻辑              |
| `src/components/AlignmentToolbar.tsx`   | 保留为兼容入口，内部使用 `EditSidebar`  |

### 2. EditSidebar 组件设计

```tsx
interface ToolTab {
  id: string;
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  panel: React.ReactNode;
}

interface EditSidebarProps {
  tabs: ToolTab[];
  collapsed: boolean; // 外部控制是否完全收起
  onToggleCollapse: () => void;
  selectionCount: number; // 当前选中数
}
```

**状态**：

- `activeTabId: string | null` — `null` 表示收起，字符串表示展开对应面板。

**布局结构**（桌面端）：

```
<aside> // flex-row
  <nav>  // 标签栏 (固定宽度 ≈52px)
    {tabs.map(tab => <TabButton />)}
  </nav>
  {activeTabId && (
    <div> // 面板内容区
      <header> // 选中计数 </header>
      <div> // 当前面板内容 </div>
    </div>
  )}
</aside>
```

### 3. LayoutCanvas 适配

- 将 `isActionPanelCollapsed` 改为 `activeToolTab: string | null`。
- 面板宽度：
  - 全部收起：`52px`（只有标签栏）。
  - 展开：`52px(标签栏) + 内容区宽度`，内容区仍可拖拽调整。
- resize 拖拽手柄逻辑保持不变。

### 4. 移动端适配

移动端面板在 canvas 上方，改为水平标签栏：

```
┌──────────────────────────────────────────┐
│ [对齐▼] [镜像▼] [...]   已选: 3 个       │  ← 水平标签
├──────────────────────────────────────────┤
│ (展开时: 下拉面板内容)                        │
└──────────────────────────────────────────┘
```

### 5. Props 传递路径

```
LayoutCanvas
  └─ EditSidebar
       ├─ AlignPanel (接收 selectedIds, slots, onUpdateSlots, spacing)
       └─ MirrorPanel (接收 selectedIds, slots, onUpdateSlots, onInsertSlots,
                        spacing, trayWidth, trayDepth, enableCopyPreview)
```

公共 props (`selectedIds`, `slots`, `spacing` 等) 由 `EditSidebar` 透传给各面板。

## 实施步骤

### Phase 1: 拆分面板组件

1. 创建 `src/components/canvas/AlignPanel.tsx`
   - 从 `AlignmentToolbar` 提取对齐逻辑和 UI
   - 包含：`handleAlign`, `handleArrange`, 边缘对齐按钮、自动排布按钮
   - Props: `{ selectedSlots, onUpdateSlots, spacing, disabled }`

2. 创建 `src/components/canvas/MirrorPanel.tsx`
   - 从 `AlignmentToolbar` 提取镜像逻辑和 UI
   - 包含：`handleMirrorMove`, `handleMirrorCopy`, `evaluateMirrorCopy`, 预检标签
   - Props: `{ selectedSlots, unselectedSlots, allSlots, onUpdateSlots, onInsertSlots, spacing, trayWidth, trayDepth, enableCopyPreview }`

### Phase 2: 创建 EditSidebar 容器

3. 创建 `src/components/canvas/EditSidebar.tsx`
   - 实现标签栏 + 面板内容区布局
   - 管理 `activeTabId` 状态
   - 桌面端：垂直标签栏 + 右侧内容区
   - 移动端：水平标签栏 + 下方展开区

### Phase 3: 集成

4. 更新 `AlignmentToolbar.tsx`
   - 改为使用 `EditSidebar` 的薄包装，组装 tabs 配置

5. 更新 `LayoutCanvas.tsx`
   - 透传必要 props
   - 调整面板宽度常量
   - 更新 resize 逻辑适配新的宽度计算

### Phase 4: 样式微调

6. 确保标签切换动画流畅
7. 测试桌面端 resize 拖拽
8. 测试移动端下拉展开/选中
9. 确保键盘可访问性

## 风险与注意事项

- **镜像预检缓存**：`copyPreviews` 的计算依赖 `collapsed` 状态，重构后需对应 `activeTabId !== 'mirror'` 来判断是否跳过计算。
- **选中状态**：选中计数显示位置从面板 header 移到标签栏旁或面板内容区顶部。
- **面板宽度**：收起宽度从 84px 缩小到 52px，需确保图标和文字在竖排时可读。
- **向后兼容**：`AlignmentToolbar` 作为兼容层保留原有 props 接口，降低 `LayoutCanvas` 改动量。
