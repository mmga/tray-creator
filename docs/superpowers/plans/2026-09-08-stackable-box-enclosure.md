# 矩形托盘堆叠盒体开发计划

> 日期：2026-09-08  
> 状态：需求访谈完成，待实施  
> 适用模式：`grid`、`custom` 的矩形外轮廓  
> 不适用模式：`stepped`、贴合轮廓 `custom`、`base-converter`

> **截面方案已被替代：** 本计划中的“底部环形凸缘 + 顶部环形凹槽”仅保留为历史需求记录。当前实施以 [堆叠盒体倒角导向装配开发设计](../specs/2026-09-08-stackable-box-chamfer-guided-assembly-design.md) 为准，参数入口、模式范围、导出协议和其余产品约束仍可作为参考。

## 1. 目标

在现有矩形托盘能力上增加可选的“堆叠盒体”外壳结构：用户先定义盒体外部长、宽、高，再在盒内保留或编辑原有托盘凹槽。盒体四周具有连续高墙，可以不带盖直接自定位堆叠；另生成一个简单平板盖。

本功能不是第五个 Mode。它是 `grid` 与矩形 `custom` 共享的结构能力，继续复用现有槽位定义、底板孔位、草稿、参数导入导出、Worker 建模和 STL 下载链路。

## 2. 已确认的产品规则

### 2.1 范围与布局

- 盒内保留托盘凹槽，不做“用盒子装入多个完整托盘”的可拆内件方案。
- `grid` 的圆形槽、旧世界矩形槽和“仅内嵌孔底板”均可使用盒体。
- `grid` 半圆槽不可使用盒体；启用盒体时将其切换为完整槽并提示。
- `custom` 仅在 `footprintStyle=rectangular` 时可用盒体；允许零槽位空盒。
- `stepped` 即使使用矩形外轮廓，也不可使用盒体。
- 用户手动设置网格行列数，系统不自动增删槽位。
- `grid` 槽位阵列在盒内 X/Y 居中；盒体外尺寸不会因槽位变化而自动扩大。
- `custom` 延续现有左下角坐标系和自由排布。显式执行“扩展盒体至刚好容纳”时，保持槽位相对位置并将整组居中；该操作只提交一个 Undo 步骤。
- 槽位与盒体的四边实际余量是派生结果；用户配置的是“最小内壁间距”，默认 `2 mm`。
- 盒体结构下，任一槽位侵入最小内壁间距区域都会阻止生成和导出。普通 `custom` 托盘原有的宽松越界规则保持不变。

### 2.2 外尺寸与垂直尺寸

- 用户输入的是盒体真实外部长、宽、高。
- 外部长宽在整个高度上保持不变；盒体禁用原有整件侧面斜面。
- 盒体外高从底部最低点量到盒口最高点，不包含盖板高出盒口的厚度。
- 盒体首次启用时默认外高 `50 mm`。
- 从自动尺寸托盘启用盒体时，一次性计算当前布局可容纳的初始外部长宽；之后尺寸完全由用户控制。
- 关闭盒体后，原托盘的尺寸模式、边界间距、圆角和侧面斜面配置复活；盒体参数休眠保留。
- 盒体外壁必须至少高出内部托盘顶面 `2.4 mm`。低于该硬下限时阻止生成；高出不足 `10 mm` 时只提示“浅盒”。
- 长、宽、高任一轴超过 `260 mm` 时提示超过常规打印尺寸，但仍允许生成和导出，不自动拆件。
- 不记录微缩模型身体包围盒；只保证托盘与槽位几何合法，并展示实际内部净高。

### 2.3 固定制造规格

以下规格不进入普通参数面板，不允许逐模型修改：

| 规格 | 数值 |
| --- | ---: |
| 主体墙厚 | `2.4 mm` |
| 外轮廓圆角 | `6.0 mm` |
| 顶部局部承重边宽 | `6.0 mm` |
| 底部定位凸缘宽 | `1.2 mm` |
| 底部定位凸缘高度 | `1.2 mm` |
| 顶部定位凹槽深度 | `1.4 mm` |
| 凸缘与凹槽底部余量 | `0.2 mm` |
| 定位环中心线距外侧面 | `3.0 mm` |
| 凸缘入口倒角 | `0.3 mm × 45°` |

