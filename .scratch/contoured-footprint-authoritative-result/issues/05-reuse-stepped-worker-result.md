# 让 Stepped Worker 任务复用单一结果

Status: `needs-triage`

Type: `AFK`

Size: `L`

User stories: `US-3`, `US-5`, `US-6`

## 要构建什么

让每个 Stepped Worker whole-model、split preview 或 export 任务在任务入口构造一次请求级权威 Contoured Footprint Construction 结果，并将其显式传入 Stepped CAD feature graph、3D construction、split stages、dimensions、Contour Body Count 和 diagnostics。

不同 Worker 任务保持独立，任务结束即释放结果；不建立跨任务缓存，也不跨线程传递 Geom2。

## 验收标准

- [ ] 一个 whole-model 任务内部只调用一次构造 Adapter。
- [ ] 一个 split preview 任务内部只调用一次构造 Adapter。
- [ ] 一个 export 任务内部只调用一次构造 Adapter。
- [ ] feature graph、3D、split、尺寸、body count 和 diagnostics 消费同一任务结果。
- [ ] 多 body、height band、group footprint 与 split interface 语义保持不变。
- [ ] 结构化失败阻断整个任务，不返回部分几何或部分 split parts。
- [ ] 独立任务允许重构，不保留跨任务身份或淘汰状态。
- [ ] Rectangular Stepped Footprint 不执行 Contoured Footprint Construction。

## 阻塞项

- [任务 03：建立 Stepped 主线程权威构造结果](03-authoritative-stepped-contoured-result.md)

## 实施提示

优先让 feature graph 接收预先构造的结果，而不是在深层 Implementation 中重新读取完整参数并构造。保持 split 与 whole-model 的领域语义，不借本任务重写 CAD 算法。

预计涉及：

- `src/lib/worker/tray.worker.ts`
- `src/lib/stepped-cad-feature-graph.ts`
- `src/lib/stepped-cad-tray-model.ts`
- `src/lib/stepped-cad-split-profiles.ts`
- `src/lib/stepped-contoured-footprint.ts`
- Worker ports 与响应类型

## 验证

- whole-model、split preview 与 export 的任务级构造调用次数测试
- Stepped feature graph、CAD model、split profiles 定向测试
- multi-body 与结构化失败测试
- `pnpm typecheck`

## Comments

- 2026-07-24：已完成。Stepped Worker 的 `GENERATE_STEPPED` 与 `GENERATE_STEPPED_SPLIT_PARTS` 各自在任务入口构造一次 Contoured 结果，并传入 CAD feature graph、整模或分件装配；结构化失败会阻断对应任务。`EXPORT_STL` 仅序列化既有 Geom3，不重建轮廓。
- 验证：Worker、feature graph、CAD 整模与 split profile 定向测试 33/33，`tsc --noEmit`、`git diff --check` 通过。实现提交：`f80bed8`。
