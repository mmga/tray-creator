# 网格与自定义模式 STEP 导出探索

日期：2026-11-20。分支：`codex/explore-step-export`。

后续实施见[详细开发计划](D:/project/mmga/modelling-tools/tray-creator/docs/superpowers/plans/2026-11-20-grid-custom-step-export.md)，包含支持矩阵、分阶段任务、验收门槛与回滚边界。

结论：可以在现有静态网站架构中增加 STEP 实体导出，但需要一条从参数构造 B-rep 的出口。现有 JSCAD 输出是多面体，仅更换序列化器不会恢复圆柱面。此次只添加独立实验，没有修改产品入口或应用依赖。

## 复现

在仓库根目录执行：

```powershell
npm ci --prefix experiments/step-export
npm run probe --prefix experiments/step-export
```

根目录原有依赖也需安装。实验依赖锁定 Replicad 1.2.1、replicad-opencascadejs 1.2.1、tsx 4.23.15；独立 package-lock.json 不影响应用 pnpm 锁文件。

生成的 STEP、输入参数和 report.json 位于本目录 `out/`，按现有规则忽略提交。脚本包含断言，失败时以非零状态退出。

## 实测证据

使用真实 `createTrayModel` / `createCustomTrayModel` 作为多面体参考，复用 `prepareGridTrayCutSource` / `prepareCustomTrayCutSource` 的切削体和底孔指令。圆槽重建为圆柱，其他槽从真实投影轮廓拉伸；外轮廓重建为圆角矩形。

| 样本 | STEP 大小约 | B-rep 面数 | 相对现有多面体体积差 |
| --- | ---: | ---: | ---: |
| 2×2 圆槽网格＋封闭磁吸腔 | 98 KB | 38 | 0.0691% |
| 2×2 矩形槽网格 | 93 KB | 30 | 0.0069% |
| 自定义两个不同直径圆槽 | 48 KB | 16 | 0.0091% |
| 自定义 35° 旋转超椭圆＋外扩 | 289 KB | 75 | 0.0044% |

四组均通过：

- 构造及 STEP 读回后的 OpenCascade `BRepCheck_Analyzer` 几何、拓扑检查。
- 与现有模型外接框逐坐标差异小于 0.001 mm，体积相对差小于 0.2%。这只是样本门槛，不是曲面精度保证。
- STEP 写入毫米单位和实体表示；读回后相对体积差小于 1e-8、外接框差小于 0.001 mm。

圆槽样本包含 `CYLINDRICAL_SURFACE`。超椭圆样本只有外框圆角是圆柱面，槽壁仍是原采样轮廓对应的分段平面。不能称为全曲面导出。

本机 Node.js 24.13.1 下单次内核初始化约 0.50 秒，各样本含参考建模、STEP 导出及读回约 0.07–0.52 秒；这不是浏览器或大模型性能承诺。单线程 WASM 原始 22,942,327 字节，gzip 7,263,957 字节；还需加载 JS，实际网络压缩取决于部署配置。

发现：本版本默认 `cut` 的面合并使封闭磁吸腔样本无法通过拓扑检查；设置 `simplify: false` 后通过。正式出口应始终校验结果，不能只检查文件是否生成。

## 路线选择

| 路线 | 能得到什么 | 判断 |
| --- | --- | --- |
| 当前多面体转 STEP | 可用平面包裹原离散模型，圆槽仍由很多平面组成 | 仅作明确标识的兼容出口；本次未实现该转换 |
| 参数 → OpenCascade B-rep → STEP | 圆槽、圆角等可成为真实曲面；可保留当前参数含义 | 建议路线，本次验证其基础能力 |
| 服务端 CAD 转换 | 可在服务端运行 CAD 内核 | 会引入后端、部署和模型传输，不适合当前纯静态架构的第一步 |

建议采用独立、按需加载的单线程 STEP Worker。保留现有 JSCAD 预览/STL，在 STEP 导出时从同一参数快照重建实体。官方建议将 Replicad/OpenCascade 计算放入 Worker，参见 [集成说明](https://replicad.xyz/docs/use-as-a-library/)。STEP 的多实体命名、单位接口见 [官方导出实现](https://github.com/sgenoud/replicad/blob/main/packages/replicad/src/export/assemblyExporter.ts)。

STEP 输出实体几何，不承诺恢复目标 CAD 软件里的原始草图、约束或特征历史。仍应附带本项目 JSON 参数。

## 正式接入范围

1. 抽取两种模式共同消费的参数构造数据，包含外框、槽轮廓、放置坐标、切削高度和底孔指令。复用 `getGridCutGeometry`、布局尺寸函数、`getFreeSlotProfileGeometry`、`BaseHoleConstructionPlan`；避免让第二套建模逻辑重新计算容差。实验从切削体反取尺寸只是验证手段，不应原样成为生产接口。
2. 普通矩形托盘先覆盖圆槽、矩形槽、底孔、纯底板。网格普通凹槽当前从 `baseThickness - 0.01` 开始切，而自定义从 `baseThickness` 开始；统一出口前必须明确保留该差异还是另立修复，不能悄悄改变槽深。
3. 单独处理斜面、半圆槽、零间距去岛、盒体/盖子及随形多实体。这些当前模型能力不能被导出按钮静默忽略；未覆盖的配置必须明确禁用 STEP 并说明原因。
4. 自定义超椭圆＋法向外扩不能用标准椭圆或简单增大长短轴替代。短期可明确提供采样轮廓实体；若要求光滑槽壁，应从现有轮廓函数做有误差控制的曲线拟合，并核验轮廓偏差、切向连续性和布尔稳定性。随形轮廓目前也主要保留多边形，需要同样区分。
5. 手动拆件复用已保存路径与二维分区，在 B-rep 上裁切。需处理“原外边界是采样多边形，STEP 外壁是曲面”的差异；不能直接用内接的旧分区裁掉原曲面边缘。验证体积守恒、共享切面、孔腔完整性及多件导出。此次未验证拆件。
6. 导出接入点包括 `model-ports.ts`、独立 STEP Worker、`grid-model-service.ts`、`custom-layout-service.ts`、`manual-split-model-service.ts`、文件命名、参数伴随导出和对应操作面板。继续使用 `exportModelArtifactBundle` 的快照与全部成功后下载规则；Worker 传递参数/字节数据，避免传递内核对象。
7. 验收需覆盖真实浏览器的 WASM 路径与静态部署、首次加载、进度/取消/重复导出及内存释放；扩展样本的拓扑、尺寸和体积检查，并在用户目标 CAD 软件中导入实测。

## 边界

此次验证的是四个无斜面、矩形外框样本，并非完整导出功能；没有接 UI、没有更换应用内核、没有跑应用全量回归。未验证浏览器打包、移动设备、大规模槽阵列、商业 CAD 互通、拆件及上述特殊结构。

实验保留原超椭圆离散轮廓，因此体积接近并不证明获得光滑精确曲面。Replicad 包声明 MIT，所安装的内核包声明 LGPL-2.1-only；正式分发时应核对该固定版本随包许可证和分发安排。