主体墙厚固定为 `2.4 mm`，但盒口最后 `2.4 mm` 高度范围内允许向内局部加宽到 `6.0 mm`，以容纳定位凹槽和每侧约 `2.15 mm` 的水平承重肩。功能结构不得突破用户输入的外部长宽。

### 2.4 自堆叠结构

- 仅外部长宽相同的盒体保证互相堆叠，高度和内部槽位可以不同。
- 上方盒子的底部具有靠近外轮廓的连续环形凸缘；下方盒口具有对应连续环形凹槽。
- 凸缘与凹槽不紧贴最外缘，避免外缘磕碰直接破坏定位。
- 凸缘入口有倒角，XY 方向保留打印配合间隙。
- XY 配合间隙是高级参数，表示每侧间隙；默认 `0.25 mm`，范围 `0.15–0.50 mm`。
- 凹槽比凸缘深 `0.2 mm`，堆叠载荷由盒口与盒底的平面肩部承担，不由凹槽底面承担。
- 为避免正向 FDM 打印出现整块悬空底板，盒底中央平面与凸缘最低面齐平，外围承重肩抬高 `1.2 mm`。堆叠后，上层中央盒底会进入下层盒口 `1.2 mm`。
- 同时展示两种净高：盖上独立盖子时的“带盖净高”，以及直接堆叠时扣除 `1.2 mm` 侵入量后的“堆叠安全净高”。涉及安全提示时使用后者。

### 2.5 盖子

- 盖子是与盒体外部长宽相同、侧边基本齐平的简单平板盖。
- 盖子靠重力放置，不使用卡扣、摩擦锁紧或外包裙边。
- 盖子底部复用与盒底相同的定位轮廓，与盒口凹槽间隙配合。
- 盖板厚度是高级参数，默认 `2.4 mm`，范围 `2.0–4.0 mm`。
- 两个相对短边各提供一个浅指甲槽，不突破外尺寸、不切断连续定位轮廓。首版固定为宽 `18 mm`、高 `1.0 mm`、向内深 `1.2 mm`。
- 预览中同时显示直立盒体和旁置盖子，首版不提供闭合视图或爆炸图。
- 盖子在 STL 和旁置预览中采用外表面朝下的免支撑打印方向，定位结构朝上。

### 2.6 生成与导出

- 一次生成同一参数快照下的盒体与盖子。
- 导出两个独立 STL 和一个伴随参数 JSON，不生成 ZIP，也不把两个零件塞入同一个 STL。
- 建议文件名：
  - `box_grid_{宽}x{深}x{高}_{列}x{行}_body.stl`
  - `box_grid_{宽}x{深}x{高}_{列}x{行}_lid.stl`
  - `box_custom_{宽}x{深}x{高}_{槽位数}slots_body.stl`
  - `box_custom_{宽}x{深}x{高}_{槽位数}slots_lid.stl`
- 普通托盘的文件名和单 STL 导出行为完全不变。
- 访谈结束前最后一个统计问题未单独确认；首版按推荐默认实施：分别显示盒体、盖子及合计体积/估算重量。若实施前决定缩小范围，可以只保留合计值，不影响几何和文件格式。

## 3. 明确不做

- 不新增第五个盒体 Mode。
- 不支持阶梯托盘、贴合轮廓或底盘转换模式。
- 不支持不同长宽盒子的模块化混搭堆叠。
- 不支持卡扣、铰链、磁吸盖、密封圈、提手或外包裙边。
- 不记录模型身体高度或横向包围盒，不进行内容物碰撞分析。
- 不增加自动行列计算、自动压缩槽距或隐式扩大盒体。
- 不增加盒体或盖子的自动拆件。
- 不增加打印机配置档案。
- 不增加新依赖，不创建通用 CAD 装配框架。

## 4. 参数模型

### 4.1 共享类型

在 `src/types/tray.ts` 中增加共享类型，并让 `TrayParams` 与 `CustomLayoutParams` 都持有可选的盒体参数快照：

