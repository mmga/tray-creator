# 简易阶梯模式（行模式）需求确认稿

> 日期：2026-04-08
> 状态：第一轮方向已确认
> 目标：将“简易阶梯模式”收敛为独立新模式，并明确第一版产品与实现规则

---

## 1. 已确认结论

本轮已确认以下决策：

1. 这是一个独立新模式，不重做现有 `stepped`。
2. 顶部模式栏调整为 4 栏：
   - 第 1 栏：`网格模式`
   - 第 2 栏：`自定义模式`
   - 第 3 栏：`简易阶梯模式`
   - 第 4 栏：`自定义阶梯底座`
3. 简易阶梯模式的核心对象是“行”，不是“凹槽分组”。
4. 整体底板仍然是严格长方形，长度由最长的行决定。
5. 行的“前后厚度 / 深度”由该行内最大的凹槽尺寸决定。
6. 行内允许手动拖拽，但不允许跨行移动。
7. 短于最长行的行，采用居中对齐。
8. 行与行之间的间距可配置，默认值为 `0`。
9. 第一版的高度规则不是“每行单独输入”，而是使用一个统一步进参数，按行序等差递增。

---

## 2. 模式定位

简易阶梯模式不是当前 stepped 的简化皮肤，而是一个新的编辑心智：

- 当前 stepped：自由放置凹槽，再通过分组赋予高度。
- 简易阶梯模式：先建“行”，再在每一行里布置凹槽，最后按行序自动形成阶梯。

它更适合：

- 规则排兵布阵
- 一排一排地组织底座
- 需要严格矩形底板
- 不想处理 stepped 当前那套“自由布局 + 轮廓自然生长”的用户

---

## 3. 产品定义

## 3.1 核心对象

### 行（Row）

行是简易阶梯模式的一级对象。每一行代表一个矩形阶梯带。

每行包含：

- `id`
- `name`
- `slots`
- `length`
- `depth`
- `index`

其中：

- `length` 不是手填值，而是由该行内凹槽实际排布后的左右边界自动计算。
- `depth` 由该行中最大的凹槽尺寸决定。
- `index` 决定该行在前后方向上的顺序，同时也决定该行的阶梯高度。

### 凹槽（Slot）

第一版建议继续只支持圆形凹槽。

每个凹槽至少包含：

- `id`
- `diameter`
- `x`
- `rowId`

说明：

- `x` 表示凹槽在所属行长度方向上的位置。
- `rowId` 绑定所属行。
- 不允许在简易阶梯模式中把已有凹槽拖拽到别的行。

## 3.2 整体尺寸规则

为了避免“宽度 / 长度”歧义，本文暂用以下术语：

- `长度（X）`：每一行左右展开的方向
- `深度（Y）`：多行前后堆叠的方向
- `高度（Z）`：阶梯向上增长的方向

整体尺寸规则如下：

1. `行长度`：由该行所有凹槽在 X 方向上的实际排布边界决定。
2. `行深度`：由该行里最大凹槽直径决定。
3. `整体底板长度`：取所有行中最长的一行。
4. `整体底板深度`：所有行深度累加，再叠加 `rowGap` 与外边距。
5. `整体底板外轮廓`：始终为标准长方形。

## 3.3 对齐规则

已确认采用“居中对齐，但边界长度由最长行决定”的规则：

1. 整体矩形底板的长度边界，由最长行决定。
2. 比最长行更短的行，放置在整体长度方向的中轴线上。
3. 短行不会改变外层底板长度，只会在矩形底板内部居中排布。

---

## 4. 编辑交互

## 4.1 左侧面板

建议左侧面板按以下顺序组织：

1. 行管理
2. 当前行详情
3. 向当前行添加凹槽
4. 全局结构参数
5. 统计信息
6. 生成 / 导出 / 重置

### 行管理区

建议包含：

- 新建行
- 删除行
- 行排序（上移 / 下移）
- 选中当前行
- 当前行凹槽数摘要
- 当前行长度 / 深度摘要

