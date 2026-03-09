## Plan: 自定义阶梯底座标签页

新增一个与现有 `custom` 并行的模式标签页 `自定义阶梯底座`，复用现有 2D 编辑交互（拖拽、对齐、碰撞、撤销）与渲染流程，但在数据与建模层引入“每个凹槽独立墙高/底部高度 + 全局底部外扩边距”的新语义。采用“新格式 + 向后兼容导入”策略，尽量隔离旧 `custom` 逻辑，降低回归风险。

**Steps**
1. Phase 1 - Mode 框架接入（阻塞后续）: 扩展模式类型与标签页入口，新增 `自定义阶梯底座` 选项并在页面状态机中挂接独立 hook 与面板渲染分支；保持旧 `grid/custom` 行为不变。*后续步骤依赖本步骤*
2. Phase 2 - 类型与配置建模（依赖 1）: 新增 `SteppedSlot` / `SteppedLayoutParams`（命名可在实现时微调）并定义字段：每槽 `wallHeight`、`bottomHeight`，全局 `bottomExpandMargin`；在配置中补充默认值与范围限制，并明确单位为 mm。*后续步骤依赖本步骤*
3. Phase 3 - 状态管理 hook（依赖 2）: 复制并裁剪 `useCustomLayout` 形成新 hook（如 `useSteppedLayout`），保留撤销快照、自动生成、槽编辑等机制；新增更新每槽 `wallHeight/bottomHeight` 的 API，并确保新增槽位时自动填充默认值。*可与步骤 4 并行设计，但实现建议先 3 后 4*
4. Phase 4 - UI 面板与 2D 编辑复用（依赖 1,2,3）: 新建面板组件（如 `SteppedPanel`）复用现有参数区结构，增加每槽高度编辑能力与全局边距滑杆；`LayoutCanvas` 继续复用 2D 几何（x/y/宽高/旋转）逻辑，不将 Z 轴参数混入碰撞计算；必要时在槽选中态展示当前 `wallHeight/bottomHeight`。
5. Phase 5 - 几何生成器实现（依赖 2,3）: 新建 `stepped-tray-model`，按你的定义生成几何：凹槽由“墙 + 底部平台”组成；墙高即凹槽深度，底部为凹槽轮廓外扩 `bottomExpandMargin` 后的圆柱体平台；`bottomHeight` 作为保底厚度基准，确保布尔运算后不会穿底。
6. Phase 6 - Worker/Service 通路（依赖 5）: 在 `tray.worker.ts` 增加新任务分支，在 `worker-service.ts` 增加对应 `generateStepped(...)` 方法；保持消息体纯 JSON，避免破坏现有 `custom` 生成通道。
7. Phase 7 - 导入导出兼容（依赖 2）: 扩展 `param-io` 版本与校验逻辑，支持新模式参数持久化；导入旧 `custom` 数据时自动映射默认 `wallHeight/bottomHeight/bottomExpandMargin`，保证“新格式 + 向后兼容导入”。
8. Phase 8 - 价格与尺寸联动评估（依赖 5）: 检查 `pricing.ts` 与尺寸/体积计算是否需要接入新几何体积估算；若当前仅基于外形尺寸定价则可保持不变并记录决策，否则补充新模式体积路径。
9. Phase 9 - 稳定性与回归验证（依赖 1-8）: 覆盖 UI 交互（添加槽、拖拽、对齐、每槽高度编辑、撤销重做、2D/3D 切换）、几何正确性（墙/底分层与保底厚度）、导入导出兼容、STL 导出可用性与 worker 错误处理。