```ts
export interface StackableBoxParams {
  enabled: boolean;
  outerWidth: number;
  outerDepth: number;
  outerHeight: number;
  minimumWallClearance: number;
  xyFitClearance: number;
  lidThickness: number;
}

export interface StackableBoxCapableParams {
  stackableBox?: StackableBoxParams;
}
```

`stackableBox` 保持可选是为了让现有测试夹具、历史草稿和旧参数文件自然兼容。运行时统一通过 resolver 补全，不允许业务代码散落 `??` 默认值。

### 4.2 默认值与范围

新增 `src/lib/stackable-box.ts`，集中拥有固定制造规格、默认参数、范围和纯几何投影：

- `enabled=false`
- `outerHeight=50`
- `minimumWallClearance=2`，范围 `0–20 mm`
- `xyFitClearance=0.25`，范围 `0.15–0.50 mm`
- `lidThickness=2.4`，范围 `2.0–4.0 mm`
- 盒体外部长宽范围为 `30–5000 mm`，使用 `0.1 mm` 精度；`30 mm` 下限同时保证固定 `6 mm` 圆角、`4 mm` 顶边和 `18 mm` 短边指甲槽仍有有效几何。
- 高度允许到 `5000 mm`，但使用动态结构下限；任一轴超过 `MAX_BUILD_SIZE=260 mm` 仅警告。

### 4.3 休眠规则

- `grid` 盒体关闭时继续使用当前自动外形公式；盒体外尺寸休眠。
- `grid` 盒体开启时，原 `boundarySpacing`、`cornerRadius`、`sideBevelWidth` 休眠；槽间距与底板孔位继续生效。
- `custom` 盒体开启时按固定外尺寸解释，但不覆写持久化的 `traySizingMode`、`cornerRadius`、`sideBevelWidth`。关闭盒体后这些字段按原值复活。
- `custom` 切换为 `contoured` 时自动关闭盒体并保留盒体参数，同时显示一次非阻塞提示。
- 参数指纹天然包含 `stackableBox`，无需单独维护缓存失效字段。

## 5. 纯布局与校验模型

### 5.1 盒内可用轮廓

盒口最窄处由 `6.0 mm` 顶部承重边决定。槽位允许区域按以下方式计算：

```text
usableInset = TOP_RIM_WIDTH + minimumWallClearance
usableWidth = outerWidth - 2 × usableInset
usableDepth = outerDepth - 2 × usableInset
usableCornerRadius = max(OUTER_CORNER_RADIUS - usableInset, 0)
```

校验使用最终槽位轮廓，不使用名义底盘尺寸：圆形使用最终直径，矩形使用最终宽深，椭圆使用外扩后的旋转轮廓。

复用 `custom-layout-math.ts` 已有的圆角区域采样判定思路；把可复用的“轮廓是否完全位于圆角矩形内”提取为纯函数，避免网格与自由布局各写一套近似判断。

### 5.2 网格布局

```text
contentWidth = finalSlotWidth + (columns - 1) × pitchX
contentDepth = finalSlotHeight + (rows - 1) × pitchY
centerX = outerWidth / 2
centerY = outerDepth / 2
```

槽位中心围绕盒体中心对称排布。现有矩形槽 pitch 仍按名义底盘尺寸计算，不能在盒体分支中改写旧世界排列语义。

“扩展盒体至刚好容纳”计算满足圆角轮廓校验的最小长宽，向上取到 `0.1 mm`，不改行列、槽距或槽位定义。

### 5.3 自由布局

- 盒体坐标系继续是左下角 `(0, 0)` 到 `(outerWidth, outerDepth)`。
- 2D 画布显示盒体外轮廓，以及按 `usableInset` 内缩后的可用区域。
- 越界槽位继续标红，但盒体开启时额外进入生成/导出阻断原因。
- “扩展盒体至刚好容纳”复用现有 `trimCustomBaseplate` 的整组平移思想：先求最终槽位轮廓外接范围，再加两侧 `usableInset`，设置新外尺寸并将槽位组居中。空盒不执行该操作。

### 5.4 高度公式

普通完整槽和自由布局：