### 当前行详情区

建议包含：

- 行名称
- 行序号
- 推导后的阶梯高度
- 当前行长度
- 当前行深度

### 添加凹槽区

建议包含：

- 常见圆形底座预设按钮
- 添加到当前行
- 删除当前行凹槽

## 4.2 2D 编辑器

已确认：简易阶梯模式保留手动拖拽，但不允许跨行移动。

第一版建议采用下面的限制：

1. 凹槽只能在所属行内拖动。
2. 拖动主要发生在长度方向（X 方向）。
3. 凹槽的纵向位置由所属行锁定，不允许拖出该行带。
4. 不允许直接拖到另一行。
5. 如果用户要换行，第一版不提供跨行拖拽能力。

这样做的好处是：

- 保留“手动微调”的直觉体验。
- 不破坏“行是一级对象”的数据模型。
- 不会把简易模式重新做成 stepped 那种自由摆放编辑器。

## 4.3 空行策略

文档暂按以下实现假设推进：

1. 允许先创建空行，再向其中添加凹槽。
2. 空行也参与排序。
3. 空行在未添加凹槽前，不计入最终可打印几何。

这是为了降低编辑时的中断感，后续若产品上觉得多余，再收紧。

---

## 5. 高度与阶梯规则

## 5.1 第一版不做“每行独立高度”

虽然原始想法里提到“每一行可以设定一个高度”，但本轮已确认：

- 第一版先不让用户逐行分别输入高度。
- 第一版只提供一个统一的阶梯步进参数。
- 每一行的总高度由其行序自动推导。

建议参数：

- `stepHeight`

建议语义：

- 第 1 行高度 = `1 * stepHeight`
- 第 2 行高度 = `2 * stepHeight`
- 第 3 行高度 = `3 * stepHeight`

也就是说：

- 行顺序本身就是阶梯顺序
- 拖动行排序时，也是在改变高度顺序

## 5.2 为什么这样做

这样做有几个直接收益：

1. 交互更简单，不需要每行都再配一套高度控件。
2. 行排序和阶梯结果直接关联，用户更容易理解。
3. 建模逻辑更简单，第一版更容易稳定。
4. 后续如果确实需要，再升级为“统一步进 + 单行覆写高度”也比较自然。

---

## 6. 建模规则建议

简易阶梯模式建议不要复用当前 stepped 的“自然包络 + 平滑桥接”建模逻辑，而是采用矩形化、可预测的建模方式。

## 6.1 推荐几何结构

建议采用“两层结构”：

### 第 1 层：整体矩形底板

- 整个托盘先生成一个标准长方形底板。
- 该底板长度由最长行决定。
- 该底板深度由所有行深度与 `rowGap` 决定。
- 为了与“等差递增高度”匹配，底板基础高度建议直接取 `stepHeight`。

### 第 2 层：各行附加台阶

- 第 1 行不额外加高，顶部高度就是 `stepHeight`。
- 第 2 行在自己的矩形带区域额外加高 `stepHeight`。
- 第 3 行额外加高 `2 * stepHeight`。
- 以此类推。

这样最终得到的总高度就是：

- 第 N 行顶部高度 = `N * stepHeight`

这种结构能同时满足：

1. 整体底板外轮廓是长方形。
2. 行的视觉效果是清晰的台阶。
3. 行顺序和高度顺序保持一致。

## 6.2 行区域定义

每一行对应一个矩形带区域：

- 行区域长度：由该行实际凹槽排布边界决定
- 行区域深度：由该行最大凹槽尺寸决定
- 行区域在整体底板长度方向上：居中对齐
- 行区域在整体底板深度方向上：按行序依次排布

## 6.3 凹槽减材规则

建议延续现有全局凹槽深度参数：

- `holeDepth`

每个凹槽从其所在行的顶部向下减材：

1. 先确定该凹槽所属行的顶部高度。
2. 从该高度向下挖 `holeDepth`。
3. 若 `holeDepth` 超过该行当前总高度，则进行截断。

