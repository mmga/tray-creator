# 战锤移动托盘参数化建模 — 实施计划

> 文档创建日期：2026-02-12
> 包管理器：pnpm

## 目标

基于 Next.js + shadcn/ui + Tailwind + JSCAD + Three.js 构建参数化战锤移动托盘建模 Web 应用。

## 项目结构

```
tray-creator/
├── doc/
│   ├── requirements.md          # 需求文档
│   └── implementation_plan.md   # 本文档
├── src/
│   ├── app/
│   │   ├── layout.tsx           # 根布局
│   │   ├── page.tsx             # 主页面
│   │   └── globals.css          # 全局样式
│   ├── components/
│   │   ├── ui/                  # shadcn 组件
│   │   ├── ParameterPanel.tsx   # 参数控制面板
│   │   ├── TrayViewer.tsx       # 3D 预览视口
│   │   └── ExportButton.tsx     # STL 导出按钮
│   ├── lib/
│   │   ├── tray-model.ts        # JSCAD 托盘建模核心逻辑
│   │   ├── jscad-to-three.ts    # JSCAD 几何体 → Three.js 转换
│   │   ├── stl-export.ts        # STL 序列化与下载
│   │   └── presets.ts           # 底座尺寸预设
│   ├── hooks/
│   │   └── useTrayModel.ts      # 模型生成 hook（含 debounce）
│   └── types/
│       └── tray.ts              # TypeScript 类型定义
├── package.json
├── next.config.ts
├── tailwind.config.ts
└── tsconfig.json
```

## 分步实施计划

---

### 阶段 1：项目初始化

#### [NEW] Next.js 项目脚手架

- 使用 `pnpx create-next-app@latest` 初始化项目（App Router, TypeScript, Tailwind, ESLint）
- 安装 shadcn/ui 并初始化
- 使用 pnpm 安装核心依赖：
  ```
  @jscad/modeling
  @jscad/stl-serializer
  three @types/three
  @react-three/fiber
  @react-three/drei
  ```

---

### 阶段 2：核心建模引擎

#### [NEW] [tray.ts](file:///Users/bianyunpeng/Desktop/project/mmga/tray-creator/src/types/tray.ts)

定义 TypeScript 接口：

```typescript
interface TrayParams {
  rows: number; // 行数
  columns: number; // 列数
  holeDiameter: number; // 凹槽直径 (mm)
  spacing: number; // 边缘间距 (mm)
  wallWidth: number; // 边框宽度 (mm)
  wallHeight: number; // 边框高度 (mm)
  baseThickness: number; // 底板厚度 (mm)
  holeDepth: number; // 凹槽深度 (mm)
  cornerRadius: number; // 边框圆角 (mm)
}
```

#### [NEW] [presets.ts](file:///Users/bianyunpeng/Desktop/project/mmga/tray-creator/src/lib/presets.ts)

底座预设数据：

```typescript
const BASE_PRESETS = [
  { name: "小型步兵 (25mm)", diameter: 25, tolerance: 0.5 },
  { name: "中型步兵 (28.5mm)", diameter: 28.5, tolerance: 0.5 },
  { name: "标准步兵 (32mm)", diameter: 32, tolerance: 0.5 },
  // ...
];
```

#### [NEW] [tray-model.ts](file:///Users/bianyunpeng/Desktop/project/mmga/tray-creator/src/lib/tray-model.ts)

核心建模逻辑，使用 `@jscad/modeling`：

1. 生成底板：`roundedRectangle` 拉伸为 3D → 边框圆角
2. 生成边框：外层圆角矩形 - 内层矩形 → 拉伸为墙
3. 生成凹槽：按行列网格生成 `cylinder` 阵列
4. 布尔运算：底板 ∪ 边框 − 凹槽阵列

关键建模伪代码：

```
function createTray(params):
  // 计算总宽高
  totalWidth = columns * holeDiameter + (columns - 1) * spacing + 2 * wallWidth
  totalDepth = rows * holeDiameter + (rows - 1) * spacing + 2 * wallWidth
  totalHeight = baseThickness + wallHeight

  // 1. 底板 + 边框一体（圆角长方体）
  outerShell = roundedCuboid({ size, roundRadius: cornerRadius })

  // 2. 内腔（掏空边框内部上方区域，保留底板）
  innerCavity = cuboid(...)  // 比外壳小 wallWidth*2，高度从底板顶部到顶部

  // 3. 凹槽阵列
  holes = []
  for each (row, col):
    cx = wallWidth + holeDiameter/2 + col * (holeDiameter + spacing) - totalWidth/2
    cy = wallWidth + holeDiameter/2 + row * (holeDiameter + spacing) - totalDepth/2
    hole = cylinder({ radius: holeDiameter/2, height: holeDepth })
    hole = translate([cx, cy, ...], hole)
    holes.push(hole)

  // 4. 布尔运算
  result = subtract(outerShell, innerCavity, ...holes)
  return result
```