```text
trayTopZ = baseThickness + holeDepth
slotFloorZ = baseThickness
minimumOuterHeight = trayTopZ + MIN_WALL_RISE
lidClearHeight = outerHeight - slotFloorZ
stackClearHeight = lidClearHeight - FLANGE_HEIGHT
closedOuterHeight = outerHeight + lidThickness
```

`basePlateOnly`：

```text
trayTopZ = baseThickness
minimumOuterHeight = baseThickness + MIN_WALL_RISE
```

校验顺序固定为：字段有限数值与范围 → 模式兼容 → 盒体结构下限 → 槽位边界 → 既有底板孔位适配。返回一个权威阻断结果，供画布、面板、生成和导出共同消费。

### 5.5 错误与提示

阻断错误至少覆盖：

- 外部长宽无法容纳固定圆角和顶部承重边。
- 外高低于动态结构下限。
- `custom` 非矩形轮廓却启用盒体。
- `grid` 半圆槽与盒体同时出现。
- 一个或多个槽位进入盒体安全边界。
- 配合间隙或盖板厚度超出范围。
- 既有磁吸孔或磁柱孔不适配。

非阻断提示至少覆盖：

- 盒壁高出托盘顶面不足 `10 mm`。
- 长、宽、高任一轴超过 `260 mm`。

越界提示必须给出当前外尺寸、最小所需外尺寸和 X/Y 差值，并提供显式“扩展盒体至刚好容纳”操作。

## 6. CAD 构造方案

新增 `src/lib/stackable-box-model.ts`，只拥有盒壳、底部定位截面、顶部凹槽、盖子和旁置预览组合，不理解网格或自由槽位。

### 6.1 盒体空白主体

1. 使用固定 `6 mm` 圆角矩形生成从 `Z=0` 到 `trayTopZ` 的完整底部实体。
2. 从 `trayTopZ` 到 `outerHeight` 生成 `2.4 mm` 主墙环。
3. 在盒口最后 `2.4 mm` 高度内，向内补齐为 `6.0 mm` 宽的顶部承重环。
4. 从顶部向下切出 `1.4 mm` 深的连续圆角矩形环槽。
5. 在底面切出两侧承重肩的浅凹区，使中央底面和 `1.2 mm` 宽定位轮廓保留在最低面，承重肩位于 `Z=1.2 mm`。
6. 对定位入口施加 `0.3 mm × 45°` 倒角；倒角不得改变承重肩接触高度。
7. 上盒底部增加从定位凸缘向盒体外轮廓展开的连续斜坡，内侧保持竖直定位面；下盒在凹槽外侧增加匹配的上部避让腔，保证斜坡完整进入而不与下盒实体交叠。
8. 上下盒叠放时由凹槽内缘连续水平承重肩承载，默认宽约 `2.15 mm`；斜坡只负责导入，并通过几何测试保证同尺寸盒体无实体交叠。

顶部凹槽横截面宽度：

```text
grooveWidth = FLANGE_WIDTH + 2 × xyFitClearance
```

默认时为 `1.7 mm`；默认间隙下 `6.0 mm` 顶部承重边在凹槽内缘保留约 `2.15 mm` 水平承重肩。凹槽外侧另设斜坡接收避让，斜坡承担导入而非主要载荷。

### 6.2 模式集成

- `tray-model.ts`：盒体关闭时走现有代码；开启时使用盒体空白主体，然后按现有坐标和深度减去网格槽、零间距岛区以及底板孔位。
- `custom-tray-model.ts`：仅矩形盒体进入新主体分支；槽位坐标、旋转、椭圆外扩和底板孔位继续使用现有实现。
- 槽位切削高度只覆盖 `trayTopZ` 到槽底，不得把高墙当作整块实体后从顶部贯穿切槽。
- 外圆角与斜面参数在盒体分支中忽略但不删除，以保证关闭盒体后恢复。

### 6.3 盖子

1. 生成与盒体外长宽、`6 mm` 圆角一致的平板。
2. 在装配面生成与盒底相同的定位轮廓，使用相同 XY 间隙规则。
3. 在两个短边中部切出固定指甲槽，避开定位轮廓。
4. STL 坐标中将盖子翻转为大平面贴床、定位结构朝上的打印方向。

### 6.4 旁置预览