---

## 7. 数据结构建议

建议新增独立数据模型，不复用当前 `SteppedLayoutParams`。

示意如下：

```ts
type AppMode = "grid" | "custom" | "simple-stepped" | "stepped";

interface SimpleSteppedSlot {
  id: string;
  rowId: string;
  shape: "circle";
  diameter: number;
  x: number;
}

interface SimpleSteppedRow {
  id: string;
  name: string;
  slotIds: string[];
}

interface SimpleSteppedLayoutParams {
  trayWidth: number;
  trayDepth: number;
  rows: SimpleSteppedRow[];
  slots: SimpleSteppedSlot[];
  stepHeight: number;
  rowGap: number;
  spacing: number;
  outerMargin: number;
  holeDepth: number;
}
```

### 说明

1. `rows` 和 `slots` 分开存，便于拖拽更新和行排序。
2. 行高不直接存入 `row`，而是由 `row` 在数组中的顺序和 `stepHeight` 推导。
3. `rowGap` 默认值为 `0`。
4. 第一版只支持 `circle`，不引入椭圆。
5. `trayWidth` / `trayDepth` 继续保留在 params 中，但它们是派生值，不作为用户直接编辑字段。
6. `slot.x` 建议定义为“行本地坐标”，即以本行为中心线的 X 偏移量，避免短行居中时频繁重写所有槽位。

---

## 8. 第一版范围

第一版建议收敛为以下能力：

1. 新增独立模式 `simple-stepped`。
2. 顶部模式栏扩成 4 栏。
3. 左侧面板支持创建、删除、排序行。
4. 左侧面板支持向当前行添加圆形凹槽。
5. 右侧 2D 画布支持凹槽在所属行内拖拽。
6. 不支持跨行拖拽。
7. 行深度由该行最大凹槽尺寸决定。
8. 整体底板长度由最长行决定。
9. 短行在整体底板中居中。
10. 高度通过统一 `stepHeight` 参数自动等差递增。
11. 行间距 `rowGap` 可配置，默认 `0`。
12. 整体底板外轮廓永远是矩形。

第一版明确不做：

1. 不做椭圆凹槽。
2. 不做跨行拖拽。
3. 不做逐行自定义高度。
4. 不复用 stepped 的自然包络算法。

---

## 9. 预估改动范围

按当前项目结构，预计需要新增或调整的模块包括：

1. `src/types/custom-tray.ts`
   - 新增 `simple-stepped` 的类型定义
2. `src/components/ModeTabs.tsx`
   - 顶部模式栏从 3 栏扩到 4 栏
3. `src/app/page.tsx`
   - 接入新模式的状态、面板、画布与 3D 视图
4. `src/hooks/`
   - 新增 `useSimpleSteppedLayout`
5. `src/components/`
   - 新增 `SimpleSteppedPanel`
6. `src/lib/`
   - 新增简易阶梯模式的建模逻辑
   - 新增 2D 排布与尺寸计算逻辑
7. `src/lib/param-io.ts`
   - 新增新模式的导入导出协议

---

## 10. 当前结论

这次需求已经不再是“继续打磨 stepped”，而是明确收敛为：

1. 一个独立的新模式
2. 一套以“行”为核心的数据结构
3. 一种矩形底板 + 等差阶梯的建模逻辑
4. 一套“允许行内拖拽，但不允许跨行”的编辑交互

这条路线的优点是：

- 和现有 stepped 的自由模式区分清晰
- 用户心智简单
- 外形可预测
- 实现边界明确
- 后续仍保留向“逐行自定义高度”升级的空间

---

## 11. 下一步

如果后续继续推进实现文档，建议下一版文档补齐：

1. 左侧面板线框
2. 2D 画布行内拖拽规则
3. 行长度 / 行深度 / 总尺寸的精确计算公式
4. 3D 建模伪代码
5. 参数默认值与范围
6. 验收用例

---

## 12. 面板线框细化

本节把左侧面板细化到“组件块级”，方便后续直接实现。

