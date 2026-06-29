import type { TrayParams } from "@/types/tray";
import type {
  CustomLayoutParams,
  SimpleSteppedLayoutParams,
  SlotGroup,
  SteppedLayoutParams,
} from "@/types/custom-tray";
import { calculateCustomEffectiveBaseplate } from "@/lib/custom-tray-model";
import { calculateSteppedEffectiveDimensions } from "@/lib/stepped-layout-math";
import { getEffectiveGroupStructureParams } from "@/lib/stepped-group-params";
import { calculateTrayDimensions } from "@/lib/tray-model";

/**
 * ============================================
 * 托盘报价计算公式
 * ============================================
 */

// 基础定价参数
const PRICING_CONFIG = {
  plaCostPerKg: 60, // PLA耗材每千克价格 (元)
  plaDensity: 1.24, // PLA密度 (g/cm³)
  infillRatio: 0.6, // 3D打印有效填充率 (托盘薄件占比高，实心度约60%-70%)
};

const STEPPED_PRICING_CONFIG = {
  baseFee: 1,
  materialRatePerGram: 0.1,
  printRatePerHour: 6.5,
  footprintDivisor: 7000,
  materialDensityMin: 0.28,
  materialDensityMax: 0.38,
  materialDensityBase: 0.34,
  materialDensityLargeSlotBonus: 0.004,
  materialDensityHugeSlotPenalty: 0.008,
  estimatedPrintBaseHours: 0.25,
  estimatedWeightPerHour: 50,
  estimatedPrintHeightLevelStep: 0.041,
  estimatedPrintHeightLevelStart: 4,
  estimatedPrintHugeSlotDiscountHours: 0.03,
  complexityHeightLevelFee: 2,
  complexityDiameterTypeFee: 2,
  complexityLargeSlotFee: 0.5,
  complexityHugeSlotFee: 5.65,
  complexityWideSmoothingFee: 3,
  complexityDisconnectFee: 1.5,
  wideSmoothingThreshold: 12,
} as const;

const CUSTOM_PRICING_CONFIG = {
  baseFee: 2,
  pricePerSlot: 0.2,
  footprintDivisor: 2560,
} as const;

function calculateFlatTrayRawPrice(slotCount: number, footprintArea: number) {
  return (
    CUSTOM_PRICING_CONFIG.baseFee +
    slotCount * CUSTOM_PRICING_CONFIG.pricePerSlot +
    footprintArea / CUSTOM_PRICING_CONFIG.footprintDivisor
  );
}