不修改 `TrayViewer` 为通用装配查看器。Worker 仅为预览把直立盒体与打印方向的盖子按固定视觉间距摆开，并组合成一个包含两个不相连壳体的 `Geom3`；现有 Three.js 转换、相机适配和单模型材质即可继续工作。

## 7. Worker、生命周期与导出

### 7.1 预览

- 保持现有 `GENERATE_GRID`、`GENERATE_CUSTOM` 请求入口。
- 普通托盘仍返回单体几何。
- 盒体参数开启时，Worker 创建盒体与盖子，并返回旁置组合几何。
- Worker 同时返回可选的 `bodyVolume`、`lidVolume`；`volumeInfo` 为二者合计。
- `usePreviewLifecycle` 只增加可选体积分项状态，不改变其他 Mode 的调用合同。

### 7.2 导出

新增两个明确的 Worker 请求，不创建抽象装配协议：

- `GENERATE_GRID_BOX_PARTS`
- `GENERATE_CUSTOM_BOX_PARTS`

它们从同一个 `ModeParamSnapshot` 重新生成未平移的盒体和已按打印方向放置的盖子。导出服务在盒体开启时忽略旁置预览几何，分别序列化两个零件；普通托盘继续复用缓存的单体几何。

`model-artifact-bundle.ts` 已支持多个命名文件，直接返回 `[bodyStl, lidStl]`，再由现有逻辑统一追加参数 JSON。无需 ZIP、无需修改下载端口。

### 7.3 一致性保证

- 导出前继续捕获不可变 Mode Param Snapshot。
- 盒体和盖子必须由同一快照生成。
- 参数在生成过程中变化时，旧请求结果按现有序列规则丢弃。
- 文件全部准备成功后才依次触发下载；任一下载失败继续使用现有聚合错误。

## 8. UI 与结果投影

### 8.1 共享配置组件

新增 `src/components/StackableBoxConfig.tsx`，在 `ParameterPanel.tsx` 与 `CustomPanel.tsx` 中复用。组件只负责展示和事件转发，不拥有归一化、几何或越界规则。

组件包含：

- “普通托盘 / 堆叠盒体”结构切换。
- 外部长度、宽度、高度。
- 最小内壁间距。
- 高级区：XY 配合间隙、盖板厚度。
- 固定制造规格只读摘要。
- 当前可用宽深、带盖净高、堆叠安全净高。
- 越界差值和“扩展盒体至刚好容纳”按钮。
- 浅盒、超常规打印尺寸提示。

### 8.2 网格面板

- 盒体开启时隐藏或标记休眠的边界间距、圆角和侧面斜面控件。
- 保留行列、槽位定义、X/Y 槽距、底板厚度、凹槽深度和底板孔位。
- 半圆槽按钮禁用；若启用盒体前处于半圆槽，切换到完整槽。
- `GridLayoutPreview` 使用固定外尺寸并把网格阵列居中，显示顶部承重边内侧的安全区域。

### 8.3 自由布局面板与画布

- 仅矩形外轮廓显示盒体入口；阶梯面板和贴合轮廓分支不渲染入口。
- 盒体开启时，尺寸 UI 呈现为固定外尺寸，但底层保留原 `traySizingMode` 供关闭后恢复。
- `LayoutCanvas` 使用盒体安全区域作为边界判定，越界槽位标红并进入阻断状态。
- “扩展盒体至刚好容纳”是离散事务，只产生一个 Undo 历史节点。

### 8.4 结果摘要与草稿

扩展 `tray-result-projection.ts`：

- 盒体外尺寸。
- 闭合后外高。
- 盒内可用宽深。
- 带盖净高、堆叠安全净高。
- 盒体、盖子及合计耗材参考。
- 三轴构建尺寸警告。

扩展 `draft-summary.ts`，让草稿列表标明“托盘/盒体”并在盒体时使用外部长宽高。Mode 仍为 `grid` 或 `custom`。

## 9. 参数兼容与领域文档

