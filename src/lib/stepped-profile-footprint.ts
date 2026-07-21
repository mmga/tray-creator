/**
 * @deprecated 此模块已迁出为跨模式共用的 contoured-footprint.ts。
 * 请直接从 "@/lib/contoured-footprint" 导入；此处仅保留向后兼容 re-export。
 */
export {
  buildContouredClusterFootprint as buildSteppedClusterFootprint,
  type ContouredFootprintSlot as SteppedFootprintSlot,
} from "@/lib/contoured-footprint";
