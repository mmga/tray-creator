# 阶段 6 软件回归矩阵

日期：2026-11-26

状态：软件项通过；切片与实物项未执行，明确列为待验证。

## 覆盖矩阵

| 类别 | 样本 | 覆盖方式 | 结果 |
| --- | --- | --- | --- |
| 主体高度 | 标准 30/70/110 | `storage-stepped-plan.test.ts`、`model.test.ts` | 通过 |
| 主体高度 | 收纳 40/80/120 | 同上 + 浏览器切换实测 | 通过 |
| 托盘预设 | 平板 0 槽 | `storage-stepped-presets.test.ts` | 通过 |
| 托盘预设 | 25 / 28.5 / 32 交错 / 40 | 同上，0/10/10/10/5 槽 | 通过 |
| 自定义布局 | 增删、移动、旋转、复制、对称插入、撤销 | `presets.test.ts`、`useStorageStepped.test.tsx` | 通过 |
| 槽位边界 | 越界、间距不足 | `plan.test.ts`、二维编辑模型测试 | 通过 |
| 底孔 | 关闭 / 磁铁桩孔合法 / 磁铁桩孔超深 / 磁吸底孔 | `plan.test.ts`、`model.test.ts`、导出测试 | 通过 |
| 接口参数 | 默认值 | 全部派生与几何测试 | 通过 |
| 接口参数 | 偏离默认（宽度、间隙等） | 校验警告 + 生成 | 通过 |
| 负例 | 未知接口版本 | `plan.test.ts`、`normalization.test.ts`、参数文件测试 | 通过 |
| 负例 | 非有限数、负间隙、上沿不小于下壁 | `plan.test.ts`、`normalization.test.ts` | 通过 |
| 负例 | 固定 6 mm 被改写、槽深越界、阶索引错位 | `normalization.test.ts` | 通过 |
| 负例 | Worker 单件失败与重试 | `useStorageStepped.test.tsx` | 通过 |
| 负例 | 下载未触发 | `storage-stepped-export.test.ts` | 通过 |
| 异步 | 快速编辑后过期结果不覆盖 | `useStorageStepped.test.tsx` | 通过 |
| 缓存 | 高度→仅主体；槽位→仅该托盘；接口→全部 | 指纹测试 + Hook 测试 + 浏览器体积对照 | 通过 |
| 持久化 | 参数 JSON 往返 | `storage-stepped-export.test.ts` | 通过 |
| 持久化 | 草稿保存 / 刷新恢复 / 摘要 / 删除 | `storage-stepped-drafts.test.ts` + 浏览器实测 | 通过 |
| 导出 | 单件主体 / 单件托盘 / 全套 4 STL + JSON | `storage-stepped-export.test.ts` + 浏览器动作区 | 通过 |
| 既有模式 | 网格、自定义、底盘生成、普通阶梯 | 全量既有测试回归 | 通过 |
| 全量 | 单元 + 集成 + 静态服务器 | `pnpm test` | 见阶段 6 记录 |

## 未执行的实物项

- 切片（两种主体、平板、32 mm 十人托盘、底孔样件）与支撑判断：未执行。
- 局部接口样件（0.2/0.3/0.4 mm 间隙）与完整主体/托盘试装：未执行。
- 小队重量、目标负载、挠度与承托边损伤测试：未执行。
- 柜内左右操作空间与指扣漏件风险：未执行。

以上项目保持未勾选状态；当前结论为“软件完成，实物待验证”。
