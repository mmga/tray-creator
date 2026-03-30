# 自定义阶梯模式本地草稿保存方案

> 日期：2026-03-30
> 范围：仅适用于 stepped 模式，后续可复用到 custom / grid

## 1. 背景

当前阶梯模式已经支持：

- 参数编辑与 2D 画布联动
- 本地导入 / 导出 JSON 参数文件
- STL 导出时附带 JSON 参数导出

但还缺少“留在浏览器里，之后继续编辑”的草稿能力。用户一旦离开页面，当前参数状态不会被系统识别为一个可恢复的工作副本，也无法在应用内管理多个方案版本。

本次目标是在浏览器本地增加“草稿保存”能力，并通过一个统一弹窗管理草稿列表，支持：

- 保存当前配置
- 加载草稿继续编辑
- 删除草稿
- 重命名草稿
- 将草稿导出为 JSON 文件

## 2. 目标与非目标

### 目标

- 只在 stepped 模式落地第一版。
- 使用浏览器本地存储，无需服务端。
- 草稿列表通过单个弹窗完成查看与管理。
- 草稿数据与现有参数导入导出格式兼容，避免两套解析逻辑。
- 方案在结构上可扩展到 custom / grid。

### 非目标

- 本期不做跨设备同步。
- 本期不做账号体系。
- 本期不做自动保存历史版本链。
- 本期不做草稿搜索、标签、文件夹等复杂管理能力。
- 本期不把该能力同步接入 grid / custom。

## 3. 方案概览

### 3.1 存储介质

第一版使用 localStorage。

原因：

- 当前保存内容只是参数 JSON 与少量元数据，体积很小。
- 项目是静态导出应用，不需要引入服务端或数据库。
- CRUD 场景简单，localStorage 的同步 API 足够。
- 比 IndexedDB 实现成本低，更适合先在 stepped 模式验证产品形态。

约束：

- 不保存 3D 几何、体积结果、预览缓存，只保存参数与元信息。
- 需要兜底 localStorage 不可用、超配额、序列化失败等异常。

### 3.2 用户交互

阶梯模式新增两个入口：

- 保存草稿：用于保存当前 stepped 参数
- 草稿列表：打开草稿管理弹窗

推荐交互：

1. 用户在 stepped 模式编辑参数。
2. 点击“保存草稿”。
3. 如果当前没有绑定草稿，打开草稿弹窗并默认进入“新建草稿”状态。
4. 用户输入名称后保存，系统生成一条本地草稿记录。
5. 后续再次点击“保存草稿”时：
   - 若当前已加载某个草稿，则默认覆盖该草稿。
   - 同时在弹窗中提供“另存为新草稿”。
6. 用户点击“草稿列表”可打开弹窗查看全部草稿。
7. 在弹窗内对每个草稿支持：加载、重命名、导出、删除。

### 3.3 弹窗形态

弹窗建议命名为“阶梯模式草稿”。

弹窗内容分为两块：

1. 当前配置保存区
2. 已保存草稿列表区

#### 当前配置保存区

- 名称输入框
- 保存为新草稿按钮
- 若当前已有 currentDraftId，则展示“覆盖当前草稿”按钮
- 展示当前已绑定草稿名称与最后保存时间

#### 已保存草稿列表区

每条草稿显示：

- 草稿名称
- 最后保存时间
- 槽位数 / 分组数
- 有效尺寸摘要

每条草稿的操作按钮：

- 加载
- 导出
- 重命名
- 删除

细节建议：

- 列表按 updatedAt 倒序显示，最近修改的排最前。
- 重命名使用行内编辑，不再弹第二层模态。
- 删除使用行内二次确认状态，避免再引入额外确认弹窗。
- 若草稿为空，显示空状态文案与“保存当前配置”引导。

## 4. 数据模型设计

### 4.1 草稿记录结构

建议把“参数文件格式”和“草稿元数据”分开。

```ts
type DraftMode = "stepped";

interface DraftListItem {
  id: string;
  mode: DraftMode;
  title: string;
  createdAt: string;
  updatedAt: string;
  slotCount: number;
  groupCount: number;
  trayWidth: number;
  trayDepth: number;
}

interface DraftRecord {
  storageVersion: 1;
  item: DraftListItem;
  paramFile: {
    version: number;
    mode: "stepped";
    params: SteppedLayoutParams;
  };
}
```

