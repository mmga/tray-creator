# UI 设计规范 — 战锤托盘生成器

> 战锤 Grimdark 风格设计系统文档，用于指导界面开发与维护。

---

## 1. 设计理念

本工具面向战锤微缩模型玩家，UI 采用 **Warhammer 40K Grimdark** 美学——厚重、工业、哥特，
呼应帝国锻造工坊的氛围：铁与火、金属与羊皮纸、血与钢。

**核心原则：**

- **厚重感** — 低圆角、粗边框、深阴影，拒绝轻薄通透
- **帝国仪式感** — 金色修饰线、铆钉装饰、方形徽章
- **锻造氛围** — 暖色灯光、余烬动画、血红操作色
- **可读性** — 羊皮纸色文字在深色底上保持高对比度

---

## 2. 色彩体系

### 2.1 核心色板

| 色彩角色 | 色值 | HSL 近似 | 用途 |
|----------|------|----------|------|
| **深黑底色** | `#0a0908` | — | 页面背景 |
| **铁质面板** | `#12110e` | — | Card / 面板背景 |
| **暗铁** | `#1c1a16` | — | 输入框、次级面板 |
| **帝国金 (Primary)** | `#b8963a` | 42° 52% 47% | 标题、边框高亮、图标 |
| **血红 (Destructive)** | `#8b1a1a` | 0° 68% 32% | 主按钮、Slider 填充、警告 |
| **羊皮纸 (Foreground)** | `#c8b89a` | 36° 33% 69% | 正文文字 |
| **锈铁 (Muted)** | `#7a6e5a` | 36° 15% 41% | 次要文字、placeholder |
| **风化铁 (Border)** | `#2e2a24` | 36° 11% 16% | 边框、分割线 |
| **深铜 (Accent)** | `#2a2520` | — | Hover 背景、强调区域 |

### 2.2 功能色

| 功能 | 色值 | 用途 |
|------|------|------|
| **锻造（生成）** | `#6b1515` → `#8b1a1a` 渐变 | 主操作按钮 |
| **导出** | `#2a3528` 底 / `#8cb880` 文字 | 导出 STL 按钮 |
| **超限警告** | `#c04040` | 尺寸超限文字 |
| **成功/在线** | 无独立色（使用帝国金） | — |

### 2.3 对比度

| 组合 | 对比度 | 等级 |
|------|--------|------|
| 羊皮纸 `#c8b89a` / 深黑 `#0a0908` | **11.2:1** | AAA ✅ |
| 帝国金 `#b8963a` / 深黑 `#0a0908` | **7.8:1** | AAA ✅ |
| 锈铁 `#7a6e5a` / 深黑 `#0a0908` | **4.6:1** | AA ✅ |
| 血红 `#8b1a1a` / 羊皮纸 `#f0d8b8` | **4.5:1** | AA ✅ |

---

## 3. 字体系统

| 字体 | 用途 | 加载权重 |
|------|------|----------|
| **Cinzel** (Google Fonts) | 标题、按钮、Section Header | 400–900 |
| **IBM Plex Mono** (Google Fonts) | 数值、单位、版本号、标签 | 400, 500, 600 |

### CSS 变量

```css
--font-sans: var(--font-cinzel);   /* 默认字体 */
--font-mono: var(--font-ibm-plex-mono);
```

### 使用规范

| 元素 | 字体 | 字号 | 字重 | 间距 |
|------|------|------|------|------|
| 页面标题 | Cinzel | 16px (text-base) | 700 (bold) | `tracking-[0.15em]` |
| 副标题 | IBM Plex Mono | 10px | 400 | `tracking-[0.3em]` |
| Section Header | Cinzel | 12px (text-xs) | 700 (bold) | `tracking-[0.2em]` |
| 参数标签 | 默认 | 14px (text-sm) | 400 | 默认 |
| 数值输入 | IBM Plex Mono | 14px | 400 | — |
| 尺寸数据 | IBM Plex Mono | 14px | 600 | `tabular-nums` |
| 单位文字 | IBM Plex Mono | 10-11px | 400 | — |
| 按钮文字 | 默认 | 14px | 700 (bold) | `tracking-wider` |