- `DEFAULT_TRAY_PARAMS`、`CUSTOM_LAYOUT_DEFAULTS` 增加默认关闭的盒体参数。
- `param-normalization.ts` 对缺失盒体参数的历史文件补为关闭状态，并在导入报告中用一条记录说明“旧文件按普通托盘处理”。
- 所有盒体字段执行有限数值检查和范围钳制；禁用时也规范化休眠值，避免重新启用时恢复非法参数。
- 导入 `custom + contoured + box enabled` 时关闭盒体并记录行为变化。
- 导入 `grid + halfCircleSlots + box enabled` 时关闭半圆槽并记录行为变化。
- 参数产物版本保持 `1`：这是可选字段的向后兼容增量，不引入新 Mode 或包装结构。
- `mode-param-snapshot.ts`、`current-param-artifact-encoder.ts` 和本地草稿存储不需要专门分支，只需让新增字段随快照复制和序列化。
- 在 `CONTEXT.md` 增加统一术语：Stackable Box Structure、Box Outer Dimensions、Box Usable Opening、Stacking Locating Flange、Stacking Locating Groove、Stacking Fit Clearance、Lid Clear Height、Stack Clear Height，并明确避免把 `holeDepth` 称为盒壁高度。

## 10. 分阶段实施任务

### 任务 1：建立共享参数与纯领域计算

修改：

- `src/types/tray.ts`
- `src/types/custom-tray.ts`
- `src/lib/stackable-box.ts`（新增）
- `src/lib/grid-config.ts`
- `src/lib/custom-config.ts`
- `src/lib/param-normalization.ts`
- `src/lib/param-normalization.test.ts`
- `src/lib/stackable-box.test.ts`（新增）

步骤：

1. 先写缺失参数兼容、范围钳制、休眠值保留和不支持组合归一化测试。
2. 定义可选共享参数与默认 resolver。
3. 实现可用区域、高度、所需外尺寸、净高、警告和阻断结果的纯函数。
4. 确认盒体关闭时现有参数归一化快照不改变几何语义。

完成标准：纯函数不依赖 React、Worker 或 JSCAD；所有固定制造值只定义一次。

### 任务 2：实现共享盒体与盖子 CAD 原语

修改：

- `src/lib/stackable-box-model.ts`（新增）
- `src/lib/stackable-box-model.test.ts`（新增）
- 必要时复用 `src/lib/model-utils.ts` 的圆角矩形拉伸能力

步骤：

1. 用失败的几何测试锁定外包围盒、墙厚、顶部承重边和凹槽深度。
2. 实现底部承重肩、中央贴床平面、定位轮廓及倒角。
3. 实现平板盖、定位轮廓、指甲槽和打印方向。
4. 验证默认与间隙上下限下凸缘不会触底、肩部先接触、几何体积为正。
5. 验证两个同长宽盒体可配对，不同长宽不声明兼容。

完成标准：典型截面无需大面积支撑；盒体真实外包围盒严格等于用户长宽高；盖子外长宽严格等于盒体。

### 任务 3：接入网格模式

修改：

- `src/lib/tray-model.ts`
- `src/lib/tray-model.test.ts`
- `src/lib/grid-layout-math.ts`
- `src/lib/grid-layout-math.test.ts`
- `src/lib/grid-model-state.ts`
- `src/lib/grid-model-state.test.ts`

步骤：

1. 盒体关闭分支保持现有生成结果。
2. 盒体开启时使用固定外尺寸、固定圆角和垂直墙，网格阵列居中。
3. 保留圆槽、矩形槽、零间距去岛、底板孔位与 `basePlateOnly`。
4. 禁用并规范化半圆槽组合。
5. 实现网格最小所需尺寸与显式扩容 action。

完成标准：旧网格回归测试不改期望；盒体槽位不会切入安全区；磁吸孔仍由权威 Base-hole Construction Plan 驱动。

### 任务 4：接入自由布局模式

修改：

- `src/lib/custom-tray-model.ts`
- `src/lib/custom-tray-model.test.ts`
- `src/lib/custom-layout-math.ts`
- `src/lib/custom-layout-math.test.ts`
- `src/lib/custom-layout-actions.ts`
- `src/lib/custom-layout-actions.test.ts`
- `src/hooks/useCustomLayout.ts`
- `src/hooks/useCustomLayout.integration.test.ts`

步骤：

