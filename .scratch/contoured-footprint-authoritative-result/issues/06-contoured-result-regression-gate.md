# 完成跨 Mode 回归与性能门槛

Status: `needs-triage`

Type: `AFK`

Size: `M`

User stories: `US-1`, `US-2`, `US-3`, `US-4`, `US-5`, `US-6`

## 要构建什么

完成 Custom 与 Stepped 权威 Contoured Footprint Construction 结果重构的跨 Mode 回归门槛：删除剩余生产调用点中的独立重构，验证允许的构造 **Seam**，覆盖成功、fallback、失败、休眠、连续编辑、Mode Editing Session replacement 和 Worker 任务语义，并记录去重后的性能结果。

## 验收标准

- [ ] 生产代码中只有各 Mode 布局状态 **Module** 和 Worker 任务装配 **Module** 调用对应构造 Adapter。
- [ ] Custom 与 Stepped 主线程均有领域级构造调用次数测试，不直接统计 React 开发模式试探性 render。
- [ ] Custom 与 Stepped Worker 均有任务级构造调用次数测试。
- [ ] 成功、smoothing fallback、结构化失败、Rectangular dormant result、commit、cancel 和 Session replacement 全部有回归测试。
- [ ] bounds、area、outlines、Contour Body Count、diagnostics 和 base-hole violations 与重构前语义一致。
- [ ] 64-slot 等现有 fixture 的性能门槛保持：median ratio 不超过 `1.25`，单次 ratio 不超过 `1.5`。
- [ ] `pnpm typecheck` 通过。
- [ ] 相关定向测试通过。
- [ ] 完整测试完成；若出现已有 CAD 或 optimization timeout，使用单 worker 隔离重跑并记录基线与本次结果。
- [ ] `git diff --check` 通过。
- [ ] 实现文档记录最终构造调用关系、失效规则和性能数据。

## 阻塞项

- [任务 02：建立 Custom 主线程权威构造结果](02-authoritative-custom-contoured-result.md)
- [任务 03：建立 Stepped 主线程权威构造结果](03-authoritative-stepped-contoured-result.md)
- [任务 04：让 Custom Worker 任务复用单一结果](04-reuse-custom-worker-result.md)
- [任务 05：让 Stepped Worker 任务复用单一结果](05-reuse-stepped-worker-result.md)

## 实施提示

可使用测试注入或纯 Interface 测试统计领域构造次数。不要通过全局 mutable counter 改变生产 Implementation，也不要为测试引入新的缓存。

## 验证

- `pnpm typecheck`
- 权威结果、viewport、base-hole、Tray Result Projection、Worker 与 continuous edit 定向测试
- `pnpm test`
- `git diff --check`

## Comments
