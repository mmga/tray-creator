# 阶段 1 验收记录：参数模型、接口推导与校验

日期：2026-11-26

状态：软件部分通过；实测 32 mm 十人托盘数据仍待补充。

## 基准输入

| 项目 | 标准高度 | 收纳高度 |
| --- | --- | --- |
| 主体宽度 × 总深度 × 总高 | 240 × 240 × 110 | 240 × 240 × 120 |
| 台面高度 | 30 / 70 / 110 | 40 / 80 / 120 |
| 托盘外形 × 总厚 | 235.4 × 75.4 × 6 | 235.4 × 75.4 × 6 |
| 下仓净宽 × 净深 | 232 × 72 | 232 × 72 |
| 安装口 | 236 × 76 × 深 6 | 236 × 76 × 深 6 |
| 仓净高 | 21.6 / 61.6 / 101.6 | 31.6 / 71.6 / 111.6 |
| 隔墙（相邻仓腔重叠高度） | 8 | 8 |
| 理论总容积 | 3.0868992 L | 3.5880192 L |
| 承托台阶 / 居中平底接触 / 侧向极限 | 2 / 1.3 / 1.0 mm | 同左 |

## 改动文件

- `src/types/storage-stepped.ts`
- `src/lib/storage-stepped-config.ts`
- `src/lib/storage-stepped-plan.ts`
- `src/lib/storage-stepped-base-hole.ts`
- `src/lib/storage-stepped-plan.test.ts`
- `CONTEXT.md`、`docs/adr/0005-storage-stepped-independent-mode.md`

## 执行命令与结果

```sh
pnpm exec vitest run src/lib/storage-stepped-plan.test.ts
# Test Files 1 passed (1)，Tests 16 passed (16)
pnpm typecheck
# 通过
```

覆盖：两种高度派生尺寸、托盘尺寸随接口统一变化、高度切换不改变托盘与槽位、未知接口版本、
非有限数 / 负间隙 / 上沿不小于下壁、非正仓净高、倒角破坏承托、接口偏离默认值的提示级别、
固定 6 mm 总厚度、底孔剩余底壁阻断、槽位越界与槽间距不足的零件级报告、托盘数量与阶索引、
配置深拷贝与新槽位标识。

## 未解决事项

- 32 mm 十人交错托盘的实测外形、槽径与坐标尚未提供；阶段 3 预设将标记为推导布局。
- 0.3 mm 装配间隙、0.4 mm 倒角与 2.4 mm 底板的最终打样值待实物确认。
