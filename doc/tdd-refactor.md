# 渐进式改造成 TDD 开发模式评估与实施方案

## Summary
当前工程适合做“逐步 TDD 化”，不适合一次性全仓强推。整体难度评估为`中高`，不是因为业务特别复杂，而是因为测试基础几乎为零，同时存在几类天然不易测的代码：
- 没有测试框架、测试脚本、测试目录，也没有 CI 门禁
- 关键交互和状态集中在超大文件里，例如 [LayoutCanvas.tsx](/Users/bianyunpeng/Desktop/project/mmga/tray-creator/src/components/LayoutCanvas.tsx) 约 1300 行、[useSteppedLayout.ts](/Users/bianyunpeng/Desktop/project/mmga/tray-creator/src/hooks/useSteppedLayout.ts) 约 870 行
- 大量浏览器 API、`localStorage`、`URL.createObjectURL`、`FileReader`、`Worker`、Three/JSCAD 混在业务逻辑里
- 现有 `lint` 不能作为可靠门禁，因为会扫到 `.venv`，而且仓内已有一批 React hook / compiler 规则问题

按你给的方向，推荐目标是：
- 新增功能和修改功能走 TDD
- 同步把“核心模块”补到可回归
- 第一阶段以单元 + 集成为主，E2E 后置

推荐总工期：`3.5 到 6 周`，按小步持续改造推进。  
如果只算“建立可用 TDD 基础设施 + 核心第一批测试”，大约 `5 到 8 个工作日`。  
如果目标是“核心路径已有稳定回归网，再要求后续需求默认测试先行”，大约 `2 到 3 周`。  
如果要把大交互组件和复杂 hooks 也拉到比较稳的 TDD 节奏，整体会到 `4 到 6 周`。

## Key Changes
### 1. 建立最小可用的 TDD 基础设施
- 引入 `Vitest + Testing Library + jsdom + coverage` 作为第一阶段主框架。
- 新增脚本约定：
  - `test`
  - `test:watch`
  - `test:coverage`
  - `test:unit`
  - `test:integration`
- 调整 lint / test 作用域，确保默认门禁只扫描仓库源码，不再把 `.venv` 算进去。
- 先不把 Playwright 设为必需门禁，避免第一阶段维护成本过高。

### 2. 先测“纯逻辑稳定区”，再碰复杂 UI
第一批 TDD/补测对象按收益排序：
- `src/lib/param-io.ts`
  - 参数导入导出、版本校验、模式校验、旧数据兼容、`custom -> stepped` 迁移
- `src/lib/layout-symmetry.ts`
  - 镜像轴、坐标变换、越界判断、旋转/选区辅助逻辑
- `src/lib/stepped-group-params.ts`
  - 分组覆盖参数的有效值决议
- `src/lib/stepped-connectivity.ts`
  - 连通性分析、桥接警告
- `src/lib/collision.ts`
  - 多边形/椭圆碰撞判断
- `src/lib/pricing.ts`
  - 报价和重量计算
- `src/lib/local-drafts.ts`
  - 草稿 CRUD、容量上限、损坏数据回退、时间排序

这些模块大多可以先补测试，再在测试保护下小幅重构，是最适合开始建立 TDD 节奏的区域。

### 3. 第二批改造“可测性差的 hooks”
把大 hook 里“状态管理”和“副作用”拆开，再进入 TDD：
- [useTrayModel.ts](/Users/bianyunpeng/Desktop/project/mmga/tray-creator/src/hooks/useTrayModel.ts)
  - 把导出下载、worker 调用、toast、副作用封装成可注入依赖
- [useCustomLayout.ts](/Users/bianyunpeng/Desktop/project/mmga/tray-creator/src/hooks/useCustomLayout.ts)
  - 抽出纯状态变换函数，例如 `updateParam`、slot 插入/复制/移动、有效尺寸计算
- [useSteppedLayout.ts](/Users/bianyunpeng/Desktop/project/mmga/tray-creator/src/hooks/useSteppedLayout.ts)
  - 按“分组管理”“slot 变换”“outline preview 调度”“生成/导出副作用”拆成独立 reducer/服务

这里不建议一上来直接给现状 hook 写很多脆弱测试。正确顺序是：
1. 先抽纯函数/状态机
2. 给纯函数写测试
3. hook 只保留装配和副作用薄层
4. 再补 hook 级集成测试

