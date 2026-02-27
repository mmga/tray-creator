# 自定义模式工作流重设计方案

## 核心理念变更

**旧流程:** 固定底板 → 在底板上排布凹槽 → 可选裁剪
**新流程:** 自由排布凹槽 → 自动计算底板尺寸

## 实现方案

### 1. 初始化变更

**文件:** `src/lib/config.ts`

将 `CUSTOM_LAYOUT_DEFAULTS` 的 `trayWidth/trayDepth` 改为 260x260mm（最大尺寸），作为"虚拟画布"：


```typescript
export const CUSTOM_LAYOUT_DEFAULTS: CustomLayoutParams = {
  trayWidth: 260,  // 虚拟画布尺寸
  trayDepth: 260,
  // ... 其他保持不变
};
```

### 2. 左侧面板调整

**文件:** `src/components/CustomPanel.tsx`

- 将"托盘尺寸"区块移至面板底部
- 默认折叠，标题改为"底板尺寸（高级）"
- 添加说明文字："底板尺寸根据凹槽位置自动计算，如需手动调整可在此修改"
- 移除"裁剪底板"按钮（改为自动行为）
- 在统计信息中显示"有效底板尺寸: XXX × XXX mm"

### 3. 状态管理增强

**文件:** `src/hooks/useCustomLayout.ts`

新增 `calculateEffectiveDimensions()` 函数：
- 计算所有凹槽的包围盒
- 加上 spacing 得到有效底板尺寸
- 无凹槽时返回 { width: 0, depth: 0 }

修改 `addSlot()` 智能放置逻辑：
- 第一个凹槽放在画布中心
- 后续凹槽放在最后一个凹槽右侧

### 4. 2D 画布更新

**文件:** `src/components/LayoutCanvas.tsx`

显示双层画布：
- 外层：虚拟画布（260x260，虚线边框，深灰色）
- 内层：有效底板（自动计算尺寸，实线边框，带圆角）

碰撞检测调整：
- 移除边界碰撞检测（凹槽可自由放置）
- 保留凹槽间碰撞检测
- 当有效尺寸超过 260mm 时显示警告


### 5. 3D 模型生成

**文件:** `src/lib/custom-tray-model.ts`

生成前自动归一化：
- 计算有效底板尺寸
- 将凹槽位置平移到以有效底板为中心
- 使用有效尺寸生成模型

---

## 关键文件清单

| 文件 | 修改内容 |
|------|----------|
| `src/lib/config.ts` | 默认尺寸改为 260x260 |
| `src/hooks/useCustomLayout.ts` | 添加 calculateEffectiveDimensions，修改 addSlot |
| `src/components/CustomPanel.tsx` | 重组 UI，弱化尺寸控件 |
| `src/components/LayoutCanvas.tsx` | 双层画布显示，移除边界碰撞 |
| `src/lib/custom-tray-model.ts` | 生成前归一化处理 |

---

## 验证方式

1. `npm run build` - 确保编译通过
2. `npm run dev` - 手动测试：
   - 添加凹槽，观察是否在画布中心
   - 拖动凹槽，观察有效底板轮廓变化
   - 生成 3D 预览，确认底板尺寸正确
   - 导出 STL，验证尺寸