## 12.1 行管理卡片

建议结构：

1. 卡片标题：`行管理`
2. 副标题：`{行数} 行 / {凹槽数} 个凹槽`
3. 行列表
4. 底部按钮：`新建行`

每条行项建议包含：

- 色块或序号标记
- 行名称
- 参与阶梯后的有效序号
- 当前槽位数
- 当前长度 × 深度摘要
- 上移
- 下移
- 删除

激活态建议：

- 点击某一行后，后续“添加凹槽”默认进入该行。
- 当前行在 2D 里对应的行带高亮显示。

## 12.2 当前行详情卡片

建议结构：

1. 行名称输入框
2. 文本摘要：
   - 当前行有效阶梯层级
   - 当前行顶部高度
   - 当前行长度
   - 当前行深度
3. 操作按钮：
   - 清空当前行凹槽
   - 删除当前行

这里不放单独高度输入，因为第一版高度规则由 `stepHeight` 和行序推导。

## 12.3 添加凹槽卡片

建议结构：

1. 卡片标题：`添加凹槽`
2. 提示文案：`新凹槽加入当前选中行`
3. 常见圆形底座预设按钮
4. 可选自定义输入：
   - 直径输入框
   - 添加按钮

添加后的初始位置建议：

1. 若当前行为空，默认放在行中心 `x = 0`
2. 若当前行已有凹槽，默认放在最右侧，满足最小 `spacing`

## 12.4 全局结构参数卡片

建议包含以下参数：

- `spacing`
  含义：同行内凹槽之间允许的最小边缘距离
- `outerMargin`
  含义：凹槽到所属行矩形边界的最小安全边距
- `rowGap`
  含义：行矩形之间的前后间距，默认 `0`
- `stepHeight`
  含义：阶梯统一步进高度
- `holeDepth`
  含义：凹槽下挖深度

建议第一版不暴露 `trayWidth` / `trayDepth` 输入，因为整体尺寸由布局自动推导。

## 12.5 统计信息卡片

建议展示：

- 行数
- 凹槽数
- 预估长度
- 预估深度
- 最高点高度
- 估重
- 报价
- 超限警告

其中：

- 长度 / 深度取派生后的 `trayWidth` / `trayDepth`
- 高度取 `非空行数量 * stepHeight`

## 12.6 操作区

建议保留现有模式一致的动作：

- 开始锻造
- 导出 STL
- 导出参数
- 导入参数
- 重置参数

第一版不接 stepped 草稿系统，除非后续明确要求。

---

## 13. 2D 画布与拖拽规则细化

## 13.1 推荐复用策略

当前项目已有一套较重的 [`LayoutCanvas`](d:\project\mmga\modelling-tools\tray-creator\src\components\LayoutCanvas.tsx)，包含：

- 缩放 / 平移
- 单选 / 多选 / 框选
- 多选拖拽
- 碰撞检测
- 删除 / 撤销 / 对齐工具

建议第一版优先复用 `LayoutCanvas`，不要新 fork 一套 `SimpleSteppedCanvas`。

但需要为它补 3 类可选扩展：

1. 行带叠加层
2. 行内拖拽约束
3. 简易阶梯模式下的选择 / 多拖拽范围控制

## 13.2 行带可视化

建议在 2D 里增加半透明行带矩形，用于明确告诉用户：

- 每一行的矩形边界
- 哪一行是当前激活行
- 各行在整体底板中的居中关系

建议新增一个供 `LayoutCanvas` 渲染的派生数据：

```ts
interface SimpleSteppedRowBand {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  depth: number;
  isActive: boolean;
  topHeight: number;
}
```

## 13.3 拖拽规则

已确认的硬规则：

1. 凹槽允许手动拖拽
2. 不允许跨行移动

建议进一步细化为：

1. 凹槽可在所属行内自由调整 `x`
2. 凹槽的 `y` 不允许脱离该行中心线
3. 若拖拽过程中用户试图把凹槽拖出本行，直接吸附回本行
4. 多选拖拽时，只允许移动与“当前被抓取凹槽”同一行的选中项
5. 跨行被选中的其他凹槽保留选中状态，但不参与这次拖拽

