# 自定义固定托盘随机排版实施计划

> **执行方式：** 按任务顺序实施；每项完成后运行对应测试并创建独立 Git 提交。

## 目标

在自定义模式的固定托盘中，为当前全部凹槽提供一次原子性的随机重新排布。成功结果必须处于圆角上沿可用区域内，且不含凹槽碰撞或间距冲突；失败时保留原布局。

## 任务一：实现并测试纯随机布局算法

**文件：**

- 新建：`src/lib/custom-random-layout.ts`
- 新建：`src/lib/custom-random-layout.test.ts`

**实现：**

1. 定义成功与失败的可判别结果类型，以及可注入随机源。
2. 仅在 `traySizingMode === "fixed"` 时执行；使用 `calculateFixedCustomTrayUsableArea` 取得真实可用区域。
3. 按最终轮廓面积从大到小、原数组顺序稳定排序。
4. 每轮为每个凹槽最多尝试 500 个、按 0.1mm 对齐的候选位置；最多进行 30 次完整重启。
5. 通过 `isCustomSlotWithinFixedTrayUsableArea` 验证圆角边界，并复用现有碰撞模型验证已放置槽位间的重叠和间距。
6. 一轮无法放置完整布局即丢弃该轮；只返回原顺序的完整更新，或原子失败结果。

**验证：**

```bash
pnpm vitest run src/lib/custom-random-layout.test.ts
pnpm typecheck
```

**提交：** `feat: 实现固定托盘随机排版算法`

## 任务二：接入布局状态和撤销历史

**文件：**

- 修改：`src/hooks/useCustomLayout.ts`
- 修改：`src/hooks/useCustomLayout.integration.test.ts`

**实现：**

1. 从 Hook 暴露 `randomizeSlots()`，以 `Math.random` 调用纯算法。
2. 成功时通过一次普通 `applyChange` 应用全部位置更新，确保产生一个撤销条目并使预览过期。
3. 失败、非固定模式或空布局时不修改参数，并将算法结果原样返回给界面。

**验证：**

```bash
pnpm vitest run src/hooks/useCustomLayout.integration.test.ts
pnpm typecheck
```

**提交：** `feat: 接入随机排版布局状态`

## 任务三：增加固定模式操作入口与反馈

**文件：**

- 修改：`src/components/CustomPanel.tsx`
- 修改：`src/workspaces/custom/useCustomWorkspace.tsx`
- 修改：`src/components/panels.test.tsx`

**实现：**

1. 在固定托盘尺寸设置之后展示“随机排列”按钮；自动模式不渲染，空布局禁用。
2. 调用 `randomizeSlots()` 后展示短暂操作反馈：成功为“已随机排列 N 个凹槽”，失败为“固定可用区域无法容纳当前全部凹槽”。
3. 不改变既有固定边界越界的持久状态提示，也不改变生成、导出可用性。

**验证：**

```bash
pnpm vitest run src/components/panels.test.tsx
pnpm typecheck
```

**提交：** `feat: 添加固定托盘随机排列操作`

## 任务四：执行端到端回归并整理交付

**文件：**

- 按前述测试发现的必要最小修复文件。

**验证：**

```bash
pnpm vitest run
pnpm typecheck
pnpm lint
git diff --check
git status --short
```

**提交：** 仅在回归修复产生代码修改时创建 `test: 覆盖固定托盘随机排版回归`；无修改则不创建空提交。

## 完成标准

- 随机排列仅出现在自定义固定托盘模式。
- 成功结果完全合法、0.1mm 对齐，且为单步可撤销操作。
- 搜索失败不改变任何凹槽位置。
- 自动模式、持久化格式、报价、磁吸孔与生成导出行为保持不变。