**Relevant files**
- `/Users/bianyunpeng/Desktop/project/mmga/tray-creator/src/types/custom-tray.ts` — 扩展模式类型；新增阶梯底座模式参数/槽位类型。
- `/Users/bianyunpeng/Desktop/project/mmga/tray-creator/src/components/ModeTabs.tsx` — 新增 `自定义阶梯底座` 标签页入口。
- `/Users/bianyunpeng/Desktop/project/mmga/tray-creator/src/app/page.tsx` — 模式分支接线，挂载新 hook、新面板与生成流程。
- `/Users/bianyunpeng/Desktop/project/mmga/tray-creator/src/lib/config.ts` — 新模式默认值、限制范围（`bottomExpandMargin` 等）。
- `/Users/bianyunpeng/Desktop/project/mmga/tray-creator/src/hooks/useCustomLayout.ts` — 复用参考模板；抽取或镜像到新 hook。
- `/Users/bianyunpeng/Desktop/project/mmga/tray-creator/src/hooks/useSteppedLayout.ts` — 新增：阶梯底座模式状态管理与生成调度。
- `/Users/bianyunpeng/Desktop/project/mmga/tray-creator/src/components/CustomPanel.tsx` — 复用参考模板。
- `/Users/bianyunpeng/Desktop/project/mmga/tray-creator/src/components/SteppedPanel.tsx` — 新增：新模式参数编辑 UI（每槽墙高/底高、全局外扩边距）。
- `/Users/bianyunpeng/Desktop/project/mmga/tray-creator/src/components/LayoutCanvas.tsx` — 复用 2D 编辑，不引入 Z 轴碰撞。
- `/Users/bianyunpeng/Desktop/project/mmga/tray-creator/src/lib/custom-tray-model.ts` — 复用建模流程模板。
- `/Users/bianyunpeng/Desktop/project/mmga/tray-creator/src/lib/stepped-tray-model.ts` — 新增：墙体与底部平台的几何构造和布尔运算。
- `/Users/bianyunpeng/Desktop/project/mmga/tray-creator/src/lib/worker/tray.worker.ts` — 新增 worker 任务分支。
- `/Users/bianyunpeng/Desktop/project/mmga/tray-creator/src/lib/worker/worker-service.ts` — 新增 `generateStepped` 客户端调用。
- `/Users/bianyunpeng/Desktop/project/mmga/tray-creator/src/lib/param-io.ts` — 新格式持久化与旧格式导入兼容映射。
- `/Users/bianyunpeng/Desktop/project/mmga/tray-creator/src/lib/pricing.ts` — 评估是否需接入新模式体积/价格路径。

**Verification**
1. 在 UI 中切换到 `自定义阶梯底座`，验证 2D 编辑基础能力与 `custom` 一致：新增/删除槽、拖拽、旋转、对齐、撤销重做。
2. 对同一槽设置不同 `wallHeight/bottomHeight`，切换到 3D 视图检查是否正确呈现“墙 + 外扩底部平台”。
3. 调整 `bottomExpandMargin`（默认 1.0mm）并观察 3D 几何底部平台半径/轮廓变化。
4. 检查极值输入（最小/最大）不会穿底、不会引发 worker 异常；错误信息可读。
5. 导入旧 `custom` 参数文件，确认可成功进入新模式并自动补齐新字段默认值。
6. 导出并再次导入新模式参数，确认字段完整回放。
7. 执行一次 STL 导出并验证文件可生成；确保旧 `grid/custom` 流程无回归。

**Decisions**
- 标签页名称固定为 `自定义阶梯底座`。
- `wallHeight` 与 `bottomHeight` 为“每个凹槽单独设置”。
- `bottomExpandMargin` 为全局可调参数，默认 `1.0mm`。
- `bottomHeight` 语义定义为“保底厚度（相对托盘最底面）”。
- 参数格式采用新结构，并提供旧 `custom` 的向后兼容导入。

**Further Considerations**
1. 参数约束建议: 墙高与底高存在几何耦合。推荐增加校验 `wallHeight + bottomHeight <= totalTrayHeight`（或等价约束），超限时在 UI 即时提示而非等到 worker 报错。
2. 每槽参数编辑交互建议: 推荐“选中槽后在侧栏编辑当前槽参数”，避免在画布上堆叠过多控件影响操作精度。
3. 体积定价策略建议: 若当前定价依赖近似体积，需明确新模式按真实几何估算还是继续按外形近似，避免价格预期偏差。