1. 仅矩形外轮廓进入盒体 CAD 分支。
2. 复用最终槽位轮廓采样完成严格边界校验。
3. 将盒体阻断原因接入 `useEditableParams.validateSnapshot`，替换当前 `custom` 的空校验。
4. 实现空盒、显式扩容与整组居中；扩容只提交一个 Undo。
5. 确认普通固定托盘仍允许越界导出，盒体才严格阻断。

完成标准：自由布局的拖拽、旋转、镜像、复制和底板孔位无回归；盒体越界时保留上一次预览并禁止生成、导出。

### 任务 5：Worker 预览与双 STL 导出

修改：

- `src/lib/worker/tray.worker.ts`
- `src/lib/worker/tray.worker.test.ts`
- `src/lib/worker/worker-service.ts`
- `src/lib/worker/worker-service.test.ts`
- `src/lib/model-ports.ts`
- `src/lib/grid-model-service.ts`
- `src/lib/grid-model-service.test.ts`
- `src/lib/custom-layout-service.ts`
- `src/lib/custom-layout-service.test.ts`
- `src/lib/model-filenames.ts`
- `src/lib/model-filenames.test.ts`
- `src/lib/model-artifact-bundle.test.ts`

步骤：

1. 盒体预览返回直立盒体与旁置、翻转盖子的组合几何。
2. 增加两个 Mode 专用盒体零件请求，返回未旁移的打印几何。
3. 盒体导出准备两个 STL，再复用现有 bundle 追加一份参数 JSON。
4. 锁定文件顺序为盒体、盖子、参数 JSON。
5. 验证部分下载失败仍按现有聚合错误报告。

完成标准：普通托盘仍只下载 STL + JSON；盒体只下载两个 STL + JSON；三个文件来自同一个 Mode Param Snapshot。

### 任务 6：体积分项与结果投影

修改：

- `src/hooks/usePreviewLifecycle.ts`
- `src/hooks/usePreviewLifecycle.test.ts`
- `src/hooks/useEditableParams.ts`
- `src/hooks/useTrayModel.ts`
- `src/hooks/useTrayModel.integration.test.ts`
- `src/hooks/useCustomLayout.ts`
- `src/lib/tray-result-projection.ts`
- `src/lib/tray-result-projection.test.ts`
- `src/components/TrayResultSummary.tsx`
- `src/components/TrayResultSummary.test.tsx`
- `src/lib/draft-summary.ts`
- `src/lib/local-drafts.test.ts`

步骤：

1. 给预览结果增加可选盒体/盖子体积分项；其他 Mode 保持单一 `volume`。
2. 投影盒体、闭合高度、两个净高、三轴超限和耗材分项。
3. 草稿摘要显示盒体结构与外尺寸。

完成标准：无盒体时 UI 和测试输出不变化；参数变化后旧体积分项与总量一起清空并标记预览过期。

### 任务 7：参数面板和 2D 预览

修改：

- `src/components/StackableBoxConfig.tsx`（新增）
- `src/components/ParameterPanel.tsx`
- `src/components/CustomPanel.tsx`
- `src/components/GridLayoutPreview.tsx`
- `src/components/LayoutCanvas.tsx`
- `src/components/panels.test.tsx`
- `src/components/GridLayoutPreview.test.tsx`
- `src/components/LayoutCanvas.test.tsx`

步骤：

1. 接入共享盒体设置区和高级参数。
2. 盒体开启时显示固定外框、安全区、净高与制造规格摘要。
3. 接入越界明细和显式扩容操作。
4. 隐藏或标记休眠的圆角、侧面斜面和普通边界间距。
5. 确认键盘操作、拖拽和窄屏核心流程可达。

完成标准：盒体控件只出现在网格与矩形自由布局；阶梯、贴合轮廓和底盘转换界面完全不出现。

### 任务 8：持久化、文档与全量回归

修改：

- `src/lib/param-io.test.ts`
- `src/lib/current-param-artifact-encoder.test.ts`
- `src/lib/mode-param-snapshot.test.ts`
- `src/lib/draft-session.test.ts`
- `src/app/page.test.tsx`
- `CONTEXT.md`
- 必要的示例参数文件

步骤：

