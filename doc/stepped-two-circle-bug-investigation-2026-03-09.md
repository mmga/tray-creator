# Stepped 模式两圆柱建模异常调查记录（2026-03-09）

## 1. 问题描述

- 现象：Stepped 模式下，2 个圆柱在特定间距时会出现错误建模。
- 典型表现：凹槽未被正确挖除，或出现视觉异常（法线/拓扑异常）。
- 用户反馈：多轮修复后仍报告“依然不好用”。

## 2. 复现参数（用户提供）

```json
{
  "version": 1,
  "mode": "stepped",
  "params": {
    "trayWidth": 260,
    "trayDepth": 260,
    "slots": [
      {
        "id": "9da724e0-956d-4368-90c9-9776bc32bf35",
        "x": 124.6,
        "y": 130,
        "shape": "circle",
        "width": 25,
        "height": 25,
        "rotation": 0,
        "bottomHeight": 5
      },
      {
        "id": "3b4fedd6-c078-45fb-a862-4ec3323a17cb",
        "x": 160.2,
        "y": 130,
        "shape": "circle",
        "width": 25,
        "height": 25,
        "rotation": 0,
        "bottomHeight": 5
      }
    ],
    "spacing": 5,
    "holeDepth": 3,
    "smoothingRadius": 60
  }
}
```

换算后关键几何关系：

- 两圆心距离 `distance = 35.6`
- `width = height = 25`
- `spacing = 5`
- `smoothingRadius = 60`

## 3. 关键日志特征（历史）

典型异常日志（节选）：

- `base_solid.volume` 为正
- `hole_overlap.overlapSum: 0`
- `subtract_output.removedVolume: ~0`

说明：subtract 在业务上等价“未发生挖孔”。

另一些阶段出现：

- `base_solid.volume` 为负
- subtract 后体积绝对值反而变大

说明：在该情况下 subtract 实际变成了“加体积”行为（语义反转）。

## 4. 调查过程与尝试方案

### 4.1 数值抖动/相切稳定性修复（已尝试）

- 文件：`src/lib/outline-geometry.ts`
- 方案：加入 `MORPH_EPSILON`（近相切场景的连续 ramp epsilon）
- 目的：避免膨胀/腐蚀边界在临界距离跳变
- 结论：可改善局部稳定性，但未根治本问题

### 4.2 中间 CSG 阶段反转实体（已否定）

- 文件：`src/lib/stepped-tray-model.ts`
- 方案：在 `base_solid` / `hole` / `final` 等阶段使用 `geom3.invert`
- 结论：
  - 会破坏布尔语义，导致 subtract 变 no-op 或行为异常
  - 该方案被撤销，不作为根因修复

### 4.3 增加方向与重叠诊断日志（保留过）

- 文件：`src/lib/stepped-tray-model.ts`, `src/lib/worker/tray.worker.ts`
- 关键诊断：
  - `inspectSolidOrientation`
  - `safeIntersectionVolume`
  - `hole_overlap`/`subtract_output` 等结构化日志
- 结论：帮助定位“subtract 是否真实发生”与“实体是否重叠”

### 4.4 Three.js 三角化改造（已尝试）

- 文件：`src/lib/jscad-to-three.ts`
- 方案：从 fan triangulation 改为 `THREE.ShapeUtils.triangulateShape` + 2D 投影
- 结论：提高了凹多边形三角化鲁棒性，但未单独解决该根因

### 4.5 2D 绕序归一化（已尝试并否定）

- 文件：`src/lib/outline-geometry.ts`
- 方案：尝试 `geom2.reverse()` 或重建轮廓为 CCW
- 实验结论（关键）：
  - 虽能让体积符号“看起来正确”（负变正）
  - 但会出现 `intersect = 0`、`subtract` 不生效（removed ≈ 0）
  - 因此不能作为可靠修复

### 4.6 根因验证脚本（tmp 目录）

使用脚本：

- `tmp/diag_subtract.cjs`
- `tmp/test_reconstruct.cjs`
- `tmp/test_3d_approach.cjs`
- `tmp/test_verify_direction.cjs`
- `tmp/test_final_approach.cjs`

验证到的核心事实：

1. 当基底为负体积时，`subtract` 可能导致结果绝对体积增大（等价“加料”）。
2. 直接对 `offset(-delta)` 产物做 `extrudeLinear`，在某些 segment（如 32/64）下更容易触发异常语义。
3. 同一参数下，不同 segment 对结果影响显著（提示与几何离散和布尔内核稳定性相关）。

### 4.7 最新已落地方案（当前代码）

- 文件：`src/lib/stepped-tray-model.ts`
- 思路：
  1. 构造 3D 扩展柱体并 `union`（避免直接把可疑 2D 轮廓作为基底实体来源）
  2. 将 2D 闭运算轮廓仅作为 `mask3D`
  3. 用 `intersect(expandedBase3D, mask3D)` 生成 `baseSolid`
  4. 再执行 `subtract(baseSolid, holes)`

- 当前代码注释中已写明该修复意图。
- 但用户实测仍反馈“依然不好用”，说明线上实际场景仍有未覆盖问题。

## 5. 目前结论

- 问题不是单纯前端渲染问题，也不是单纯体积符号问题。
- 核心在于：JSCAD CSG 在特定 2D 轮廓/离散条件下，布尔语义会异常（特别是 subtract）。
- 体积正负只能作为辅助信号，不能等同于“几何语义正确”。

## 6. 当前代码状态（截至本记录）

- `src/lib/stepped-tray-model.ts`
  - 使用了 3D expanded union + mask intersect 路径
  - 保留了较多 `[STEPPED_ORIENT]` 调试日志
- `src/lib/outline-geometry.ts`
  - 使用 morphological closing（union + offset）
  - 含 tangency epsilon 处理
- `src/lib/jscad-to-three.ts`
  - 使用 `ShapeUtils.triangulateShape` 三角化

## 7. 后续调查建议（供下一轮）

1. 固定一组参数，比较 Worker 中真实输出与脚本输出是否一致：
   - 对比 `measureVolume`、`measureBoundingBox`、`overlapSum`。
2. 对 `RENDER_CONFIG.cylinderSegments` 做运行时 sweep（32/48/64/96）并记录是否必现。
3. 把“subtract 是否真实发生”作为最终判据：
   - 使用 `abs(before) - abs(after)`，而非仅 `before - after`。
4. 若继续不稳定，考虑替代路径：
   - 避免将 `offset(-delta)` 结果直接进入关键布尔链。
   - 尝试用纯 3D 形态学近似流程替换当前 2D->3D关键环节。
5. 收敛后新增自动化回归用例（至少覆盖：2 slot、distance=35.6、smoothingRadius=60）。

## 8. 相关文件索引

- `src/lib/stepped-tray-model.ts`
- `src/lib/outline-geometry.ts`
- `src/lib/jscad-to-three.ts`
- `src/lib/worker/tray.worker.ts`
- `tmp/diag_subtract.cjs`
- `tmp/test_reconstruct.cjs`
- `tmp/test_3d_approach.cjs`
- `tmp/test_verify_direction.cjs`
- `tmp/test_final_approach.cjs`

---

备注：本记录目标是保留排查链路与证据，便于后续继续定位，不代表问题已最终闭环。
