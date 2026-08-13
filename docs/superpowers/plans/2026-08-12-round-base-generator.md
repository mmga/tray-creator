# 底盘生成器首版开发计划

> 日期：2026-08-12
>
> 状态：已实施并验证（2026-08-13）
>
> 实施对象：现有 `base-converter` Mode、普通圆形底盘、带偏心六边形插孔的简版底盘、转换底盘兼容链路
>
> 推荐顺序：`绿色基线 → 参数兼容与领域模型 → 纯几何内核 → 普通/简版面板 → 可拖动孔位预览 → 持久化与导出补齐 → 全量回归`

## 1. 结论

本功能不新增第五个顶层 Mode。保留现有持久化标识 `base-converter`，把顶部标签的用户文案从“转换底盘”改为“底盘生成”，并在标签内部增加三种生成类型：

1. **普通底盘**：生成 25、28.5、32、40、50mm 圆形战锤底盘。
2. **简版底盘**：在同一套圆形底盘上增加一个可偏心放置的正六边形通孔，用于拼插带六边形插脚的简版模型。
3. **转换底盘**：完整保留当前源底盘凹槽到圆形/椭圆目标底盘的转换能力。

这样做的原因：

- 现有转换底盘已经拥有完整的 Mode Editing Session、Undo History、Draft、参数导入导出、2D/3D 预览、Worker 建模和 STL 导出链路。
- 三种输出本质上共享“目标底盘外轮廓 + 可选切除结构”，在同一 Mode 内用生成类型区分，比增加一个顶层 Mode 更符合用户心智。
- 保留内部 Mode 标识可以避免迁移浏览器草稿 key、历史参数文件 Mode、Mode Editor Catalog 和大量跨 Mode 分支。
- 普通底盘与简版底盘只需扩展现有目标轮廓和切除阶段，不需要复制一套异步预览与导出基础设施。

## 2. 调查结论

### 2.1 现有代码链路

当前转换底盘调用链已经闭环：

```text
ModeTabs
→ useModeEditor
→ useBaseConverter
→ useBaseConverterWorkspace / useBaseConverterViewportWorkspace
→ BaseConverterPanel / BaseConverterPreview
→ base-converter-model-service
→ worker-service / tray.worker
→ createBaseConverterModel
→ 3D 预览或 STL + 参数文件导出
```

关键现状：

- `src/types/custom-tray.ts`：`AppMode` 已含 `base-converter`；`BaseConverterParams` 保存源、目标几何快照和结构参数。
- `src/lib/base-converter-config.ts`：目标标准目录已经包含 25、28.5、32、40、50mm 圆底，另含椭圆转换目标。
- `src/lib/base-converter-model.ts`：已有目标轮廓拉伸、侧面斜角和凹槽布尔切除。
- `src/hooks/useBaseConverter.ts`：已有规范化、校验、连续编辑事务、撤销、预览缓存指纹和导出。
- `src/workspaces/base-converter/useBaseConverterWorkspace.tsx`：已有 300ms 自动 3D 预览、生成/导出阻断、Draft 和参数导入导出。
- `src/components/BaseConverterPreview.tsx`：现为静态 SVG，可扩展为普通/简版底盘的孔位编辑器。
- `docs/adr/0004-persist-conversion-geometry-snapshots.md`：要求以几何快照复现旧转换；新增底盘规格也应遵守同一原则。

因此本次应深化现有模块，而不是复制 `useEditableParams`、Worker request 或 Draft 流程。

### 2.2 官方可确认的圆底规格

Games Workshop 当前底盘尺寸资料中实际使用 25、28.5、32、40、50mm 圆底；这五档与项目现有 `TARGET_BASE_STANDARDS` 一致。首版“25–50”按这五档解释，不包含 60mm，也不包含椭圆普通底盘。

资料：