---

## 4. 圆角规范

```css
--radius: 0.375rem;  /* 6px — 基础圆角 */
```

| 元素 | 圆角 | 说明 |
|------|------|------|
| 面板卡片 | `rounded-sm` (3px) | 几乎直角，厚重感 |
| 按钮 | 默认 shadcn (6px) | — |
| 视口容器 | 0 (无圆角) | 通过 `forged-viewport` 阴影框定 |
| Slider Thumb | 2px (内联 style) | 方形铁栓 |
| 铆钉装饰 | 50% (圆形) | — |

---

## 5. 阴影 & 边框

### 5.1 铁质面板 (`iron-panel`)

```css
background: linear-gradient(165deg, #16140f 0%, #12110e 50%, #0e0d0a 100%);
border: 1px solid #2e2a24;
box-shadow:
  inset 0 1px 0 0 #2e2a2440,     /* 顶部内高光 */
  inset 0 -1px 0 0 #0a090820,     /* 底部内阴影 */
  0 4px 12px -2px #00000060;       /* 外投影 */
```

### 5.2 锻造视口 (`forged-viewport`)

```css
box-shadow:
  inset 0 0 40px #00000080,       /* 深内阴影 */
  inset 0 0 2px #00000060,
  0 0 0 1px #2e2a24,              /* 内环铁框 */
  0 0 0 3px #1c1a16,              /* 中间层 */
  0 0 0 4px #2e2a24,              /* 外环铁框 */
  0 8px 24px -4px #00000080;       /* 外投影 */
```

### 5.3 铆钉 (`rivet`)

```css
width: 8px; height: 8px;
border-radius: 50%;
background: radial-gradient(circle at 35% 35%, #6b6050, #3d372e 60%, #2a2520);
box-shadow: inset 0 -1px 2px #00000060, 0 1px 2px #00000040;
```

---

## 6. 装饰元素

### 6.1 金色修饰线 (`gold-trim`)

横跨容器宽度的金色装饰条，用于 Header 底部和 Section 分隔：

```css
background: linear-gradient(90deg,
  transparent 0%, #4a3d1a 10%, #b8963a 30%,
  #d4af56 50%,  /* 中心高光 */
  #b8963a 70%, #4a3d1a 90%, transparent 100%
);
```

### 6.2 帝国徽章

Header Logo 使用 **方形** 容器 + 四角切口：
- 尺寸：40×40px
- 边框：2px solid `primary/60`
- 背景：`#1c1a16`
- 四角各有 8×8px 的 `border-t/b/l/r` 装饰

### 6.3 Section Header

每个参数组标题包含：

```
[方形图标盒] [金色大写标题]
──────────────────── (金色分割线)
```

- 图标盒：24×24px、1px border `primary/40`、背景 `#1c1a16`
- 标题：`text-xs`、`font-bold`、`tracking-[0.2em]`、`uppercase`、`text-primary/90`

### 6.4 视口铆钉

四角各一个 8px 圆形铆钉，加径向高光模拟金属凸起。

---

## 7. 动画

| 动画名 | 效果 | 时长 | 用途 |
|--------|------|------|------|
| `ember-glow` | 透明度 0.6 ↔ 1.0 呼吸 | 4s | 状态指示灯 |
| `forge-pulse` | 红色阴影呼吸 | 3s | 尺寸超限面板 |
| `fade-in` | 透明度 0→1 + 上移 4px | 0.3s | 面板初始加载 |
| 旋转加载 | `animate-spin` | — | 生成中按钮图标 |

所有动画均在 `prefers-reduced-motion: reduce` 时禁用。

---

## 8. 组件规范

### 8.1 按钮

| 类型 | 背景 | 文字色 | 高度 | 额外样式 |
|------|------|--------|------|----------|
| **主操作（锻造）** | `blood-red` 渐变 | `#f0d8b8` | 44px (h-11) | border `#a02020`、红色投影 |
| **导出** | `#2a3528` | `#8cb880` | 40px (h-10) | border `#4a6741` |
| **重置（Ghost）** | transparent | muted-foreground | 36px (h-9) | border `#2e2a24` |