这条规则很重要，因为当前 `LayoutCanvas` 默认会把所有选中项一起移动。

## 13.4 框选与删除规则

建议第一版保留：

- 跨行框选
- 多选删除
- 单个删除

但要区分：

- 删除可以跨行批量做
- 拖拽不可以跨行批量做

## 13.5 碰撞与约束

建议继续保留现有碰撞提示，但语义调整为：

1. 同一行内：凹槽之间不能小于最小 `spacing`
2. 不同行：理论上由行带深度和 `rowGap` 保证不重叠，一般不会触发碰撞
3. 超出最大构建尺寸时：提示超限并禁用生成

## 13.6 拖拽时长度变化

因为行长度由该行实际布局决定，所以当用户把某个凹槽往更左或更右拖时：

1. 当前行长度会变
2. 若该行成为新的最长行，整体底板长度也会变
3. 其他短行仍然保持“相对整体居中”

这意味着：

- 简易阶梯模式的整体长度是动态派生值，不是固定画布边界

因此实现上建议：

- 在拖拽 live update 阶段就重新计算派生尺寸
- 若新尺寸超过 `MAX_BUILD_SIZE`，则钳制或拒绝该次拖动

---

## 14. 关键公式与派生数据

为避免实现时重复推导，建议把布局计算集中在一个纯函数模块里，例如：

- `src/lib/simple-stepped-layout.ts`

## 14.1 单槽有效尺寸

```ts
effectiveDiameter = slot.diameter + getSlotTolerance(slot.diameter)
slotLeft = slot.x - effectiveDiameter / 2
slotRight = slot.x + effectiveDiameter / 2
```

其中 `slot.x` 为“行本地坐标”。

## 14.2 单行尺寸

对非空行：

```ts
rowHoleMinX = min(slotLeft)
rowHoleMaxX = max(slotRight)
rowHoleSpan = rowHoleMaxX - rowHoleMinX
rowMaxDiameter = max(effectiveDiameter)

rowLength = rowHoleSpan + outerMargin * 2
rowDepth = rowMaxDiameter + outerMargin * 2
```

对空行：

```ts
rowLength = 0
rowDepth = 0
```

并且空行不参与最终几何和最终尺寸计算。

## 14.3 整体尺寸

设 `activeRows` 为所有非空行，按列表顺序排列。

```ts
trayWidth = max(activeRows.map(row => rowLength), 0)
trayDepth = sum(activeRows.map(row => rowDepth)) + rowGap * max(activeRows.length - 1, 0)
trayHeight = activeRows.length * stepHeight
```

## 14.4 行中心位置

设第 `i` 个非空行为 `activeRows[i]`，其深度为 `rowDepth[i]`。

```ts
rowStartY[i] =
  sum(rowDepth[0..i-1]) +
  rowGap * i

rowCenterY[i] = rowStartY[i] + rowDepth[i] / 2
```

长度方向统一居中：

```ts
rowHoleCenterX = (rowHoleMinX + rowHoleMaxX) / 2
slotGlobalX = trayWidth / 2 + (slot.x - rowHoleCenterX)
slotGlobalY = rowCenterY[rowIndex]
```

注意：

- `slot.x` 是行本地坐标，不要求始终围绕 0 对称
- 行实际居中基于该行当前孔位包围盒中心，而不是基于某个固定锚点
- 行变长或变短时，不需要重写所有槽位，只需重算 `trayWidth`

## 14.5 行顶部高度

```ts
rowTopHeight[i] = (i + 1) * stepHeight
rowExtraHeight[i] = i * stepHeight
```

其中：

- 第 1 行只有基础底板高度
- 第 2 行在基础底板上再加 1 个 `stepHeight`
- 第 3 行再加 2 个 `stepHeight`

## 14.6 构建上限检查

