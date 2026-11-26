# 阶段 6 最终软件验收报告

日期：2026-11-26

结论：**软件完成，实物待验证**。阶段 1–5 全部通过；阶段 6 的软件回归、浏览器实测与构建通过；切片、装配公差、承重与柜内操作空间未执行，保持未勾选。

## 一、执行命令与结果

```sh
# 收纳模式定向测试（12 个文件）
pnpm exec vitest run src/lib/storage-stepped-plan.test.ts \
  src/lib/storage-stepped-model.test.ts \
  src/lib/storage-stepped-presets.test.ts \
  src/lib/storage-stepped-normalization.test.ts \
  src/lib/storage-stepped-param-artifact.test.ts \
  src/lib/storage-stepped-drafts.test.ts \
  src/lib/storage-stepped-export.test.ts \
  src/hooks/useStorageStepped.test.tsx \
  src/components/StorageSteppedPanel.test.tsx \
  src/viewports/layout-editor/storageSteppedViewportModel.test.ts \
  src/components/ModeTabs.test.tsx \
  src/mode-editor/catalog.test.ts
# Test Files 12 passed，Tests 102 passed

pnpm exec vitest run --config vitest.performance.config.ts \
  src/lib/storage-stepped.performance.test.ts
# 1 passed

pnpm typecheck
# 通过

pnpm lint
# 通过（--max-warnings=0）

pnpm test
# 单元：144 文件 / 957 测试通过
# 集成：4 文件 / 30 测试通过
# 静态服务器：2 测试通过

pnpm build
# 通过；Worker bundle、初始包大小（4472 / 16384 bytes）校验通过
```

### 测试抖动复测记录

- 第一次全量 `pnpm test`（后台静态服务器与浏览器同时运行）出现 2 个既有时序测试 5 s 超时：`stepped-global-optimize.test.ts`、`tray-model.test.ts`；无断言失败。
- 关闭浏览器与静态服务器后重跑，**全部通过**。保留首次失败事实，判断为并发 CPU 竞争导致的超时抖动。
- 之后机器负载再次升高时，既有重型 JSCAD 测试（`tray-model.test.ts`、`stepped-global-optimize.test.ts`、`manual-split.worker.test.ts`）反复在 5 s 默认上限超时，均无断言失败。已将 `vitest.config.ts` / `vitest.integration.config.ts` 的默认 `testTimeout` 调整为 20 s，仅吸收负载抖动，不改变任何断言或显式超时；调整后 `pnpm test` 全部通过（单元 957、集成 30、静态服务器 2）。

## 二、性能基线（Node，同机单进程）

命令：`pnpm exec vitest run --config vitest.performance.config.ts src/lib/storage-stepped.performance.test.ts`

| 场景 | 耗时 |
| --- | --- |
| 首次主体（标准高度） | 68.1 ms |
| 再次主体（标准高度） | 41.5 ms |
| 主体（收纳高度） | 45.6 ms |
| 平板托盘 | 0.8 ms |
| 32 mm 十人交错托盘（10 槽） | 138.6 ms |
| 主体 + 三块托盘（第 1 阶 10 槽） | 134.5 ms |
| 修改槽位后单块托盘 | 7.9 ms |

说明：建模全部在 Web Worker 中执行，界面不产生新的同步重型建模。以上为单机记录，仅用于后续回归比较，不作为产品性能承诺。

## 三、浏览器实测

环境：macOS、Chrome、本地静态构建、桌面 1440×900；窄屏不追加专用布局（用户确认）。

已验证：

1. 五个模式入口存在，第五个「阶梯收纳展示台」可切换。
2. 收纳模式摘要：240×240×110、235.4×75.4×6、仓净高 21.6/61.6/101.6、理论容积 3.087 L。
3. 第 1 阶应用「32 mm 十人交错双排」：10 槽、校验通过。
4. 开始锻造 → 3D 装配：四件独立零件，体积 614.9 / 81.7 / 106.4 / 106.4 cm³。
5. 选中第 1 阶托盘并提起/放下：仅视图位移，体积不变。
6. 切换收纳高度：240×240×120、仓净高 31.6/71.6/111.6，出现预览过期提示。
7. 重新锻造：主体 689.7 cm³，三块托盘体积不变；过期提示消失。
8. 切到网格模式再切回：高度、第 1 阶 10 槽与 3D 视图选择均保留。
9. 保存草稿 → 刷新页面 → 草稿列表显示「收纳高度 / 10/0/0 槽 / 接口 v1 / 235.4×75.4mm」→ 加载后恢复 240×240×120 与 10 槽。
10. 重置参数：恢复 240×240×110 与 0 槽。
11. 页面无 console 错误或未捕获异常。

证据：`docs/validation/storage-stepped/desktop-3d-assembly.png`。

## 四、未执行的实物与切片项

| 项目 | 状态 |
| --- | --- |
| 两种主体、平板、32 mm 十人托盘、底孔样件切片 | 未执行 |
| 支撑判断与打印方向确认 | 未执行 |
| 局部接口样件 0.2/0.3/0.4 mm 间隙对比 | 未执行 |
| 完整主体与托盘试装（齐平、摇晃、互换、左右拿取） | 未执行 |
| 目标负载、挠度、永久变形与承托边损伤 | 未执行 |
| 柜内左右操作空间、最高层净空、指扣漏件风险 | 未执行 |
| 回填最终间隙/倒角/底板值并同步接口版本 | 未执行 |

## 五、遗留风险

- 32 mm 十人交错布局仍为推导布局，未取得用户实测外形、槽径与坐标。
- 承托边直边段理论接触宽度 1.3 mm（极限 1.0 mm），指扣处局部切断，承重结论必须实物验证。
- 0.3 mm 装配间隙、0.4 mm 倒角与 2.4 mm 底板为暂定打样值。