export interface SteppedPricingBreakdown {
  price: number;
  rawPrice: number;
  baseFee: number;
  materialFee: number;
  printFee: number;
  footprintFee: number;
  complexityFee: number;
  estimatedWeight: number;
  estimatedPrintHours: number;
  materialDensityGPerCm3: number;
  effectiveWidth: number;
  effectiveDepth: number;
  footprintAreaMm2: number;
  heightLevelCount: number;
  diameterTypeCount: number;
  slotCount40to59: number;
  slotCount60Plus: number;
  hasWideSmoothing: boolean;
  hasDisconnectDistance: boolean;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getUsedSteppedGroups(params: SteppedLayoutParams): SlotGroup[] {
  const usedGroupIds = new Set(params.slots.map((slot) => slot.groupId));
  return params.groups.filter((group) => usedGroupIds.has(group.id));
}

function getSteppedStructureFlags(
  params: SteppedLayoutParams,
  groups: SlotGroup[],
) {
  return groups.reduce(
    (acc, group) => {
      const effective = getEffectiveGroupStructureParams(group, params);
      return {
        hasWideSmoothing:
          acc.hasWideSmoothing ||
          effective.smoothingRadius >=
            STEPPED_PRICING_CONFIG.wideSmoothingThreshold,
        hasDisconnectDistance:
          acc.hasDisconnectDistance || effective.disconnectDistance > 0,
      };
    },
    { hasWideSmoothing: false, hasDisconnectDistance: false },
  );
}

function getSteppedPricingCounts(params: SteppedLayoutParams) {
  const widthSet = new Set<number>();
  let slotCount40to59 = 0;
  let slotCount60Plus = 0;

  params.slots.forEach((slot) => {
    widthSet.add(slot.width);
    if (slot.width >= 60) {
      slotCount60Plus += 1;
    } else if (slot.width >= 40) {
      slotCount40to59 += 1;
    }
  });

  return {
    diameterTypeCount: widthSet.size,
    slotCount40to59,
    slotCount60Plus,
  };
}

function calculateSteppedMaterialDensity(
  slotCount40to59: number,
  slotCount60Plus: number,
) {
  return clamp(
    STEPPED_PRICING_CONFIG.materialDensityBase +
      STEPPED_PRICING_CONFIG.materialDensityLargeSlotBonus *
        slotCount40to59 -
      STEPPED_PRICING_CONFIG.materialDensityHugeSlotPenalty *
        slotCount60Plus,
    STEPPED_PRICING_CONFIG.materialDensityMin,
    STEPPED_PRICING_CONFIG.materialDensityMax,
  );
}

/**
 * 计算模型预估耗材重量 (克)
 * 考虑到了 3D 打印的非实心特性 (根据 infillRatio 打折)
 */
export function calculateWeight(volume: number): number {
  return (
    (volume / 1000) * PRICING_CONFIG.plaDensity * PRICING_CONFIG.infillRatio
  );
}

/**
 * 计算网格模式的报价
 * 规则：与自定义托盘共享统一平板报价系数，最终统一向上取整
 */
export function calculateGridPrice(params: TrayParams): number {
  const slotCount = params.rows * params.columns;
  if (slotCount === 0) return 0;
  const { width, depth } = calculateTrayDimensions(params);
  const rawPrice = calculateFlatTrayRawPrice(slotCount, width * depth);
  return Math.ceil(rawPrice);
}

export function calculateCustomPrice(
  params: CustomLayoutParams,
  volume: number,
): number {
  if (volume <= 0 || params.slots.length === 0) return 0;

  const effective = calculateCustomEffectiveBaseplate(params);
  const footprintArea = effective.width * effective.depth;

  if (!effective.hasSlots || footprintArea <= 0) return 0;

  const rawPrice = calculateFlatTrayRawPrice(params.slots.length, footprintArea);
  return Math.ceil(rawPrice);
}

export function getSteppedPricingBreakdown(
  params: SteppedLayoutParams,
  volume: number,
): SteppedPricingBreakdown {
  const hasPrintableGeometry = volume > 0 && params.slots.length > 0;
  const effectiveDimensions = calculateSteppedEffectiveDimensions(params);
  const usedGroups = getUsedSteppedGroups(params);
  const heightLevels = new Set(usedGroups.map((group) => group.bottomHeight));
  const heightLevelCount = heightLevels.size;
  const { diameterTypeCount, slotCount40to59, slotCount60Plus } =
    getSteppedPricingCounts(params);
  const { hasWideSmoothing, hasDisconnectDistance } = getSteppedStructureFlags(
    params,
    usedGroups,
  );
  const materialDensityGPerCm3 = calculateSteppedMaterialDensity(
    slotCount40to59,
    slotCount60Plus,
  );

  if (!hasPrintableGeometry) {
    return {
      price: 0,
      rawPrice: 0,
      baseFee: 0,
      materialFee: 0,
      printFee: 0,
      footprintFee: 0,
      complexityFee: 0,
      estimatedWeight: 0,
      estimatedPrintHours: 0,
      materialDensityGPerCm3,
      effectiveWidth: effectiveDimensions.width,
      effectiveDepth: effectiveDimensions.depth,
      footprintAreaMm2: effectiveDimensions.width * effectiveDimensions.depth,
      heightLevelCount,
      diameterTypeCount,
      slotCount40to59,
      slotCount60Plus,
      hasWideSmoothing,
      hasDisconnectDistance,
    };
  }

  const estimatedWeight = (volume / 1000) * materialDensityGPerCm3;
  const estimatedPrintHours =
    STEPPED_PRICING_CONFIG.estimatedPrintBaseHours +
    estimatedWeight / STEPPED_PRICING_CONFIG.estimatedWeightPerHour +
    STEPPED_PRICING_CONFIG.estimatedPrintHeightLevelStep *
      Math.max(
        0,
        heightLevelCount - STEPPED_PRICING_CONFIG.estimatedPrintHeightLevelStart,
      ) -
    STEPPED_PRICING_CONFIG.estimatedPrintHugeSlotDiscountHours * slotCount60Plus;
  const complexityFee =
    STEPPED_PRICING_CONFIG.complexityHeightLevelFee *
      Math.max(0, heightLevelCount - 3) +
    STEPPED_PRICING_CONFIG.complexityDiameterTypeFee *
      Math.max(0, diameterTypeCount - 1) +
    STEPPED_PRICING_CONFIG.complexityLargeSlotFee * slotCount40to59 +
    STEPPED_PRICING_CONFIG.complexityHugeSlotFee * slotCount60Plus +
    (hasWideSmoothing
      ? STEPPED_PRICING_CONFIG.complexityWideSmoothingFee
      : 0) +
    (hasDisconnectDistance
      ? STEPPED_PRICING_CONFIG.complexityDisconnectFee
      : 0);
  const footprintAreaMm2 = effectiveDimensions.width * effectiveDimensions.depth;
  const materialFee =
    estimatedWeight * STEPPED_PRICING_CONFIG.materialRatePerGram;
  const printFee =
    estimatedPrintHours * STEPPED_PRICING_CONFIG.printRatePerHour;
  const footprintFee =
    footprintAreaMm2 / STEPPED_PRICING_CONFIG.footprintDivisor;
  const baseFee = STEPPED_PRICING_CONFIG.baseFee;
  const rawPrice =
    baseFee + materialFee + printFee + footprintFee + complexityFee;

  return {
    price: Math.round(rawPrice),
    rawPrice,
    baseFee,
    materialFee,
    printFee,
    footprintFee,
    complexityFee,
    estimatedWeight,
    estimatedPrintHours,
    materialDensityGPerCm3,
    effectiveWidth: effectiveDimensions.width,
    effectiveDepth: effectiveDimensions.depth,
    footprintAreaMm2,
    heightLevelCount,
    diameterTypeCount,
    slotCount40to59,
    slotCount60Plus,
    hasWideSmoothing,
    hasDisconnectDistance,
  };
}

export function calculateSteppedPrice(
  params: SteppedLayoutParams,
  volume: number,
): number {
  return getSteppedPricingBreakdown(params, volume).price;
}

export function calculateSimpleSteppedPrice(
  params: SimpleSteppedLayoutParams,
  volume: number,
): number {
  if (volume <= 0) return 0;
  const weight = calculateWeight(volume);
  return weight * 0.4;
}
