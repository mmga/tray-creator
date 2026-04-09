# 阶梯托盘体积与报价公式（草案）

## 1. 目标

当前 `src/lib/pricing.ts` 对 stepped 模式已经改为基于模型真实体积的综合报价。之前的问题是只看体积估重，不看以下几个对实际成交价影响很大的因素：

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
- `weightG`：由模型真实体积估算出的耗材重量
- `printHours`：由模型真实体积与布局特征估算出的打印时长
- `effectiveWidth` / `effectiveDepth`：由槽位外接边界 + `spacing * 2` 计算出的实际占地
- `footprintAreaMm2 = effectiveWidth * effectiveDepth`
- `heightLevelCount`：实际参与打印的 `bottomHeight` 档位数量
- `diameterTypeCount`：槽位直径种类数量
- `slotCount40to59`：直径 `>= 40` 且 `< 60` 的槽位数量
- `slotCount60Plus`：直径 `>= 60` 的槽位数量
- `smoothingRadius`
- `disconnectDistance`

注意：报价要使用实际占地，不要直接信任 JSON 文件名。文件名可能是历史导出名，参数已经被后续编辑过。

## 4. 真实体积到耗材重量

stepped 模式不使用切片器体积，也不直接信任切片器耗材重量。运行时使用 worker 返回的真实几何体积 `measureVolume(geometry)` 作为唯一体积输入。

```text
materialDensityGPerCm3 =
  clamp(
    0.34
    + 0.004 * slotCount40to59
    - 0.008 * slotCount60Plus,
    0.28,
    0.38
  )

estimatedWeightG = (volumeMm3 / 1000) * materialDensityGPerCm3
```

说明：

- 这里的 `materialDensityGPerCm3` 是“有效打印密度”，不是实心 PLA 密度
- 因为 stepped 模式的真实体积是实心几何体积，而实际打印是壳层 + 填充，所以换算后的有效密度会远低于 `1.24 g/cm³`
- `40-59mm` 槽位会略微抬高单位体积用料
- `60mm+` 大底座会降低单位体积对应的实际耗材重量，因为它们通常带来更大的内部空腔比例

## 5. 打印时长

### 5.1 经验公式

```text
estimatedHours =
  0.25
  + weightG / 50
  + 0.041 * max(0, heightLevelCount - 4)
  - 0.03 * slotCount60Plus
```

说明：

- `weightG / 50` 提供主要机时估算
- 当高度档位超过 4 档后，打印管理成本继续上升，因此额外加时
- `60mm+` 大槽位虽然单件大，但会降低部分单位重量的走刀碎片化，因此做小幅扣减

## 6. 报价公式

### 6.1 复杂度费用

```text
complexityFee =
  2.0 * max(0, heightLevelCount - 3)
  + 2.0 * max(0, diameterTypeCount - 1)
  + 0.5 * slotCount40to59
  + 5.65 * slotCount60Plus
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
complexityFee = 2*1 + 2*1 + 0.5*3 + 5.65*0 + 0 + 1.5 = 7.0
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
complexityFee = 2*2 + 2*0 + 0.5*0 + 5.65*0 + 3 + 0 = 7.0
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
complexityFee = 2*3 + 2*1 + 0.5*0 + 5.65*3 + 3 + 0 = 27.95
priceRaw = 1 + 0.10*192 + 6.5*4 + 222*173/7000 + 27.95
         ≈ 79.64
price    = 80
```

## 8. 建议的实现顺序

后续如果还要继续细化这份方案，建议顺序如下：

1. stepped 模式先改，grid/custom 先不动
2. UI 同时展示 `估重 / 机时 / 占地 / 复杂度` 的分项，避免用户只看到单个总价
3. 保持以真实几何体积 `measureVolume` 为单一体积输入，不要混入切片器体积口径
4. 报价先保留整数元，不要提前做更复杂的心理价位处理

## 9. 暂不纳入本版公式的因素

以下因素目前先不放进公式，避免过拟合：

- 单次订单数量折扣
- 包邮/平台佣金
- 特殊材料（PETG、ABS、树脂）
- 二次加工（打磨、喷涂、贴磁铁）
- 紧急单加价

这几个因素更适合在成交环节作为单独附加项，而不是塞进基础报价公式。