1. 验证旧参数、旧草稿加载后盒体默认关闭且无几何变化。
2. 验证盒体参数导出、导入、草稿保存加载和几何指纹一致。
3. 补齐领域术语和用户可见限制。
4. 运行全量单元、集成、静态服务、类型、Lint 和生产构建。
5. 用至少一个网格圆槽盒、一个旧世界矩形槽盒、一个自由布局空盒、一个带旋转椭圆槽的自由盒进行人工 3D 检查。

## 11. 测试命令与验收门槛

分任务运行聚焦测试，最终执行：

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

几何验收：

- 盒体包围盒误差不超过 `0.01 mm`。
- 盖子长宽与盒体一致，闭合后增加高度等于盖板厚度。
- 默认 XY 每侧间隙为 `0.25 mm`，上下限均不会发生几何相交。
- 定位凸缘比凹槽浅 `0.2 mm`，肩部先接触。
- 盒底中央存在连续贴床面，不出现整块底板悬空。
- 槽底厚度、磁吸孔和磁柱孔继续满足现有制造约束。
- 所有导出几何均能转换为 Three.js，并具有有限正体积。

行为验收：

- 网格行列不会因盒体尺寸改变而自动变化。
- 网格阵列始终居中；自由布局只在显式扩容时整组居中。
- 盒体越界阻止生成和导出，普通自由托盘越界行为不变。
- 空盒可以生成和导出。
- 同长宽不同高度、不同槽位布局的盒体共享相同堆叠接口。
- 超过 `260 mm` 只警告，不阻断。
- 预览显示盒体与旁置盖子，不出现爆炸视图控件。

兼容验收：

- 盒体关闭时，现有网格和自由布局代表性夹具的尺寸、体积和 STL 文件名保持不变。
- 历史参数文件无需版本迁移即可导入。
- 阶梯、贴合轮廓和底盘转换模式的类型、面板、Worker 路由和导出无变化。

## 12. 性能与风险

### 12.1 主要风险

1. 高墙、顶部环槽与底部肩部增加布尔运算面数，可能放大 JSCAD 生成时间。
2. 环形凹槽在 `6 mm` 圆角处可能产生极小面或非流形碎片。
3. 旁置盖子扩大预览包围盒，可能使主体视觉上变小。
4. 大尺寸平板盖可能翘曲；首版通过可调盖板厚度缓解，不增加加强筋。
5. `custom` 当前允许越界导出，盒体严格阻断必须只作用于新分支，避免行为回归。

### 12.2 控制措施

- 环形结构尽量通过少量完整 2D rounded-rectangle band 拉伸后布尔运算，不用大量小块拼接。
- 对默认、最小和最大配合间隙分别运行几何测试。
- 使用现有 `RENDER_CONFIG.cornerSegments`，不为盒体另增曲线精度设置。
- 增加一个典型 `200 × 150 × 50 mm` 盒体性能夹具，记录生成时间和 polygon 数；首版只监测，不设未经基线验证的硬阈值。
- 预览旁置间距按盒体短边比例设置并设上限，避免极大盒子把相机拉得过远。

## 13. 回滚边界

- 新参数集中在可选 `stackableBox` 对象，缺失或 `enabled=false` 时全部走现有路径。
- 新 CAD 逻辑由两个现有模式的单一条件分支进入；删除 UI 入口和这两个分支即可恢复普通托盘。
- 不修改 AppMode 联合类型、不新增路由、不升级参数文件版本。
- 普通托盘导出仍使用缓存单体几何；双零件 Worker 请求只服务盒体。
- 若双体积统计延误，可先退化为只显示合计值，不影响模型、参数或 STL 合同。

## 14. 推荐提交顺序

1. `feat: 定义堆叠盒体参数与布局规则`
2. `feat: 实现盒体与盖子共享 CAD 结构`
3. `feat: 接入网格盒体建模与校验`
4. `feat: 接入自由布局盒体建模与校验`
5. `feat: 支持盒体双 STL 预览与导出`
6. `feat: 增加盒体配置与结果摘要界面`
7. `docs: 补充堆叠盒体领域规则与验收记录`

每个提交必须保持对应聚焦测试通过；不要在最后一个提交集中修复前面阶段遗留的类型或测试问题。
