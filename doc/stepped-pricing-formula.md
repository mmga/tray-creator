# 阶梯托盘体积与报价公式（草案）

## 1. 目标

当前 `src/lib/pricing.ts` 对 stepped 模式仍然使用 `weight * 0.4` 的简化口径。这个公式最大的问题是只看体积估重，不看以下几个对实际成交价影响很大的因素：

- 打印机占用时长
- 床面占地面积
- 多层高差带来的失败风险
- 混合底座尺寸带来的设计和调参成本
- 60mm 大底座混排带来的额外价值

这份文档先定义 stepped 模式的报价口径，先落文档，不改代码。

## 2. 定价原则

阶梯托盘报价拆成 4 段：

1. `耗材成本`：由体积换算重量，覆盖材料消耗
2. `机时成本`：由打印时长覆盖机器占用
3. `占地成本`：由成品有效占地补偿床面资源
4. `复杂度费用`：由高度层级、底座混排、大底座、平滑半径、断开桥接等参数补偿设计和失败风险

最终价格保留到整数元。

## 3. 输入变量

下列变量都可以从 stepped 参数和切片结果中得到：

- `volumeMm3`：模型几何体积，单位 `mm^3`
- `weightG`：耗材重量，优先取切片器实际值；没有切片器结果时再用体积估算
- `printHours`：打印时长，优先取切片器实际值；没有切片器结果时再用经验公式估算
- `effectiveWidth` / `effectiveDepth`：由槽位外接边界 + `spacing * 2` 计算出的实际占地
- `footprintAreaMm2 = effectiveWidth * effectiveDepth`
- `heightLevelCount`：实际参与打印的 `bottomHeight` 档位数量
- `diameterTypeCount`：槽位直径种类数量
- `slotCount40to59`：直径 `>= 40` 且 `< 60` 的槽位数量
- `slotCount60Plus`：直径 `>= 60` 的槽位数量
- `smoothingRadius`
- `disconnectDistance`

注意：报价要使用实际占地，不要直接信任 JSON 文件名。文件名可能是历史导出名，参数已经被后续编辑过。

## 4. 体积到耗材重量

### 4.1 优先级

```text
weightG = slicerWeightG ?? estimatedWeightG
```

如果切片器已经给出真实耗材重量，直接使用切片器数据。

### 4.2 无切片器时的估重公式

```text
estimatedWeightG = (volumeMm3 / 1000) * 1.24 * fillRatio
```

- `1.24` 为 PLA 密度，单位 `g/cm^3`
- `fillRatio` 不再固定写死为 `0.60`

建议使用下式作为 stepped 模式的 `fillRatio`：

```text
fillRatio =
  clamp(
    0.58
    + 0.02 * max(0, heightLevelCount - 3)
    + 0.03 * max(0, diameterTypeCount - 1)
    + 0.02 * (slotCount40to59 / slotCount)
    + 0.05 * (slotCount60Plus / slotCount),
    0.58,
    0.72
  )
```

说明：

- 基础值从 `0.60` 下调到 `0.58`，避免普通 stepped 托盘在轻量布局上估重偏高
- 多高度层级越多，通常意味着周边包裹和柱体过渡更多，实际用料比固定填充率更高
- 大底座越多，外围轮廓更厚、更平滑，耗材占比也会更高

如果 `slotCount = 0`，则 `estimatedWeightG = 0`。

## 5. 打印时长

### 5.1 优先级

```text
printHours = slicerHours ?? estimatedHours
```

### 5.2 无切片器时的经验公式

```text
estimatedHours =
  0.45
  + weightG / 65
  + 0.15 * max(0, heightLevelCount - 3)
  + 0.10 * I(disconnectDistance > 0)
  + 0.05 * slotCount60Plus
```

其中 `I(...)` 为指示函数，条件成立取 `1`，否则取 `0`。

这个公式的定位不是替代切片器，而是在没有切片结果时给价格公式提供一个稳定、可解释的机时输入。

## 6. 报价公式

### 6.1 复杂度费用