```ts
isOversized = trayWidth > MAX_BUILD_SIZE || trayDepth > MAX_BUILD_SIZE
```

若超限：

1. 面板显示警告
2. 开始锻造按钮禁用
3. 拖拽时尽量阻止进一步把尺寸推大

---

## 15. 3D 建模伪代码

建议新增：

- `src/lib/simple-stepped-tray-model.ts`

伪代码如下：

```ts
function createSimpleSteppedTrayModel(params) {
  const derived = deriveSimpleSteppedLayout(params)
  const rows = derived.activeRows

  if (rows.length === 0) {
    return emptyGeom()
  }

  const baseHeight = params.stepHeight

  // 1. 整体矩形底板
  let solid = extrudeRect({
    width: derived.trayWidth,
    depth: derived.trayDepth,
    height: baseHeight,
  })

  // 2. 逐行叠加矩形台阶
  rows.forEach((row, index) => {
    const extraHeight = index * params.stepHeight
    if (extraHeight <= 0) return

    const rowRect = extrudeRect({
      width: row.length,
      depth: row.depth,
      height: extraHeight,
    })

    solid = union(
      solid,
      translateRowRectToTray(rowRect, row)
    )
  })

  // 3. 按各行顶部高度减去凹槽
  const holes = rows.flatMap((row, index) =>
    row.slots.map((slot) => {
      const topHeight = (index + 1) * params.stepHeight
      const clampedDepth = min(params.holeDepth, topHeight)
      return buildHoleAt(slot.globalX, slot.globalY, topHeight, clampedDepth)
    })
  )

  return subtract(solid, ...holes)
}
```

这个模型与当前 stepped 的关键不同点：

1. 不做平滑包络
2. 不做轮廓桥接
3. 每行直接是显式矩形
4. 整体底板直接是显式矩形

---

## 16. 文件级实施计划

## 16.1 类型与配置

### [src/types/custom-tray.ts](d:\project\mmga\modelling-tools\tray-creator\src\types\custom-tray.ts)

需要新增：

1. `AppMode` 扩展为 `"grid" | "custom" | "simple-stepped" | "stepped"`
2. `SimpleSteppedSlot`
3. `SimpleSteppedRow`
4. `SimpleSteppedLayoutParams`
5. 可选的 `SimpleSteppedRowBand`

### [src/lib/config.ts](d:\project\mmga\modelling-tools\tray-creator\src\lib\config.ts)

需要新增：

1. `SIMPLE_STEPPED_LAYOUT_DEFAULTS`
2. `SIMPLE_STEPPED_LIMITS`
3. 默认参数建议：
   - `stepHeight`
   - `rowGap = 0`
   - `spacing`
   - `outerMargin`
   - `holeDepth`

## 16.2 派生计算模块

### 新增 `src/lib/simple-stepped-layout.ts`

职责建议拆成纯函数：

1. `deriveSimpleSteppedLayout(params)`
2. `calculateSimpleSteppedDimensions(params)`
3. `buildSimpleSteppedRowBands(params)`
4. `clampSimpleSteppedSlotUpdates(params, updates)`

这是整个模式的“规则中心”，建议所有 UI / hook / 建模都复用它，避免多处重复算尺寸。

## 16.3 状态管理 Hook

### 新增 `src/hooks/useSimpleSteppedLayout.ts`

职责：

1. 管理 `params`
2. 管理撤销历史
3. 管理派生尺寸
4. 提供行 CRUD
5. 提供添加凹槽
6. 提供凹槽拖拽更新
7. 接入 worker 生成与 STL 导出

建议暴露的方法：

1. `addRow()`
2. `removeRow(rowId)`
3. `renameRow(rowId, name)`
4. `reorderRows(fromIndex, toIndex)`
5. `setActiveRow(rowId)`
6. `addSlotToRow(rowId, diameter)`
7. `removeSlot(id)`
8. `updateMultipleSlots(updates)`
9. `updateMultipleSlotsLive(updates)`
10. `handleGenerate()`
11. `handleExportSTL()`