- [Games Workshop《Warhammer 40,000 Base Size Guide》，2025-06](https://assets.warhammer-community.com/eng_4-xglmycxyvf.pdf)
- [Games Workshop 当前赛事底盘表，包含 25、28.5、32、40、50mm 的实际单位条目](https://assets.warhammer-community.com/eng_07-01_warhammer_40000_core_rules_chapter_approved_tournament-companion-sqc1af88bj-vzxhp9xmid.pdf)
- [Warhammer Community 对 25、28.5、32mm 三种官方底盘的产品说明](https://www.warhammer-community.com/en-gb/articles/wjv5f1sl/saturday-pre-orders-skirmish-day-delivers-warbands-and-expansions-for-kill-team-and-warcry/)

### 2.3 官方未公开的剖面尺寸

公开官方资料确认的是游戏使用的标称底盘尺寸，并非注塑底盘工程图。没有找到由 Games Workshop 发布、同时覆盖这五档底盘的高度、顶面直径、斜边角度、底部空腔和壁厚数据。

第三方资料可以作为首版视觉近似，但不能标记为官方标准：

- [Customeeple 顶面尺寸表](https://www.customeeple.com/base-top-size-guide/)给出 25/32/40/50mm 底盘的顶面直径约 23/29/37/47mm。
- [社区实物测量](https://www.reddit.com/r/PrintedMinis/comments/yvzpq4/hey_does_anyone_know_what_size_the_top_of_citadel/)给出 25/32/40mm 顶面约 22/29/37mm，说明 25mm 数据存在至少 1mm 差异。
- [另一组社区测量](https://www.reddit.com/r/minipainting/comments/huxjid/warlord_25mm_bases_vs_games_workshop_25_and_32_mm/)记录一枚 25mm GW 斜边底盘约为底部 24.68mm、顶部 22.89mm、高 3.48mm。
- [开源打印模型参考](https://cults3d.com/en/3d-model/game/high-res-miniature-bases)使用 25mm 高 3.6mm、32mm 高 4mm、50mm 高约 3.2mm，也说明高度并非一个可信的统一公开值。

首版处理原则：

- 标称外径使用官方五档规格。
- 默认总高暂取 **4.0mm**。
- 默认单边顶部内缩暂取 **1.5mm**，即顶部直径约为标称外径减 3mm。
- 总高和顶部内缩必须是可编辑参数，不能写死在建模函数中。
- 每个标准规格保存自己的几何快照；以后实测只需修订标准目录默认值，旧 Draft/参数文件仍按原快照复现。
- 第一版生成实心、底面封闭的可打印底盘，不复制注塑件底部空腔、加强筋和厂标。这样可以避免悬空顶板、薄壁和不同打印方向造成的首版失败；底部空腔另立后续需求。

### 2.4 六边形插孔调查

公开资料能确认：

- GW push-fit/入门套件确实存在带六边形插脚、孔位不一定居中的底盘。
- [缺失六边形孔底盘的案例](https://bolterandchainsword.com/topic/386383-hard-time-finding-28mm-round-bases-with-hexagonal-holes/)明确描述了约 28mm 圆底上的偏心六边形孔。
- [社区装配经验](https://www.reddit.com/r/Warhammer40k/comments/1qemyxk/sourcing_warhammer_bases_with_hex_hole/)称 3mm 钻孔通常能容纳这类插脚，只能证明它大约处于 3mm 量级。

未找到可信资料能统一回答：

- 3mm 指六边形对边、对角还是可替代圆孔直径；
- 不同套件是否共用同一插脚规格；
- 插脚实际长度、倒角、拔模斜度和所需打印公差；
- 原装孔是严格正六边形还是带圆角/拔模的近似六边形。

首版临时默认与术语：

- UI 和参数统一使用“**最终孔对边**”，避免把插脚标称尺寸、公差和最终生成尺寸混在一起。
- 最终孔对边临时取 **3.0mm**，范围 2–6mm，步进 0.05mm。
- 孔为贯穿底盘的正六边形棱柱；首版不做圆角、倒角、拔模和盲孔。
- 孔中心以底盘中心为原点，存储 `offsetX`、`offsetY`；初始均为 0。
- 首版只要求拖动位置，不开放旋转；正六边形方向固定，若实测证明方向影响装配，再增加 0–60° 旋转。
- 以上数值必须在 UI 可直接修改，不能等实测后再改代码。

## 3. 首版范围

### 3.1 包含

- 顶部标签文案改为“底盘生成”，移动端短文案改为“底盘”。
- 标签内提供“普通底盘 / 简版底盘 / 转换底盘”三段式生成类型切换。
- 普通与简版仅支持圆形 25、28.5、32、40、50mm。
- 普通与简版可编辑：
  - 底盘规格；
  - 总高；
  - 顶部单边内缩。
- 简版额外可编辑：
  - 最终孔对边；
  - `X/Y` 偏移数值；
  - 2D 视图直接拖动孔位。
- 生成类型、规格、剖面和孔位全部进入撤销、Draft、参数导入导出、预览指纹和 STL 伴随 JSON。
- 继续使用 2D/3D 视图切换和 300ms 自动预览。
- 转换底盘现有标准、个人规格库、转换间隙、凹槽深度、底厚和斜面功能保持。

### 3.2 不包含

- 60mm 及以上圆底、椭圆普通底盘、方形普通底盘。
- 多孔、槽形孔、圆孔、孔旋转、镜像或批量排版。
- 底面空腔、加强筋、磁铁位、注塑厂标和表面纹理。
- 自动识别具体模型并推导孔位。
- 保证对所有 GW push-fit 套件免胶过盈配合。
- 修改当前转换底盘的几何语义或个人规格库角色。

## 4. 交互设计

### 4.1 顶层与面板结构

顶层仍有四个 Mode，只改第三个标签的显示名称：

```text
网格模式 | 自定义模式 | 底盘生成 | 自定义阶梯底座
```

底盘生成面板内部：

```text
[普通底盘] [简版底盘] [转换底盘]

普通/简版：
  底盘规格
  剖面参数
  简版插孔（仅简版）
  结果摘要

转换：
  现有底盘转换
  现有结构参数
  现有个人规格库
  结果摘要
```

生成类型切换是同一 Mode Editing Session 内的一次普通参数编辑：

- 每次切换只产生一个 Undo History 步骤。
- 各类型的休眠参数保留；从简版切走再切回时，孔大小与位置不丢失。
- 切换后 2D 立即更新，3D 走现有自动预览。

### 4.2 简版孔位编辑

2D 视图使用专用 SVG 交互，不引入完整 `LayoutCanvas`：

- pointer down：选中六边形孔并开始 Continuous Edit。
- pointer move：把屏幕坐标转换为毫米坐标，更新 `viewParams`，2D 跟手移动。
- pointer up：提交一次事务，只形成一个撤销步骤。
- pointer cancel 或 `Escape`：取消本次拖动，恢复拖动前位置。
- 鼠标与触摸统一使用 Pointer Events 和 pointer capture。
- 键盘聚焦孔位后，方向键每次移动 0.1mm，按住 Shift 每次移动 1mm。
- 数值输入显示底盘中心坐标系：右为 `+X`，上为 `+Y`。
- 视图同时显示中心十字、孔中心坐标和离边界最近距离。

拖动约束：

- 六边形六个顶点都必须位于顶部圆形轮廓内，并保留临时最小壁厚 0.6mm。
- 拖动时沿移动方向限制到最后合法位置，避免孔瞬间消失或切穿斜边。
- 手工数值输入或旧参数导入可以暂时处于非法状态，但必须显示明确错误并阻断 3D 生成与导出，仍允许编辑、保存 Draft 和查看 2D。
- 几何校验使用六个实际顶点，不使用只看包围圆的过度保守近似。

## 5. 参数与兼容方案

### 5.1 保留 Mode 标识

内部与持久化继续使用：

```ts
mode: "base-converter"
```

不要在本需求中把 Mode 重命名为 `base-generator`。用户文案可以改名，持久化协议不需要跟随 UI 文案变化。

### 5.2 参数方向

把现有 `BaseConverterParams` 深化为底盘生成参数，并保留旧字段语义。建议新增：

```ts
type BaseGenerationKind = "plain" | "push-fit" | "conversion";

interface RoundBaseProfileSnapshot {
  standardId: string;
  name: string;
  nominalDiameter: number;
  height: number;
  topInset: number;
}

interface PushFitHexHoleParams {
  acrossFlats: number; // 最终生成尺寸
  offsetX: number;
  offsetY: number;
}
```

运行时参数至少包含：

- `generationKind`；
- 普通/简版共用的圆底规格 ID 与 `RoundBaseProfileSnapshot`；
- 休眠但保留的 `PushFitHexHoleParams`；
- 当前转换底盘全部字段与 Conversion Geometry Snapshot。

实现时不要求把所有内容塞进一个巨型平面对象；可以使用带版本的嵌套字段，但必须满足：

- 切换类型不丢休眠配置；
- 快照完整复现几何；
- normalization 不依赖实时标准目录重新计算旧 Draft；
- 模型指纹包含当前生成类型实际生效的全部几何字段；
- UI 更新一个嵌套配置时仍只提交一个事务。

### 5.3 旧数据迁移

- 缺少 `generationKind` 的历史 `base-converter` 参数一律规范化为 `conversion`。
- 旧转换参数的 `geometrySnapshot.source/target`、间隙、底厚、凹槽深度和斜面保持原值。
- normalization 为普通/简版的休眠字段补默认值，但不得改变旧转换生成结果或模型指纹。
- 历史 Draft 摘要仍能显示“源 → 目标”；新普通/简版 Draft 显示“普通 Ø32mm”或“简版 Ø32mm · 六边孔偏移 X/Y”。
- 导入报告应说明仅发生“补充新增默认字段”，不能误报成转换几何修改。

## 6. 几何实现

### 6.1 普通底盘

普通底盘为实心圆台：

1. 底面直径 = 规格标称直径。
2. 顶面直径 = `nominalDiameter - 2 * topInset`。
3. 高度 = `height`。
4. 使用现有 `extrudeFromSlices` 构造底、顶两个圆形 slice；圆周分段继续使用 `RENDER_CONFIG.cylinderSegments`。

必须先提取一个与“转换凹槽”无关的底盘 body 构造函数，使普通、简版、转换共享圆/椭圆目标轮廓拉伸能力，但各自拥有切除规则。

### 6.2 简版底盘

1. 先构造与普通底盘完全相同的圆台 body。
2. 以 `acrossFlats` 创建正六边形 `Geom2`。
3. 按 `offsetX/offsetY` 平移。
4. 从 `z = -CUT_EPSILON` 拉伸到 `height + 2 * CUT_EPSILON`，执行贯穿切除。
5. 生成前校验六个顶点相对顶部圆形轮廓及 0.6mm 最小壁厚。

六边形坐标生成、边界校验和 SVG path 必须共用同一纯几何函数，避免 2D 看起来合法但 3D 被拒绝。

### 6.3 转换底盘

- 保持当前 body 高度 `floorThickness + recessDepth`。
- 保持当前源轮廓、Conversion Clearance、凹槽切除和兼容性规则。
- 可以复用提取后的 body 构造函数，但不能借机改变现有转换几何。
- 回归测试使用当前固定参数断言体积与包围盒不变。

## 7. 实施阶段

## 阶段 0：建立绿色基线

### 目标

确认当前转换底盘与全仓测试基线，记录工作区已有修改，防止新功能掩盖旧失败。

### 步骤

1. 保留当前用户对 `src/lib/slot-definitions.ts` 的未提交修改，不覆盖、不格式化该文件。
2. 运行转换底盘相关单测、集成测试、类型检查。
3. 记录现有转换模型的代表性包围盒、体积和 STL 文件名作为回归夹具。

### 验证

```bash
pnpm test:unit -- src/lib/base-converter-config.test.ts src/lib/base-converter-model.test.ts src/hooks/useBaseConverter.test.ts src/components/BaseConverterPanel.test.tsx src/components/BaseConverterPreview.test.tsx src/workspaces/modeWorkspaceActions.test.tsx
pnpm test:integration
pnpm typecheck
```

### 回滚边界

只新增测试夹具，不改变生产行为。

## 阶段 1：参数兼容与领域模型

### 目标

先让三种生成类型能被规范化、持久化和撤销，再接 UI 与 CAD。

### 涉及文件

- `src/types/custom-tray.ts`
- `src/lib/base-converter-config.ts`
- `src/lib/param-normalization.ts`
- `src/lib/historical-param-artifact-reader.ts`
- `src/lib/draft-summary.ts`
- `src/lib/mode-param-snapshot.ts`（仅在类型名需要调整时）
- 对应测试

### 测试先行

- 旧参数缺少 `generationKind` 时规范化为 `conversion`，转换有效几何完全不变。
- 新普通/简版参数保留圆底几何快照。
- 类型切换保留休眠参数。
- 非法高度、内缩、孔尺寸和孔位返回稳定的领域错误。
- Capture Snapshot 后修改标准目录不会改变已保存参数的解析结果。

### 提交建议

```text
feat: add compatible base generation parameter model
```

## 阶段 2：纯几何内核与 Worker 接入

### 目标

在无 React 的条件下完成普通圆台、六边形贯穿孔和边界校验。

### 涉及文件

- 新增 `src/lib/round-base-profile.ts`
- 新增 `src/lib/push-fit-hex-hole.ts`
- `src/lib/base-converter-model.ts`
- `src/lib/base-converter-profile.ts`
- `src/lib/base-converter-model-service.ts`
- `src/lib/worker/tray.worker.ts`（预计协议不变）
- 对应测试

### 测试先行

- 五档普通底盘包围盒与高度正确。
- `topInset = 0` 退化为圆柱，正值生成合法圆台。
- 中心六边孔贯穿且体积减少。
- 偏心孔按毫米坐标移动，孔轴保持垂直。
- 六个顶点贴近合法边界时通过，越过 0.6mm 壁厚时失败。
- 普通/简版非法参数不会进入布尔运算。
- 代表性旧转换参数生成的包围盒与体积保持基线。

### 提交建议

```text
feat: generate plain and push-fit round bases
```

## 阶段 3：面板与类型切换

### 目标

在同一左侧面板中呈现三种生成流程，同时保护现有转换能力。

### 涉及文件

- `src/components/ModeTabs.tsx`
- `src/components/BaseConverterPanel.tsx`，实施时建议拆成：
  - `BaseGeneratorPanel.tsx`
  - `RoundBaseConfig.tsx`
  - `PushFitHoleConfig.tsx`
  - 保留或提取 `BaseConversionConfig.tsx`
- `src/hooks/useBaseConverter.ts`
- `src/workspaces/base-converter/useBaseConverterWorkspace.tsx`
- 对应测试

### 测试先行

- 顶层仍只有四个 Mode，第三个显示为“底盘生成”。
- 三种类型切换各提交一次 Undo History。
- 从简版切换到转换再切回，孔参数保持。
- 普通/简版只显示五档圆底；转换仍显示原有圆/椭圆目标和个人规格。
- 非法配置阻断生成/导出，但不阻断 Draft、参数导出和 2D。

### 提交建议

```text
feat: unify base generation and conversion panel
```

## 阶段 4：可拖动六边形孔位

### 目标

让 2D 预览成为简版孔位的直接编辑面，并符合现有 Continuous Edit 事务语义。

### 涉及文件

- `src/components/BaseConverterPreview.tsx`，建议重命名或外包一层 `BaseGeneratorPreview.tsx`
- `src/viewports/base-converter/useBaseConverterViewportWorkspace.tsx`
- `src/hooks/useBaseConverter.ts`（增加嵌套参数的连续预览入口）
- `src/lib/push-fit-hex-hole.ts`
- 对应组件与 Hook 测试

### 测试先行

- SVG 屏幕坐标正确转换为毫米偏移。
- pointer down/move/up 只产生一个撤销步骤。
- pointer cancel 与 Escape 恢复原值。
- 触摸 pointer 使用 pointer capture，不因移出孔图形丢失拖动。
- 拖动到边缘被限制在合法位置。
- 键盘方向键和 Shift 步长正确。
- 2D path、数值输入和最终 3D 使用同一位置与孔尺寸。

### 提交建议

```text
feat: drag push-fit hex hole in base preview
```

## 阶段 5：摘要、文件名和持久化闭环

### 目标

让三种输出在 Draft、结果摘要、STL 和伴随参数文件中可区分、可复现。

### 涉及文件

- `src/lib/base-converter-model-service.ts`
- `src/lib/draft-summary.ts`
- `src/lib/tray-result-projection.ts`
- `src/components/TrayResultSummary.tsx`
- `src/components/DraftManagerDialog.tsx`
- `src/lib/param-io.ts` 及测试

### 文件名建议

```text
base-plain-32mm.stl
base-push-fit-32mm-hex-3mm-x1.2-y-0.8.stl
base-converter-25x25-to-32.stl
```

文件名中的浮点数需经过稳定格式化和非法字符清理；伴随 JSON 继续声明 `mode: "base-converter"`，并通过 `generationKind` 区分输出。

### 测试先行

- 三类 Draft 摘要可区分且尺寸正确。
- 三类 STL 文件名稳定。
- 参数导出、重新导入后模型指纹一致。
- 旧转换 Draft 列表和导出文件名保持兼容。

### 提交建议

```text
feat: persist and label all base generation variants
```

## 阶段 6：完整回归与实物校准准备

### 验证

```bash
pnpm test:unit
pnpm test:integration
pnpm typecheck
pnpm lint
pnpm build
```

手工验收矩阵：

| 类型 | 规格 | 2D | 拖动 | 3D | STL | 参数往返 |
|---|---:|---:|---:|---:|---:|---:|
| 普通 | 25/28.5/32/40/50 | 必测 | 不适用 | 必测 | 必测 | 必测 |
| 简版 | 25/28.5/32/40/50 | 必测 | 中心、偏心、边缘 | 必测 | 必测 | 必测 |
| 转换 | 圆形目标代表项 | 回归 | 不适用 | 回归 | 回归 | 回归 |
| 转换 | 椭圆目标代表项 | 回归 | 不适用 | 回归 | 回归 | 回归 |

首轮实物校准记录模板：

| 项目 | 测量工具/方法 | 实测值 | 建议默认 | 是否影响旧快照 |
|---|---|---:|---:|---|
| 25/28.5/32/40/50 底面外径 | 卡尺，多点测量 | 待测 | 待定 | 否，只改新默认 |
| 五档总高 | 卡尺，多件取范围 | 待测 | 待定 | 否 |
| 五档顶面直径 | 卡尺 | 待测 | 待定 | 否 |
| 六边插脚对边/对角 | 卡尺或显微照片标定 | 待测 | 待定 | 否 |
| 插脚长度 | 卡尺 | 待测 | 决定通孔/盲孔后续 | 否 |
| FDM/SLA 合适孔对边 | 分级测试片 | 待测 | 可按打印工艺设建议值 | 否 |

## 8. 验收标准

1. 用户无需离开“底盘生成”标签即可生成普通、简版和转换底盘。
2. 普通与简版提供 25、28.5、32、40、50mm 五档圆底。
3. 简版六边形孔可通过鼠标和触摸拖动到非中心位置，也可精确输入 `X/Y`。
4. 一次完整拖动只占一个撤销步骤；取消拖动不留下参数变化。
5. 六边孔不能切穿顶部斜边；非法手输或导入会显示原因并阻断 3D/STL。
6. 普通、简版和转换的 2D、3D、结果摘要、Draft、STL、参数导入导出一致。
7. 历史 `base-converter` 参数和 Draft 无需用户操作即可按转换类型打开，代表性模型几何不变。
8. 默认尺寸在 UI 中明确标记为首版参考值；完成实测后只需更新规格目录或参数，不需重写 CAD 算法。
9. 单测、集成测试、类型检查、Lint 和生产构建全部通过。

## 9. 风险与回滚边界

### 风险 1：把第三方测量误称为官方尺寸

处理：官方只背书五档标称直径；高度、顶面内缩和孔尺寸显示为首版参考值，并可编辑、可快照。

### 风险 2：一个 Mode 承担三种参数后出现分支膨胀

处理：Mode Session 和持久化共用，但 UI 分段、纯几何函数和校验器按 `generationKind` 分开；不要把所有 JSX 和布尔分支继续堆在当前单文件中。

### 风险 3：旧转换参数被新 normalization 改写

处理：阶段 0 先建立旧几何基线；缺失 `generationKind` 只补 `conversion`，休眠普通底盘字段不得进入转换指纹或模型生成。

### 风险 4：拖动预览与 CAD 边界算法不一致

处理：六边形顶点、SVG path、合法范围和 JSCAD polygon 共用一个纯几何模块。

### 风险 5：临时 3mm 孔无法真实拼插

处理：参数直接表达“最终孔对边”并可精确编辑；开发验收只验证几何和交互，不宣称实物免胶适配，实物适配以用户后续测量和测试片为准。

### 回滚边界

- 阶段 1 的参数兼容可独立保留或回滚；旧转换默认始终为 `conversion`。
- 阶段 2 的普通/简版 CAD 内核不改变页面入口，可独立回滚。
- 阶段 3–5 构成用户可见功能，必要时可通过隐藏普通/简版入口回退到原转换 UI，而不删除已保存的新参数。
- 不改 `AppMode` 和 Draft storage key，因此回滚不需要批量迁移浏览器存储。

## 10. 实施前仍需实测、但不阻塞编码的项目

- 五档官方实物底盘的真实外径、总高、顶面直径和斜边是否一致。
- 目标简版模型插脚的对边、对角、长度、圆角和拔模方向。
- 3.0mm 临时孔在实际 FDM/SLA 材料与机器上的松紧程度。
- 是否存在同一底盘规格的多种孔尺寸；若存在，后续应保存为“插脚规格”，而不是继续叫单一标准孔。

这些项目不阻塞首版开发，因为计划已经要求相关数值可编辑并进入几何快照；它们只决定默认值，不改变功能结构。

## 11. 实施与验证记录

- 功能按阶段拆分为独立提交：转换基线、参数兼容、CAD 几何、统一界面、孔位交互、摘要与持久化。
- 全量单元测试：111 个文件、603 项通过。
- 集成测试：4 个文件、25 项通过；静态服务器测试：2 项通过。
- TypeScript 全量检查与 ESLint 零警告通过。
- Next.js 生产构建、建模 Worker bundle 校验和首屏包体校验通过；首页直接 JavaScript 为 4,467 / 16,384 bytes。
- 真实浏览器验证通过：三类型切换、五档圆底规格、普通底盘摘要、简版数值输入、0.1mm 键盘微调、Pointer 拖动、转换底盘回归；浏览器控制台无错误。
- 本机 `pnpm.cmd` 包装层因锁文件版本不兼容试图重装依赖并在无 TTY 环境中中止，因此全量验证直接调用仓库现有的 `vitest`、`tsc`、`eslint` 与 `next` 可执行文件，未改动依赖或锁文件。

## 12. 底部开腔校准记录（2026-08-13）

- Games Workshop 的 2025 Base Size Guide 能确认 25、28.5、32、40、50mm 等游戏标称规格，但没有公布 Citadel 圆底的底部凹腔、顶板或侧壁尺寸。
- Hobby Heaven 公布的自有 32mm 注塑底盘生产 CAD 数据为 4mm 总高、1.3mm 顶板、2.7mm 底部净空；该资料只能证明同类注塑底盘采用开底薄壳结构，不能视为 Citadel 实物尺寸。
- 在取得 Citadel 实物测量前，普通与简版底盘统一采用 1.2mm 顶板、1.2mm 径向侧壁和向下开口的凹腔。壳厚集中在 `ROUND_BASE_SHELL_THICKNESS`，后续校准只需修改领域常量和对应快照/测试。
- 当总高不大于 1.2mm 时无法同时保留开腔与 1.2mm 顶板，参数校验会阻断 3D 生成和 STL 导出，但仍允许用户修正输入。