```text
complexityFee =
  2.0 * max(0, heightLevelCount - 3)
  + 2.0 * max(0, diameterTypeCount - 1)
  + 0.5 * slotCount40to59
  + 5.7 * slotCount60Plus
  + 3.0 * I(smoothingRadius >= 12)
  + 1.5 * I(disconnectDistance > 0)
```

解释：

- `heightLevelCount`：每多一档高度，过渡面和失败风险都会增加
- `diameterTypeCount`：混排意味着轮廓组织更复杂
- `40-59mm`：有明显的大底座，但还没到超大件
- `60mm+`：对占地、轮廓平滑、支撑稳定性和商业价值影响都明显，单独拉高权重
- `smoothingRadius >= 12`：轮廓更圆润，实体更厚，打印时间和体积都会上升
- `disconnectDistance > 0`：意味着存在主动断桥/分离需求，设计和打印风险更高

### 6.2 最终报价

```text
priceRaw =
  1
  + 0.10 * weightG
  + 6.5 * printHours
  + footprintAreaMm2 / 7000
  + complexityFee

price = round(priceRaw)
```

说明：

- `0.10 * weightG`：材料项，口径直观，便于后续按耗材价格调整
- `6.5 * printHours`：机时项，给 3D 打印机占用、维护和失败重打留空间
- `footprintAreaMm2 / 7000`：占地项，补偿大面积托盘对床面的长期占用
- 常数项 `1`：用于覆盖包装、收尾等固定小额成本

## 7. 三个样本的校准结果

### 样本 A

- 文件：`tmp/json/tray_stepped_236x109_11slots.json`
- 有效占地：`236 x 109`
- 耗材重量：`112g`
- 打印时长：`2h29m`
- 关键特征：4 档高度、2 种直径、3 个 40mm 槽、`disconnectDistance = 10`

```text
complexityFee = 2*1 + 2*1 + 0.5*3 + 5.7*0 + 0 + 1.5 = 7.0
priceRaw = 1 + 0.10*112 + 6.5*2.483 + 236*109/7000 + 7.0
         ≈ 39.02
price    = 39
```

### 样本 B

- 文件：`tmp/json/tray_stepped_260x260_10slots (3).json`
- 当前参数计算出的有效占地约为：`188 x 107`
- 耗材重量：`108g`
- 打印时长：`2h27m`
- 关键特征：5 档高度、单一直径、`smoothingRadius = 15`

```text
complexityFee = 2*2 + 2*0 + 0.5*0 + 5.7*0 + 3 + 0 = 7.0
priceRaw = 1 + 0.10*108 + 6.5*2.45 + 188*107/7000 + 7.0
         ≈ 37.60
price    = 38
```

备注：这个文件名里的 `260x260` 与当前参数算出来的有效占地不一致，后续实现时应始终以参数计算值为准，不要用文件名参与报价。

### 样本 C

- 文件：`tmp/json/tray_stepped_222x173_13slots.json`
- 有效占地：`222 x 173`
- 耗材重量：`192g`
- 打印时长：`4h`
- 关键特征：6 档高度、2 种直径、3 个 60mm 槽、`smoothingRadius = 15`

```text
complexityFee = 2*3 + 2*1 + 0.5*0 + 5.7*3 + 3 + 0 = 28.1
priceRaw = 1 + 0.10*192 + 6.5*4 + 222*173/7000 + 28.1
         ≈ 79.79
price    = 80
```

## 8. 建议的实现顺序

后续如果要把这份方案落到代码里，建议顺序如下：

1. stepped 模式先改，grid/custom 先不动
2. UI 同时展示 `估重 / 机时 / 占地 / 复杂度` 的分项，避免用户只看到单个总价
3. 如果有切片器结果，优先用切片器重量和时长覆盖经验估算
4. 报价先保留整数元，不要提前做更复杂的心理价位处理

## 9. 暂不纳入本版公式的因素

以下因素目前先不放进公式，避免过拟合：

- 单次订单数量折扣
- 包邮/平台佣金
- 特殊材料（PETG、ABS、树脂）
- 二次加工（打磨、喷涂、贴磁铁）
- 紧急单加价

这几个因素更适合在成交环节作为单独附加项，而不是塞进基础报价公式。