所有按钮必须：
- 设置 `cursor-pointer`
- 包含 `transition-all duration-200`
- hover 时提供视觉反馈（亮度/边框/阴影变化）
- disabled 时 `opacity-50` + `cursor-not-allowed`

### 8.2 Slider

| 部分 | 样式 |
|------|------|
| Track | 高度 6px、bg `#1c1a16`、上下 1px border `#2e2a24` |
| Range (填充) | `blood-red` 渐变 + `shadow 0 0 6px #8b1a1a40` |
| Thumb | 16×16px、2px 圆角、border `primary`、bg `#1c1a16` |
| Thumb hover | bg `#2a2520`、金色外发光 |

### 8.3 输入框

- 背景：`#1c1a16`
- 边框：`#2e2a24`
- Focus：border `primary/50`、ring `primary/20`
- 字体：IBM Plex Mono、text-right

### 8.4 Select 下拉

- Trigger：同输入框样式，hover → border `primary/40`
- Content：bg `#16140f`、border `#2e2a24`
- Item focus：bg `primary/10`、text `primary`

---

## 9. 布局

### 9.1 整体结构

```
┌──────────────────────────────────────────────────┐
│  Header (帝国徽章 | 标题 | 版本状态)    [gold-trim] │
├───────────┬──┬──────────────────────────────────────┤
│           │▓▓│                                      │
│ 参数面板   │▓▓│         3D 视口 (FORGE VIEW)          │
│ (340px)   │▓▓│                                      │
│           │▓▓│        ● 铆钉          铆钉 ●         │
│           │▓▓│                                      │
│           │▓▓│        ● 铆钉          铆钉 ●         │
├───────────┴──┴──────────────────────────────────────┤
```

| 区域 | 宽度 | 背景 |
|------|------|------|
| 参数面板 | 340px 固定 | `#0e0d0b` |
| 分隔线 | 3px | 渐变铁色 + 金色高光线 |
| 3D 视口 | flex-1 | `#0a0908` |
| Header | 全宽 | `#0e0d0b` + 2px border-bottom |

### 9.2 参数面板内部

面板内 padding `16px`，面板间 gap `16px`。每个 `iron-panel` 内 padding `16px`。

---

## 10. 滚动条

```css
::-webkit-scrollbar { width: 8px; }
::-webkit-scrollbar-track { background: #0e0d0b; border-left: 1px solid #2e2a24; }
::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, #3d372e, #2a2520, #3d372e);
  border: 1px solid #4a4238;
  border-radius: 1px;
}
```

---

## 11. 可访问性

- 所有文字/背景对比度 ≥ 4.5:1 (WCAG AA)
- 交互元素有可见 focus 状态
- `prefers-reduced-motion` 禁用所有动画
- 所有可点击元素设置 `cursor-pointer`
- 键盘 Tab 顺序与视觉顺序一致

---

## 12. 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Next.js | 16.1.6 (Turbopack) | 框架 |
| React | 19.2.3 | UI 库 |
| Tailwind CSS | 4.x | 样式 |
| shadcn/ui + Radix | 最新 | 基础组件 |
| React Three Fiber | 9.5 | 3D 渲染 |
| Lucide React | 0.563 | 图标 |
| Google Fonts | Cinzel, IBM Plex Mono | 字体 |

---

## 13. CSS Utility 一览

| Class | 用途 |
|-------|------|
| `iron-panel` | 铁质面板卡片 |
| `gold-trim` | 金色修饰线 |
| `blood-red` | 血红渐变 |
| `parchment-glow` | 金色文字微光 |
| `forged-viewport` | 3D 视口铁框 |
| `rivet` | 铆钉装饰 |
| `wh-divider` | 战锤风分割线 |
| `animate-ember` | 余烬呼吸灯 |
| `animate-forge-pulse` | 红色阴影脉冲 |
| `animate-fade-in` | 淡入上移 |
