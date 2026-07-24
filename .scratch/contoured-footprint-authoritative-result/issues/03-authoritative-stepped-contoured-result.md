# 建立 Stepped 主线程权威构造结果

Status: `needs-triage`

Type: `AFK`

Size: `L`

User stories: `US-1`, `US-2`, `US-3`, `US-4`, `US-6`

## 要构建什么

让 Stepped Layout Core 复用任务 02 建立的权威结果 **Interface**，并成为 Stepped 主线程中唯一的 Contoured Footprint Construction 调用者。2D group outlines、diagnostics、effective dimensions、base-hole validation 与 Tray Result Projection 显式消费同一结果。

Contoured 分支不再通过异步 outline path 重复构造；现有 outline preview 路径只保留 Rectangular Stepped Footprint 真正需要的能力。连续编辑期间，工作结果只供可见实时 2D 使用，其他消费者继续读取 `persistedParams` 对应结果。

## 验收标准

- [ ] 同一 Stepped 已提交相关输入快照只暴露一个权威构造结果。
- [ ] group outlines、diagnostics、effective dimensions、Contour Body Count、base-hole validation 和 Tray Result Projection 不再自行重构。
- [ ] Contoured 2D group outlines 直接由权威结果投影。
- [ ] 连续编辑时尺寸、校验、结果摘要、模型生成和导出保持在已提交参数快照。
- [ ] 取消保留原已提交结果；提交只替换一次结果。
- [ ] group outline 顺序、颜色、body 归属、bounds 和 diagnostics 与当前实现语义一致。
- [ ] Rectangular Stepped Footprint 不调用 Contoured Footprint Construction。
- [ ] Rectangular outline preview 保持现有 lowest layer 与 higher group envelope 语义。
- [ ] 结构化失败和 smoothing fallback 遵守与 Custom 相同的展示及阻断规则。
- [ ] 相同失败快照不重试，相关输入变化后只重试一次。

## 阻塞项

- [任务 02：建立 Custom 主线程权威构造结果](02-authoritative-custom-contoured-result.md)

## 实施提示

不要把主线程结果迁移到 Worker，也不要新增 debounce。若去重后仍不满足帧预算，应另行设计异步派生结果生命周期。

预计涉及：

- `src/hooks/useSteppedLayoutController.ts`
- `src/hooks/useSteppedOutlinePreview.ts`
- `src/lib/stepped-outline-preview.ts`
- `src/lib/stepped-contoured-footprint.ts`
- `src/viewports/layout-editor/steppedViewportModel.ts`
- `src/lib/stepped-layout-math.ts`
- `src/lib/base-hole-rules.ts`
- `src/lib/tray-result-projection.ts`

## 验证

- 新增 Stepped 权威结果 Interface 测试和构造调用次数测试
- Stepped continuous edit、outline preview、base-hole 和 Tray Result Projection 定向测试
- Rectangular/Contoured style 切换测试
- `pnpm typecheck`

## Comments
