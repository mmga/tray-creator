# Contoured Footprint 权威结果开发计划

Status: `needs-triage`

## 目标

让 Custom 与 Stepped 在一个执行上下文中，对同一输入参数快照只暴露一个权威 **Contoured Footprint Construction** 结果。2D、尺寸、Contour Body Count、base-hole validation、Tray Result Projection、模型生成和导出显式消费该结果，不再各自重构。

## 已确认约束

- 主线程结果的生命周期限定在一个 **Mode Editing Session** 内，不写入 Draft 或 Persisted Param Artifact。
- 已提交结果服务于尺寸、校验、结果投影、模型生成和导出。
- 工作结果只服务于可见的实时 2D，取消时丢弃，提交时替换已提交结果。
- 结构化失败也是对应参数快照的权威结果，相同快照不重复重试。
- Rectangular Footprint 不执行 Contoured Footprint Construction。
- 不使用进程级全局缓存，不跨主线程和 Worker 传递 Geom2。
- 每个 Worker 任务内部构造一次，任务结束后释放。
- 本轮保持主线程同步构造，不引入新的异步 stale-result 生命周期。

## 用户故事

- US-1：2D、尺寸、Contour Body Count、base-hole validation 和结果摘要始终一致。
- US-2：连续编辑只影响实时 2D，提交或取消后状态正确。
- US-3：构造失败持续可见，但仍可编辑和保存 Draft。
- US-4：Rectangular Footprint 不执行无关轮廓构造。
- US-5：模型生成与导出在单个 Worker 任务内只构造一次。
- US-6：减少重复计算，同时保持现有几何语义和性能门槛。

## 任务与依赖

1. [统一 Custom 连续编辑事务](issues/01-unify-custom-continuous-edit.md)
2. [建立 Custom 主线程权威构造结果](issues/02-authoritative-custom-contoured-result.md)，依赖任务 1
3. [建立 Stepped 主线程权威构造结果](issues/03-authoritative-stepped-contoured-result.md)，依赖任务 2
4. [让 Custom Worker 任务复用单一结果](issues/04-reuse-custom-worker-result.md)，依赖任务 2
5. [让 Stepped Worker 任务复用单一结果](issues/05-reuse-stepped-worker-result.md)，依赖任务 3
6. [完成跨 Mode 回归与性能门槛](issues/06-contoured-result-regression-gate.md)，依赖任务 2、3、4、5

## 推荐执行波次

```text
任务 1
  ↓
任务 2
  ├── 任务 3 ──→ 任务 5
  └── 任务 4
         └──────┬──────┘
                ↓
              任务 6
```

任务 3 与任务 4可以并行，但实施前应约定 `src/lib/base-hole-rules.ts` 和 Worker 类型的修改区域。

## 全局完成条件

- 只有各 Mode 的布局状态 **Module** 和 Worker 任务装配 **Module** 可以调用对应构造 **Adapter**。
- 主线程与 Worker 的成功、fallback 和结构化失败语义等价。
- `pnpm typecheck`、相关定向测试和完整测试完成。
- 现有性能门槛保持不变：median ratio 不超过 `1.25`，单次 ratio 不超过 `1.5`。
- 完整测试中的既有 CAD 超时必须通过隔离重跑与本次回归区分。

## 参考

- `CONTEXT.md`
- `docs/adr/0001-unify-custom-stepped-tray.md`
- `docs/adr/0002-unify-simple-stepped-with-footprint-styles.md`
- `docs/adr/0003-centralize-mode-editor-lifecycle.md`
