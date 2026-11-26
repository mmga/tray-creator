# 阶段 4 验收记录：模式接入、二维交互与三维预览

日期：2026-11-26

状态：软件部分通过；桌面浏览器实测通过。窄屏适配经用户确认不在本次范围，未再追加专用移动布局。

## 改动文件（主要）

- `src/types/custom-tray.ts`、`src/lib/mode-param-snapshot.ts`、`src/lib/param-normalization.ts`
- `src/lib/historical-param-artifact-reader.ts`、`src/lib/draft-summary.ts`、`src/lib/draft-legacy-normalize.ts`
- `src/lib/local-drafts.ts`、`src/workspaces/shared.tsx`、`src/components/DraftManagerDialog.tsx`
- `src/mode-editor/catalog.ts`、`src/hooks/useModeEditor.tsx`、`src/components/ModeTabs.tsx`
- `src/lib/model-ports.ts`、`src/lib/worker/tray.worker.ts`、`src/lib/worker/worker-service.ts`
- `src/lib/storage-stepped-model-service.ts`、`src/lib/storage-stepped-layout-import.ts`
- `src/hooks/useStorageStepped.ts`
- `src/viewports/layout-editor/storageSteppedViewportModel.ts`
- `src/viewports/storage-stepped/useStorageSteppedViewportWorkspace.tsx`
- `src/workspaces/storage-stepped/useStorageSteppedWorkspace.tsx`
- `src/components/StorageSteppedPanel.tsx`、`src/components/StorageSteppedViewer.tsx`
- `src/workspaces/draft-action-area.ts`、`src/components/PanelActionSection.tsx`
- 测试：`useStorageStepped.test.tsx`、`storageSteppedViewportModel.test.ts`、`StorageSteppedPanel.test.tsx`、
  `tray.worker.test.ts`、`worker-service.test.ts`、`catalog.test.ts`、`ModeTabs.test.tsx`

## 交互与缓存

- 第五个模式入口「阶梯收纳展示台」，键盘可达；2D/3D 标签保留 `2D 编辑`、`3D 装配`。
- 2D 编辑器复用 `LayoutCanvas`，固定 235.4 × 75.4 托盘边界，只编辑当前阶；边界、槽间距、碰撞错误由同一套校验显示。
- 3D 视图每件独立网格与颜色，支持装配/单件切换、选中与提起托盘；提起只改变视图位移，不进入参数或导出。
- 主体与三块托盘按各自几何指纹缓存：
  - 切换高度只重建主体（浏览器实测：主体 614.9 → 689.7 cm³，三块托盘 81.7 / 106.4 / 106.4 cm³ 不变）；
  - 修改某阶槽位只重建该托盘；
  - 接口变化使全部零件失效；
  - 视图切换不重建几何。
- 连续拖动使用预览/提交事务，一次手势一条撤销记录；切换阶、切到 3D、模式切换或会话替换会结束事务。
- 过期 Worker 结果不覆盖新缓存；失败结果记录到对应零件并可重试；非法托盘只阻断自身导出。

## 执行命令与结果

```sh
pnpm exec vitest run src/hooks/useStorageStepped.test.tsx \
  src/components/StorageSteppedPanel.test.tsx \
  src/viewports/layout-editor/storageSteppedViewportModel.test.ts \
  src/mode-editor/catalog.test.ts \
  src/components/ModeTabs.test.tsx \
  src/lib/worker/tray.worker.test.ts \
  src/lib/worker/worker-service.test.ts
# 全部通过
pnpm typecheck
pnpm lint
# 通过（--max-warnings=0）
pnpm build
# 通过；Worker bundle、初始包大小校验通过
```

## 浏览器实测

环境：macOS、本地静态构建（`out/`）、Chrome、桌面 1440×900。

步骤与结果：

1. 打开首页，五个模式标签均存在，第五个为「阶梯收纳展示台」。
2. 切入收纳模式：摘要显示 240×240×110、235.4×75.4×6、仓净高 21.6/61.6/101.6、理论容积 3.087 L。
3. 第 1 阶选择「32 mm 十人交错双排」：显示 10 槽，校验通过。
4. 开始锻造并切到 3D 装配：主体、三块托盘分别显示体积 614.9 / 81.7 / 106.4 / 106.4 cm³。
5. 选中第 1 阶托盘并「提起托盘」：按钮变为「放下托盘」，模型体积不变。
6. 切换「收纳高度」：摘要变为 240×240×120、仓净高 31.6/71.6/111.6，出现预览过期提示。
7. 重新锻造：主体 689.7 cm³，三块托盘体积保持不变；过期提示消失。
8. 切到「网格模式」再切回：收纳高度与第 1 阶 10 槽配置保留，3D 视图选择保留。
9. 页面无 console 错误或未捕获异常。

证据：`docs/validation/storage-stepped/desktop-3d-assembly.png`。

## 未解决事项

- 提起托盘的相机视角与指扣/承托边可读性仍需人工目视确认具体装配效果。
- 窄屏不追加专用布局（用户确认）；现有标签容器仍可横向滚动。

## 交互与异步生命周期覆盖（S4-10）

- `useStorageStepped.test.tsx`：首次生成四零件、高度/槽位/接口三种失效范围、复制撤销、一次手势一条撤销、
  过期请求不覆盖、单件失败与重试、卸载时释放 Three.js 几何。
- 无关模式初始化成本：收纳模式 Hook 在未生成前不发起 Worker 请求，不加载 JSCAD/Three 几何；
  正式构建的初始包校验仍为 4472 / 16384 bytes，未同步加载 Three.js 或 JSCAD。

## 补充：布局导入预览

导入托盘布局的确认对话框增加固定托盘边界内的 SVG 槽位预览：可导入时绿色、存在冲突时红色，并同时显示源/目标尺寸、整体平移量与冲突列表。该预览只用于确认位置，不缩放、不裁剪槽径。