---

### 阶段 3：JSCAD → Three.js 转换

#### [NEW] [jscad-to-three.ts](file:///Users/bianyunpeng/Desktop/project/mmga/tray-creator/src/lib/jscad-to-three.ts)

将 JSCAD 的 `geom3` 对象转换为 Three.js 的 `BufferGeometry`：

- 从 JSCAD 几何体提取多边形（`geom3.toPolygons()`）
- 三角化多边形面
- 构建 `Float32Array` 的顶点/法线数组
- 创建 Three.js `BufferGeometry`

---

### 阶段 4：3D 预览组件

#### [NEW] [TrayViewer.tsx](file:///Users/bianyunpeng/Desktop/project/mmga/tray-creator/src/components/TrayViewer.tsx)

使用 `@react-three/fiber` + `@react-three/drei`：

- `<Canvas>` 包裹 3D 场景
- `<OrbitControls>` 实现旋转/缩放/平移
- 适当的灯光（环境光 + 方向光）
- 网格地面参考线
- 模型材质：浅灰色 `MeshStandardMaterial`

---

### 阶段 5：参数面板 UI

#### [NEW] [ParameterPanel.tsx](file:///Users/bianyunpeng/Desktop/project/mmga/tray-creator/src/components/ParameterPanel.tsx)

使用 shadcn/ui 组件：

- **预设选择**：`Select` 下拉框，选择底座尺寸预设
- **行列数**：`Slider` 或 `Input`（数字输入）
- **间距**：`Slider` + 数字显示
- **边框参数**：`Input`（宽度、高度）
- **底板厚度**：`Input`
- **圆角半径**：`Slider`
- 参数联动：选择预设时自动填入凹槽直径

---

### 阶段 6：STL 导出

#### [NEW] [stl-export.ts](file:///Users/bianyunpeng/Desktop/project/mmga/tray-creator/src/lib/stl-export.ts)

- 使用 `@jscad/stl-serializer` 将 JSCAD 几何体序列化为二进制 STL
- 创建 `Blob` → `URL.createObjectURL` → 触发下载
- 文件名格式：`tray_{columns}x{rows}_{holeDiameter}mm.stl`

#### [NEW] [ExportButton.tsx](file:///Users/bianyunpeng/Desktop/project/mmga/tray-creator/src/components/ExportButton.tsx)

导出按钮组件，显示文件信息（预估尺寸）。

---

### 阶段 7：页面集成

#### [NEW] [page.tsx](file:///Users/bianyunpeng/Desktop/project/mmga/tray-creator/src/app/page.tsx)

主页面组装：

- 左侧：`ParameterPanel` + `ExportButton`
- 右侧：`TrayViewer`（占主要空间）
- 使用 `useState` 管理参数状态
- 使用 `useMemo` + debounce 控制模型重新计算频率

---

### 阶段 8：优化与收尾

- 参数变化增加 **debounce**（300ms），避免频繁重新计算
- Next.js 的 SSR 兼容处理（`dynamic import` + `ssr: false`）
- 圆柱体 `segments` 控制（默认 32，大量凹槽时可降低以提升性能）
- 亮暗主题适配

---

## 验证计划

### 自动化验证

1. **构建验证**

   ```bash
   pnpm build
   ```

   确保 Next.js 项目能够正常构建，无 TypeScript 错误。

2. **建模逻辑单元测试**（如有必要可后续添加）
   - 验证不同参数组合生成的模型尺寸是否正确
   - 验证预设底座尺寸是否正确应用公差

### 浏览器验证

1. **启动开发服务器**
   ```bash
   pnpm dev
   ```
2. **功能验证清单**：
   - [ ] 页面正常加载，3D 视口显示默认模型
   - [ ] 修改行列数 → 模型实时更新（凹槽数量正确）
   - [ ] 选择预设底座尺寸 → 凹槽直径自动更新
   - [ ] 修改间距 → 凹槽间距变化正确
   - [ ] 修改边框参数 → 边框大小和圆角变化正确
   - [ ] 3D 视口支持旋转/缩放/平移交互
   - [ ] 点击导出按钮 → 成功下载 STL 文件
   - [ ] 下载的 STL 文件可以在外部软件（如 PrusaSlicer / Cura）中正常打开

### 用户手动验证

- 请用户在切片软件中打开导出的 STL，确认：
  - 模型尺寸与参数一致
  - 凹槽深度和直径可容纳对应底座
  - 模型为实体（无穿模、无翻面）