这里的 `updateMultipleSlots*` 需要在 hook 内调用 `clampSimpleSteppedSlotUpdates`，把所有更新收敛到“本行内合法位置”。

## 16.4 画布复用改造

### [src/components/LayoutCanvas.tsx](d:\project\mmga\modelling-tools\tray-creator\src\components\LayoutCanvas.tsx)

建议只做“可选增强”，不要在这里写死 simple-stepped 业务。

建议新增可选 props：

1. `rowBands?: SimpleSteppedRowBand[]`
2. `slotMoveScopeResolver?: (draggingId: string, selectedIds: string[]) => string[]`
3. `renderSlotMeta?: (slotId: string) => { color?: string; dimmed?: boolean }`

最小可行方案：

1. 渲染行带矩形
2. 拖拽开始时根据 resolver 计算本次实际参与移动的 id 集合
3. 其他逻辑尽量复用原有拖拽路径

如果实施过程中发现改造 `LayoutCanvas` 代价过大，再退回到新建 `SimpleSteppedCanvas`，但这应作为备选而不是首选。

## 16.5 模式面板与页面接入

### 新增 `src/components/SimpleSteppedPanel.tsx`

职责：

1. 行管理 UI
2. 当前行详情 UI
3. 添加凹槽 UI
4. 参数区 UI
5. 统计区 UI
6. 操作按钮 UI

### [src/components/ModeTabs.tsx](d:\project\mmga\modelling-tools\tray-creator\src\components\ModeTabs.tsx)

需要：

1. 改成 4 栏
2. 新增“简易阶梯模式”入口

### [src/app/page.tsx](d:\project\mmga\modelling-tools\tray-creator\src\app\page.tsx)

需要：

1. 接入 `useSimpleSteppedLayout`
2. 在 `renderParameterPanel` 中渲染 `SimpleSteppedPanel`
3. 在 `renderViewport` 中让 simple-stepped 也走 2D / 3D 双视图
4. 给 `LayoutCanvas` 传入行带与拖拽约束

## 16.6 参数导入导出

### [src/lib/param-io.ts](d:\project\mmga\modelling-tools\tray-creator\src\lib\param-io.ts)

需要新增：

1. `ExportableParams` 支持 `SimpleSteppedLayoutParams`
2. `modeNames.simple-stepped`
3. `validateSimpleSteppedParams`
4. `parseParamFileObject(..., "simple-stepped")`

第一版不需要和现有 stepped 做自动迁移。

### [src/components/ParamIOButtons.tsx](d:\project\mmga\modelling-tools\tray-creator\src\components\ParamIOButtons.tsx)

只要类型联合补齐，组件本身大概率可直接复用。

## 16.7 3D 建模与 worker

### 新增 `src/lib/simple-stepped-tray-model.ts`

负责：

1. 纯几何建模
2. 尺寸计算辅助

### [src/lib/worker/tray.worker.ts](d:\project\mmga\modelling-tools\tray-creator\src\lib\worker\tray.worker.ts)

需要新增：

1. `GENERATE_SIMPLE_STEPPED`
2. 对应的 worker 分支

### [src/lib/worker/worker-service.ts](d:\project\mmga\modelling-tools\tray-creator\src\lib\worker\worker-service.ts)

需要新增：

1. `generateSimpleStepped(params)`

注意：

- 简易阶梯模式不需要 stepped 那套 outline preview worker 通道

## 16.8 报价与统计

### [src/lib/pricing.ts](d:\project\mmga\modelling-tools\tray-creator\src\lib\pricing.ts)

建议新增：

1. `calculateSimpleSteppedPrice`

虽然第一版可以直接复用 `weight * 0.4` 的逻辑，但单独起名更清晰。

---

## 17. 分阶段开发任务

## 阶段 1：类型与纯函数打底

目标：

- 把 simple-stepped 的类型、默认值、校验和尺寸推导函数先建立起来

任务：

