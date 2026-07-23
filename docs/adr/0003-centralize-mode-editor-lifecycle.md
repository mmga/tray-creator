# 集中 Mode Editor 生命周期与 Editing Session 替换

页面只消费 `ModeEditor.active` 并通过 `ModeEditor.perform` 发送 Mode 生命周期与 Editing Session 替换意图。active Mode、四个 Mode 的 Workspace/Viewport 配对、替换风险门、确认状态和最终提交顺序均由 `useModeEditor` 独占；页面、面板与 Draft Module 不直接替换外部输入。

普通 Mode 切换与 Session 替换是两种不同操作。普通切换只退出源 Mode，取消 Working Edit 并清理源瞬态交互，同时保留各 Mode 的参数、Undo History、Draft Binding、未保存状态、独立 `2d/3d` 视图和 Session Epoch。reset、参数导入和 Draft 加载属于 Session 替换：必须先准备输入，再读取风险指纹，确认后重新读取风险，最后同步提交参数、Draft Binding、交互清理、Viewport 重置和 Epoch 更新。风险变化时不得沿用旧确认。

Mode、参数快照、Workspace、Viewport 与提交函数通过泛型映射在编译期配对。Catalog 是唯一配对位置；每个 Viewport 自己拥有视图状态。异步预览、轮廓、分件与优化结果同时受 Session Epoch 和请求所有权约束，旧 Session 的成功、失败、loading 与几何结果均不能污染新 Session。

## 后果

- 新增 Mode 时必须同时提供同 Mode 的 Workspace、Viewport、替换目标和 Catalog 项，类型系统会拒绝错配。
- 保存、重命名、删除和导出 Draft 继续由 Draft Module 负责；它们不是 Session 替换，不进入 Mode Editor 命令总线。
- 外部输入提交只能从 Mode Editor 的替换路径发起；架构测试禁止页面重新持有 Mode 或 Model Hook，也禁止恢复旧双 Registry。
- 生产回滚必须整体回滚 Mode Editor 单入口提交，不能只恢复页面状态或保留旁路提交。

## 否决的方案

- 页面分别选择 Workspace 与 Viewport：会形成两个 Registry、重复 active Mode 所有权，并允许 Mode 配对漂移。
- 让各面板直接 reset、import 或 load Draft：会绕过风险复核、交互清理、Viewport 重置和 Session Epoch。
- 使用通用 `unknown` 或跨 Mode 参数联合提交：把错误 Mode 的快照推迟到运行时，削弱替换原子性。
- 普通切换复用 Session reset：会意外清空目标 Mode 的视图、历史和 Draft 状态。