### 4. 第三批再处理重 UI 组件
- [LayoutCanvas.tsx](/Users/bianyunpeng/Desktop/project/mmga/tray-creator/src/components/LayoutCanvas.tsx)
  - 当前体量过大，不适合直接进入严格 TDD
  - 先拆出命中测试、选区计算、拖拽更新、标签显示规则等纯逻辑
  - 组件层只保留事件绑定和渲染
- `SteppedPanel` / `CustomPanel` / `ParameterPanel`
  - 做“用户行为级”集成测试
  - 重点验证参数联动、开关行为、导入导出触发、禁用状态

### 5. 门禁与团队开发约束
改造完成后的默认开发约束建议为：
- 新需求必须先写失败测试，再写实现
- 修 bug 必须先补重现测试
- 未覆盖的老代码允许逐步补，不要求一次清仓
- PR 门禁先要求：
  - `tsc --noEmit`
  - 针对源码目录的 `eslint`
  - 相关测试通过
- 暂不要求全仓覆盖率阈值；改为“核心目录最低阈值 + 新增代码必须带测试”

## Phase Plan And Estimate
### Phase 0：基线收敛，1 到 2 天
- 落测试框架、测试脚本、测试目录约定
- 修 lint 扫描范围问题，至少让源码门禁可用
- 建立浏览器 API / `localStorage` / `URL` / `crypto` / `Worker` mock 基座

### Phase 1：核心纯逻辑补测，3 到 5 天
- 先覆盖 `param-io`、`layout-symmetry`、`stepped-group-params`、`stepped-connectivity`、`collision`、`pricing`
- 目标是把“参数正确性”和“几何决议正确性”先锁住
- 这是最容易拿到稳定收益的一段

### Phase 2：草稿与状态逻辑，3 到 4 天
- 覆盖 `local-drafts`
- 抽 `useCustomLayout` / `useSteppedLayout` 的纯状态变换逻辑
- 开始要求对应需求先写测试

### Phase 3：生成与导出链路，4 到 6 天
- 给 worker service、导出流程、generate 流程补集成测试
- 用 mock worker / fake blob URL，不直接依赖真实浏览器下载
- 这一阶段后，建模主路径会有基本回归保障

### Phase 4：复杂交互组件渐进拆分，1.5 到 3 周
- 重点是 `LayoutCanvas` 与大型 panel 组件
- 先拆逻辑，再测，不建议直接硬写组件黑盒测试
- 这是全项目里最贵也最容易拖工期的部分

## Test Plan
第一阶段必须覆盖的场景：
- `param-io`
  - 正确导出/序列化
  - 错误版本、错误模式、非法字段报错
  - 旧 stepped 字段兼容
  - `custom -> stepped` 迁移结果正确
- `layout-symmetry`
  - 横向/纵向镜像坐标正确
  - 旋转角处理正确
  - 越界计数正确
- `stepped-group-params`
  - 跟随全局
  - 仅覆盖平滑半径
  - 仅覆盖断链距离
  - 双覆盖
- `stepped-connectivity`
  - 不连通、临界连接、强连接、告警文案
- `local-drafts`
  - 创建、更新、重命名、删除、导出
  - 配额上限
  - 损坏数据恢复
- `pricing`
  - 三种模式的报价与重量换算
- hooks 集成
  - 参数更新导致 stale
  - undo / snapshot 基本可用
  - generate/export 在成功和失败路径上状态正确

第二阶段以后再补：
- `LayoutCanvas` 的拖拽、框选、镜像、标签方向、撤销
- `SteppedPanel` 分组开关和覆盖参数联动
- `TrayViewer` / 3D 切换的加载态与 regenerate 行为
- 少量关键 E2E：
  - 新建 stepped 布局 -> 分组调参 -> 生成 3D
  - 导入参数 -> 编辑 -> 导出
  - 保存草稿 -> 重载 -> 恢复

## Assumptions
- 默认采用 `Vitest + Testing Library`，不在第一阶段引入 E2E 门禁。
- 第一阶段目标不是追求全仓覆盖率，而是先让核心算法和参数链路可回归。
- 对现有大文件，默认先做“抽逻辑再测试”，不直接对大组件强写脆弱测试。
- “TDD 模式开发”默认解释为：从改造完成后的新增需求开始，要求测试先行；历史代码按风险和收益逐步补测。
- 若后续需要更强门禁，再单独追加覆盖率阈值和 Playwright 冒烟测试，不放进第一阶段。