1. 更新 `AppMode`
2. 新增 simple-stepped 类型
3. 新增默认参数和 limits
4. 新增 `deriveSimpleSteppedLayout`
5. 新增参数导入导出校验

验收：

1. 可以在纯函数层正确算出行尺寸和整体尺寸
2. `param-io` 能导入 / 导出新模式 JSON

## 阶段 2：状态 Hook 与建模

目标：

- 让新模式先在无 UI 的情况下具备可生成能力

任务：

1. 新增 `useSimpleSteppedLayout`
2. 新增 `createSimpleSteppedTrayModel`
3. 接通 worker 请求链路
4. 跑通生成和 STL 导出

验收：

1. 给定一组 params 能生成 3D 模型
2. STL 与参数 sidecar JSON 可导出

## 阶段 3：左侧面板

目标：

- 先让用户可以在面板完成全部编辑动作

任务：

1. 新增 `SimpleSteppedPanel`
2. 接入行管理
3. 接入添加凹槽
4. 接入全局参数编辑
5. 接入统计与操作按钮

验收：

1. 不依赖 2D 拖拽，也能完成完整配置
2. 派生尺寸和高度显示正确

## 阶段 4：2D 画布约束与行带

目标：

- 让 simple-stepped 在 2D 里拥有“行内拖拽”的专属交互

任务：

1. 为 `LayoutCanvas` 增加行带渲染
2. 增加拖拽范围约束
3. 增加同拖拽根凹槽同一行的批量移动规则
4. 增加超限钳制

验收：

1. 槽位可在所属行内拖动
2. 槽位不能被拖到别的行
3. 多选跨行时，只移动当前行的选中项

## 阶段 5：页面集成与回归

目标：

- 把模式接入主页并保证旧模式不被破坏

任务：

1. 更新 `ModeTabs`
2. 更新 `page.tsx`
3. 回归 grid / custom / stepped
4. 校验模式切换时状态清理

验收：

1. 顶栏正确显示 4 栏
2. 新旧模式都可正常工作
3. 模式切换不串状态

---

## 18. 验收用例

建议至少覆盖以下手动用例：

1. 进入简易阶梯模式后，顶部显示为第 3 栏，现有 stepped 顺延到第 4 栏。
2. 新建 3 行，不添加任何凹槽时，不会生成异常几何。
3. 向第 1 行添加 3 个圆槽，向第 2 行添加 2 个圆槽，向第 3 行添加 1 个圆槽，整体长度取最长行。
4. 第 2、3 行在长度方向保持居中，不改变整体矩形外轮廓。
5. 调整 `rowGap` 后，整体深度发生正确变化。
6. 调整 `stepHeight` 后，各行顶部高度按等差关系变化。
7. 拖动某个凹槽时，只能在所属行内移动，不能跨行。
8. 跨两行框选多个凹槽后，拖动其中一个，只移动同一行内的选中项。
9. 拖动某个凹槽拉长一行后，若该行成为最长行，整体底板长度同步更新。
10. 当派生长度或深度超过 `260mm` 时，界面提示超限并禁止锻造。
11. 导出参数后可重新导入到 simple-stepped 模式。
12. 导出 STL 后附带的 JSON sidecar 能重新导入。
13. 切回 grid / custom / stepped 后，现有模式行为不回归。

---

## 19. 目前仍保留的实现假设

为了让计划继续推进，本文暂时保留以下实现假设：

1. 空行允许存在，但不参与最终几何和阶梯高度计算。
2. 第一版不接草稿系统。
3. 第一版不提供“把凹槽从 A 行移动到 B 行”的面板动作，若后续需要可补一个“移动到行”按钮。
4. 第一版长度方向不设置固定边界，整体底板长度完全由当前最长行派生。
5. 为了复用现有画布和 worker 结构，`trayWidth` / `trayDepth` 作为派生字段保留在 params 中。

如果这些假设后续有变，优先影响的是：

1. `deriveSimpleSteppedLayout`
2. `useSimpleSteppedLayout`
3. `LayoutCanvas` 的交互约束