说明：

- item 用于弹窗列表快速展示。
- paramFile 直接复用现有参数文件格式，减少双份 schema。
- storageVersion 用于未来草稿层级的存储迁移。

### 4.2 localStorage key 设计

建议使用“索引 + 单条记录”双层结构：

```ts
const DRAFT_INDEX_KEY = "tray-creator:drafts:index:v1";
const draftRecordKey = (id: string) => `tray-creator:drafts:stepped:${id}:v1`;
```

原因：

- 草稿列表读取时只拿索引，不需要把所有 params 全量解析到内存。
- 重命名、删除、导出时可以按 id 精确操作。
- 后续接入 custom / grid 时，可以继续沿用 mode 分区。

### 4.3 草稿摘要生成

保存时同步生成列表摘要：

- slotCount = params.slots.length
- groupCount = params.groups.length
- trayWidth / trayDepth 直接取 params 当前值

第一版不必保存 volume、报价、预览是否过期等衍生状态，因为这些都能在重新加载后由现有逻辑重新计算。

## 5. 与现有导入导出链路的关系

这是本方案最关键的点：本地草稿不要自行发明一套新的参数解析逻辑。

当前 param-io 已具备：

- 参数 JSON 序列化
- 参数 JSON 下载
- 文件导入时的校验与迁移

为了支持“从 localStorage 加载草稿”与“从文件导入”共用一套校验规则，建议把 param-io 进一步拆成两层：

1. 纯数据层：接收原始对象，校验并返回合法 params
2. 文件层：负责 FileReader 读取文件文本，再调用纯数据层

建议新增或重构的 API：

```ts
function parseParamFileObject(
  data: unknown,
  expectedMode: AppMode,
): TrayParams | CustomLayoutParams | SteppedLayoutParams;

function importParams(
  file: File,
  expectedMode: AppMode,
): Promise<TrayParams | CustomLayoutParams | SteppedLayoutParams>;
```

这样草稿加载流程可以直接：

1. 从 localStorage 读出 record.paramFile
2. 调用 parseParamFileObject(record.paramFile, "stepped")
3. 成功后 setParams
4. 失败则提示草稿损坏，并允许用户删除该草稿

收益：

- 文件导入与草稿加载完全复用校验和迁移逻辑
- 后续支持更多模式时，只扩展一套解析能力
- 可以避免 localStorage 数据与下载文件长期演化后出现分叉

## 6. 状态与职责划分

### 6.1 建议新增模块

#### src/lib/local-drafts.ts

职责：

- 封装 localStorage 读写
- 维护草稿索引
- 提供 CRUD 能力
- 处理序列化和异常

建议 API：

```ts
listDrafts(mode: "stepped"): DraftListItem[]
getDraft(id: string): DraftRecord | null
createDraft(title: string, params: SteppedLayoutParams): DraftRecord
updateDraft(id: string, title: string, params: SteppedLayoutParams): DraftRecord
renameDraft(id: string, title: string): DraftRecord
deleteDraft(id: string): void
exportDraft(id: string): void
```

#### src/hooks/useSteppedDrafts.ts

职责：

- 连接 stepped 当前参数与本地草稿存储
- 维护 currentDraftId / draftNameInput / isDialogOpen
- 提供 save / saveAs / load / rename / delete / export 动作
- 统一 toast 提示

建议由该 Hook 接收：

- 当前 params
- setParams
- onAfterLoad 回调

onAfterLoad 用于在加载草稿后清理页面级 UI 状态，例如：

- selectedSlotIds
- previewGroupId

#### src/components/SteppedDraftDialog.tsx

职责：

- 只负责展示草稿弹窗 UI
- 不直接操作 localStorage
- 通过 props 接收列表与动作回调

#### src/components/ui/dialog.tsx

项目当前没有现成 dialog 封装，建议补一个基于 Radix Dialog 的 shadcn 风格组件，供草稿弹窗复用。

