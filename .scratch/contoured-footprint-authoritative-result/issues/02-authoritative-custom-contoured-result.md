# 建立 Custom 主线程权威构造结果

Status: `needs-triage`

Type: `AFK`

Size: `L`

User stories: `US-1`, `US-2`, `US-3`, `US-4`, `US-6`

## 要构建什么

深化 Custom 布局状态 **Module**，使其成为主线程中唯一允许调用 Custom Contoured Footprint Construction **Adapter** 的位置。该 Module 的 **Interface** 显式提供已提交权威结果、可选工作结果和结构化失败；2D、尺寸、Contour Body Count、base-hole validation 与 Tray Result Projection 消费这些结果，不再从完整参数自行重构。

Contoured Footprint 激活时同步构造；Rectangular Footprint 激活时保留仍有效的休眠结果，但不执行或消费 Contoured Footprint Construction。

## 验收标准

- [ ] 同一 Custom 已提交相关输入快照只暴露一个权威构造结果。
- [ ] viewport、effective dimensions、Contour Body Count、base-hole validation 和 Tray Result Projection 显式接收结果，不调用构造 Adapter。
- [ ] 可见的 Contoured 2D 连续编辑对每个呈现的工作参数快照最多构造一次工作结果。
- [ ] 工作结果不影响尺寸、校验、结果投影、模型生成或导出。
- [ ] 取消连续编辑丢弃工作结果；提交后用新规范化参数对应结果替换已提交结果。
- [ ] Rectangular Footprint 不触发构造；矩形专属参数不使休眠结果失效。
- [ ] Slot Instances、共享布局输入或 contour parameters 变化时，使休眠结果失效。
- [ ] 结构化失败保持可编辑与 Draft persistence，显示持久错误，并阻断预览、模型生成和导出。
- [ ] 相同失败快照不重试；修复相关输入后只生成一个新结果。
- [ ] bounds、area、Contour Body Count、diagnostics 和 outlines 与当前实现保持语义一致。

## 阻塞项

- [任务 01：统一 Custom 连续编辑事务](01-unify-custom-continuous-edit.md)

## 实施提示

Custom **Adapter** 只负责把 Custom 参数投影为核心构造请求，不拥有缓存、失效或错误展示生命周期。共享的 Geom2 按只读值处理，消费者不得原地修改。

预计涉及：

- `src/hooks/useCustomLayout.ts`
- `src/lib/custom-contoured-footprint.ts`
- `src/viewports/layout-editor/customViewportModel.ts`
- `src/lib/custom-layout-math.ts`
- `src/lib/base-hole-rules.ts`
- `src/lib/tray-result-projection.ts`
- Custom workspace、结果摘要和错误展示相关文件

## 验证

- 新增 Custom 权威结果 Interface 测试和构造调用次数测试
- `src/lib/contoured-footprint.test.ts`
- Custom viewport、base-hole 和 Tray Result Projection 定向测试
- `pnpm typecheck`

## Comments

- 2026-07-24：已完成。新增 Mode-local `useCustomContouredFootprint`，主线程 viewport、base-hole validation 与 Tray Result Projection 显式消费已提交或工作构造结果。结构化失败会阻断生成/导出并显示为持久诊断；Rectangular Footprint 保留最近有效的休眠结果。Worker 重复构造路径保留给任务 04。
- 验证：权威结果定向测试 2/2、主线程消费者定向测试 26/26、Custom 集成测试 7/7、`pnpm typecheck`、`pnpm lint`、`git diff --check` 均通过。
