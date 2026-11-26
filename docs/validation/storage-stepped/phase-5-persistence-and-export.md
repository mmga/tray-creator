# 阶段 5 验收记录：持久化、草稿及文件导出

日期：2026-11-26

状态：软件部分通过。

## 改动文件

- `src/lib/storage-stepped-normalization.ts`、`src/lib/param-normalization.ts`
- `src/lib/historical-param-artifact-reader.ts`、`src/lib/current-param-artifact-encoder.ts`（沿用）
- `src/lib/draft-summary.ts`、`src/lib/draft-legacy-normalize.ts`、`src/lib/local-drafts.ts`、`src/workspaces/shared.tsx`
- `src/lib/storage-stepped-model-service.ts`、`src/workspaces/draft-action-area.ts`、`src/components/PanelActionSection.tsx`
- 测试：`storage-stepped-normalization.test.ts`、`storage-stepped-param-artifact.test.ts`、
  `storage-stepped-drafts.test.ts`、`storage-stepped-export.test.ts`

## 参数与草稿

- 图案文件新增模式身份 `storage-stepped`；旧 `stepped` / `stepped-cad` / `simple-stepped` 文件仍按普通阶梯读取，不转换为收纳主体。
- 归一化保存接口版本、实际接口数值、高度规格、三阶托盘槽位与底孔配置；未知接口版本、非有限数、固定 6 mm 被改写、阶索引错位、槽深越界均带参数位置报错。接口数值不做静默钳位。
- 草稿允许列表、默认标题、摘要与恢复链路已接入；摘要显示高度规格、三阶槽数（如 `10/0/0`）、接口版本与实际托盘尺寸。
- 页面级覆盖风险确认仍由 `useModeEditor` 的替换事务负责；导入失败不修改当前草稿或参数。

## 导出

- 单件：主体 / 当前托盘；只校验该零件及参数级错误，无关托盘错误不阻断。
- 整套：主体 + 三块托盘共 4 件 STL，加一份完整参数 JSON；任意零件准备失败不触发任何下载。
- 导出几何来自 Worker 的打印坐标（底面 Z=0），不使用屏幕场景；文件名包含高度规格、零件身份与接口版本：`storage_stepped_<standard|storage>_<body|tray-stepN>_ssi1.stl`。
- 复用 `exportModelArtifactBundle`：先准备全部文件再按顺序触发下载；浏览器未触发下载时抛出 `ModelArtifactDownloadError` 并报告失败数量。
- 参数 JSON 三位小数往返：接口、槽位相对位置与尺寸在 0.001 mm 内保持一致，导入后校验仍通过。

## 执行命令与结果

```sh
pnpm exec vitest run src/lib/storage-stepped-normalization.test.ts \
  src/lib/storage-stepped-param-artifact.test.ts \
  src/lib/storage-stepped-drafts.test.ts \
  src/lib/storage-stepped-export.test.ts
# 10 + 7 + 4 + 6 项通过
pnpm typecheck
pnpm lint
# 通过（--max-warnings=0）
```

## 复测记录

全量 `pnpm test:unit` 首次在后台静态服务器与浏览器同时运行时，出现 4 个测试文件失败（其中 `storage-stepped-model.test.ts` 的装配干涉断言失败），该次运行耗时 113 s；单独重跑几何测试通过。随后在无并发负载下重跑全量：**144 文件 / 957 测试全部通过**，耗时 52.8 s。判断首次失败为并发资源竞争导致的超时/抖动，非确定性几何差异；保留该次失败事实并记录复测结果。

## 未解决事项

- 浏览器实际下载是否落盘只能确认“触发下载”，不能确认文件系统状态（与现有模式一致）。
