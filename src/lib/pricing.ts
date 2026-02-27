import type { TrayParams } from "@/types/tray";
import type { CustomLayoutParams } from "@/types/custom-tray";

/**
 * ============================================
 * 托盘报价计算公式
 * ============================================
 */

// 阶梯孔位价格表
export function getSlotPrice(diameter: number): number {
    if (diameter <= 25.01) return 0.5;
    if (diameter <= 28.51) return 0.6;
    if (diameter <= 32.01) return 0.8;
    if (diameter <= 40.01) return 1;
    if (diameter <= 50.01) return 1.3;
    return 2.0; // 60mm 及以上
}

// 基础定价参数
export const PRICING_CONFIG = {
    pricePerMagnet: 0.3,    // 每个磁吸孔的附加价格 (元)
    customBasePrice: 10.0,  // 自定义模式的起步价/底价 (元)
    plaCostPerKg: 60,       // PLA耗材每千克价格 (元)
    plaDensity: 1.24,       // PLA密度 (g/cm³)
    infillRatio: 0.6,       // 3D打印有效填充率 (托盘薄件占比高，实心度约60%-70%)
};

/**
 * 计算模型预估耗材重量 (克)
 * 考虑到了 3D 打印的非实心特性 (根据 infillRatio 打折)
 */
export function calculateWeight(volume: number): number {
    return (volume / 1000) * PRICING_CONFIG.plaDensity * PRICING_CONFIG.infillRatio;
}

/**
 * 计算网格模式的报价
 * 规则：按凹槽数量 * 该尺寸的单价计算，如果有磁吸孔则加上磁吸附加价
 */
export function calculateGridPrice(params: TrayParams): number {
    const slotCount = params.rows * params.columns;
    if (slotCount === 0) return 0;

    let total = slotCount * getSlotPrice(params.holeDiameter);

    if (params.enableBaseHole) {
        total += slotCount * PRICING_CONFIG.pricePerMagnet;
    }

    return total;
}

/**
 * 根据椭圆或圆形的宽高，计算等效圆面积对应的直径
 */
export function getEquivalentDiameter(width: number, height: number): number {
    return Math.sqrt(width * height);
}

export function calculateCustomPrice(params: CustomLayoutParams, volume: number): number {
    if (volume <= 0) return 0;
    const weight = calculateWeight(volume);
    return weight * 0.4;
}