### 6.2 现有文件改动建议

#### src/components/SteppedPanel.tsx

新增：

- 保存草稿按钮
- 草稿列表按钮
- 当前草稿信息展示区（可选，但建议做）

按钮位置建议放在现有导入导出 / 操作区附近，保持和参数导入导出的心智一致。

#### src/app/page.tsx

负责页面级联动：

- stepped 模式下挂载 useSteppedDrafts
- 加载草稿成功后清空 selectedSlotIds
- 加载草稿成功后重置 previewGroupId

#### src/lib/param-io.ts

重构：

- 抽出 parseParamFileObject
- importParams 改为复用 parseParamFileObject
- 草稿加载也复用 parseParamFileObject

## 7. 关键交互细节

### 7.1 保存行为

第一版建议支持两种保存：

- 保存为新草稿
- 覆盖当前草稿

规则：

- 若 currentDraftId 为空，点击“保存草稿”时默认引导输入名称并创建新草稿。
- 若 currentDraftId 存在，点击“保存草稿”可直接覆盖并 toast 提示“草稿已更新”。
- 弹窗中仍保留“另存为新草稿”，方便用户分叉多个方案。

### 7.2 默认命名

若用户未输入名称，自动生成：

```text
阶梯草稿 2026-03-30 14:25
```

### 7.3 加载行为

加载草稿时应执行：

1. 校验草稿数据
2. setParams(loadedParams)
3. 清空当前选中槽位
4. 重置组预览状态
5. 将 currentDraftId 切换为该草稿 id
6. 关闭弹窗
7. toast 成功提示

注意：

- 加载后不自动生成 3D 模型，沿用当前 stepped 模式既有逻辑。
- 加载行为本质上是“替换当前编辑态”，应视为一次明确的上下文切换。

### 7.4 删除行为

删除当前已加载草稿时：

- 只删除本地保存记录
- 不强制重置当前编辑器内容
- 但需要清空 currentDraftId，避免后续误认为还绑定该草稿

这是更安全的行为，因为用户可能只是想删掉历史快照，但继续保留当前画布上的编辑结果。

### 7.5 重命名行为

重命名只更新：

- index item.title
- record.item.title

不修改 paramFile 内的 params 内容。

### 7.6 导出行为

弹窗中的“导出”直接复用现有下载能力：

```ts
downloadParamFile("stepped", draft.paramFile.params, filename);
```

推荐文件名：

```text
stepped-draft-{slugifiedTitle}.json
```

## 8. 异常与边界处理

需要覆盖以下情况：

- localStorage 不可用
- localStorage 超配额
- 草稿索引存在，但单条草稿记录丢失
- 草稿记录 JSON 解析失败
- 草稿结构版本不支持
- paramFile.version 与现有解析逻辑不兼容
- 草稿名称为空或只含空格

处理建议：

- 所有异常统一转为用户可理解的 toast。
- 列表读取时若发现坏记录，可在 UI 标记“草稿损坏”，并仅保留删除操作。
- 第一版可以不做自动修复，只做明确提示与删除兜底。

## 9. 可扩展性设计

虽然第一版只做 stepped，但结构上要避免把逻辑写死在 UI 中。

建议保留的扩展点：

- DraftMode 使用 mode 字段区分不同建模模式。
- local-drafts.ts 的 listDrafts / createDraft 设计为 mode-aware。
- 草稿列表项摘要生成拆成按模式的 summary builder。
- parseParamFileObject 继续作为所有模式共享入口。

未来接入 custom / grid 时，理论上只需要：

- 增加对应 mode 的摘要生成逻辑
- 在各自面板挂接 save / list 入口
- 复用同一套 dialog 与存储模块

## 10. 开发任务拆分

### 任务 1：重构参数解析入口

目标：让文件导入和本地草稿加载共用同一套校验逻辑。

工作内容：

- 在 src/lib/param-io.ts 抽出 parseParamFileObject。
- 让 importParams 改为“读取文件文本 -> JSON.parse -> parseParamFileObject”。
- 保持现有 custom -> stepped 迁移逻辑不变。

验收标准：

- 现有导入参数功能行为不变。
- stepped 草稿加载可以直接复用该 API。

