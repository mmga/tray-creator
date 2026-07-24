# 让 Custom Worker 任务复用单一结果

Status: `needs-triage`

Type: `AFK`

Size: `M`

User stories: `US-3`, `US-5`, `US-6`

## 要构建什么

让每个 Custom Worker 模型生成或导出任务在任务入口构造一次请求级权威 Contoured Footprint Construction 结果，并将其显式传给 3D construction、dimensions、Contour Body Count、diagnostics、base-hole 和 export 阶段。

任务完成后释放结果；后续独立任务允许重新构造。不跨主线程与 Worker 传递 Geom2，不建立跨任务缓存。

## 验收标准

- [ ] 一个 Custom 模型生成任务内部只调用一次构造 Adapter。
- [ ] 一个 Custom 导出任务内部只调用一次构造 Adapter。
- [ ] 独立任务各自构造，不复用前一个任务的 Geom2 身份。
- [ ] 3D、尺寸、Contour Body Count、diagnostics 和 base-hole 阶段消费同一任务结果。
- [ ] 结构化失败返回稳定错误，不生成部分几何或部分导出文件。
- [ ] smoothing fallback 保持成功结果并携带非阻断 diagnostics。
- [ ] Worker 与主线程对等价输入产生语义等价的 bodies、bounds、body count 和 diagnostics。

## 阻塞项

- [任务 02：建立 Custom 主线程权威构造结果](02-authoritative-custom-contoured-result.md)

## 实施提示

请求级结果的 **Seam** 应位于 Worker 任务装配 **Module**。不要让 `custom-tray-model.ts`、base-hole 逻辑和 export 分别从参数重构。

预计涉及：

- `src/lib/worker/tray.worker.ts`
- `src/lib/custom-tray-model.ts`
- `src/lib/custom-contoured-footprint.ts`
- `src/lib/base-hole-rules.ts`
- `src/lib/worker/worker-service.ts`
- Worker ports 与响应类型

## 验证

- Worker 任务级构造调用次数测试
- Custom model generation 与 export 定向测试
- Worker 结构化失败测试
- `pnpm typecheck`

## Comments