### 任务 2：实现本地草稿数据层

目标：提供稳定的 localStorage CRUD 能力。

工作内容：

- 新增 src/lib/local-drafts.ts。
- 实现索引读写、单条记录读写、创建、覆盖、重命名、删除。
- 为 stepped 草稿生成摘要字段。
- 处理异常与坏记录。

验收标准：

- 可以列出全部 stepped 草稿。
- 可以按 id 读取草稿完整记录。
- 删除和重命名会同步更新索引与记录。

### 任务 3：实现 stepped 草稿业务 Hook

目标：把页面状态、toast 与数据层拼起来。

工作内容：

- 新增 src/hooks/useSteppedDrafts.ts。
- 管理 currentDraftId、dialogOpen、draftNameInput。
- 暴露 saveCurrentDraft、saveAsNewDraft、loadDraft、renameDraft、deleteDraft、exportDraft。
- 加载成功后触发 onAfterLoad 回调。

验收标准：

- 页面可以知道当前是否绑定某个草稿。
- 保存、加载、重命名、删除、导出都能统一走该 Hook。

### 任务 4：补齐弹窗 UI 基础组件

目标：为草稿列表提供标准弹窗承载。

工作内容：

- 新增 src/components/ui/dialog.tsx。
- 使用项目现有 UI 风格封装 Radix Dialog。

验收标准：

- 弹窗可打开、关闭、聚焦管理正常。
- 样式和现有面板风格一致，不突兀。

### 任务 5：实现草稿管理弹窗

目标：完成用户可见的草稿管理界面。

工作内容：

- 新增 src/components/SteppedDraftDialog.tsx。
- 实现保存区与草稿列表区。
- 支持列表排序、行内重命名、删除确认、导出、加载。
- 空状态展示。

验收标准：

- 用户可以只通过该弹窗完成全部草稿管理动作。
- 无需跳转页面或使用浏览器文件系统即可继续编辑。

### 任务 6：接入 stepped 模式页面

目标：把能力接到现有 stepped 编辑流程中。

工作内容：

- 在 src/components/SteppedPanel.tsx 增加“保存草稿”和“草稿列表”入口。
- 在 src/app/page.tsx 中接入 useSteppedDrafts。
- 加载草稿后清空 selectedSlotIds 与 previewGroupId。

验收标准：

- 只在 stepped 模式可见草稿入口。
- 加载草稿后画布状态与分组预览状态不会残留旧选择。

### 任务 7：联调与回归验证

目标：确保新能力不破坏既有 stepped 工作流。

工作内容：

- 验证 stepped 正常保存、加载、删除、重命名、导出。
- 验证原有 ParamIOButtons 的文件导入导出仍然正常。
- 验证 STL 导出链路不受影响。
- 验证刷新页面后仍可读取已保存草稿。

验收标准：

- 草稿功能与文件导入导出可以并存。
- 无明显状态串扰、无控制台错误。

## 11. 验收用例

建议至少覆盖以下手动用例：

1. 新建一个 stepped 配置并保存为新草稿。
2. 刷新页面后打开草稿列表，成功加载该草稿。
3. 对已加载草稿修改参数后覆盖保存，再次加载结果正确。
4. 对同一配置另存为新草稿，列表中出现两条记录。
5. 在弹窗中重命名草稿，刷新后名称仍正确。
6. 在弹窗中导出草稿，下载 JSON 成功且能重新导入。
7. 删除一个未加载草稿，列表立即消失。
8. 删除当前已加载草稿后，编辑器当前内容仍保留，但 currentDraftId 被清空。
9. 人为篡改 localStorage 中某条记录后，UI 能提示损坏并允许删除。
10. 切换到 grid / custom 模式时不显示草稿入口。

## 12. 实施建议

推荐实施顺序：

1. 先做 param-io 重构，确保解析入口统一。
2. 再做 local-drafts.ts，把数据层跑通。
3. 再接 useSteppedDrafts，把业务动作跑通。
4. 最后补 dialog 与弹窗 UI，做页面集成。

这样可以先把高风险的“数据一致性”问题收敛，再处理界面细节。
