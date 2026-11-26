import type { IdFactory } from "@/lib/model-ports";
import {
  getStorageSteppedTray,
  replaceStorageSteppedTray,
  cloneStorageSteppedTrayConfig,
  STORAGE_STEPPED_LIMITS,
} from "@/lib/storage-stepped-config";
import { deriveStorageSteppedTraySize } from "@/lib/storage-stepped-plan";
import type { FreeSlot } from "@/types/custom-tray";
import type {
  StorageSteppedParams,
  StorageSteppedTrayConfig,
} from "@/types/storage-stepped";
import {
  CIRCLE_SLOT_DEFINITIONS,
  getFreeSlotProfileGeometry,
} from "@/lib/slot-definitions";

export type StorageSteppedPresetLayout =
  | { kind: "flat" }
  | {
      kind: "grid";
      rows: number;
      slotDefinitionId: string;
    }
  | {
      kind: "staggered";
      rows: number;
      slotDefinitionId: string;
    };

export interface StorageSteppedTrayPreset {
  id: string;
  label: string;
  description: string;
  /** measured：来自用户实测；derived：按项目槽位定义推导；fixed：产品固定布局 */
  source: "fixed" | "derived" | "measured";
  layout: StorageSteppedPresetLayout;
}

/**
 * 托盘槽位预设。
 *
 * 每种排列固定排数，槽数按当前托盘的可用空间计算。
 * 预设 ID 保留，用于识别旧文件中已经保存的槽位快照。
 */
export const STORAGE_STEPPED_TRAY_PRESETS: StorageSteppedTrayPreset[] = [
  {
    id: "flat",
    label: "平板",
    description: "无槽位，用作纯平展示或自定义起点",
    source: "fixed",
    layout: { kind: "flat" },
  },
  {
    id: "circle-25-ten",
    label: "25 mm 双排",
    description: "两排 25.4 mm 成品槽，按可用宽度排满",
    source: "derived",
    layout: {
      kind: "grid",
      rows: 2,
      slotDefinitionId: "circle-25",
    },
  },
  {
    id: "circle-28.5-ten",
    label: "28.5 mm 双排",
    description: "两排 28.9 mm 成品槽，按可用宽度排满",
    source: "derived",
    layout: {
      kind: "grid",
      rows: 2,
      slotDefinitionId: "circle-28.5",
    },
  },
  {
    id: "circle-32-ten-staggered",
    label: "32 mm 交错双排",
    description: "两排 32.4 mm 成品槽，按可用空间调整交错距离",
    source: "derived",
    layout: {
      kind: "staggered",
      rows: 2,
      slotDefinitionId: "circle-32",
    },
  },
  {
    id: "circle-32-five",
    label: "32 mm 单排",
    description: "单排 32.4 mm 成品槽，适合 60 mm 浅阶",
    source: "derived",
    layout: {
      kind: "grid",
      rows: 1,
      slotDefinitionId: "circle-32",
    },
  },
  {
    id: "circle-40-five",
    label: "40 mm 单排",
    description: "单排 40.4 mm 成品槽，按可用宽度排满",
    source: "derived",
    layout: {
      kind: "grid",
      rows: 1,
      slotDefinitionId: "circle-40",
    },
  },
];

export const STORAGE_STEPPED_CUSTOM_PRESET_ID = "custom";

export function findStorageSteppedTrayPreset(
  presetId: string,
): StorageSteppedTrayPreset | undefined {
  return STORAGE_STEPPED_TRAY_PRESETS.find((preset) => preset.id === presetId);
}

function getPresetSlotDefinition(slotDefinitionId: string) {
  const definition = CIRCLE_SLOT_DEFINITIONS.find(
    (candidate) => candidate.id === slotDefinitionId,
  );
  if (!definition) {
    throw new Error(`未知槽位定义：${slotDefinitionId}`);
  }
  return definition;
}

export interface StorageSteppedPresetLayoutOptions {
  trayWidth: number;
  trayDepth: number;
  spacing: number;
  boundarySpacing: number;
  idFactory: IdFactory;
}

interface CenterPoint {
  x: number;
  y: number;
}

function centerLayout(
  points: CenterPoint[],
  diameter: number,
  trayWidth: number,
  trayDepth: number,
): CenterPoint[] {
  if (points.length === 0) return [];
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point.x - diameter / 2);
    maxX = Math.max(maxX, point.x + diameter / 2);
    minY = Math.min(minY, point.y - diameter / 2);
    maxY = Math.max(maxY, point.y + diameter / 2);
  }
  const offsetX = (trayWidth - (maxX - minX)) / 2 - minX;
  const offsetY = (trayDepth - (maxY - minY)) / 2 - minY;
  return points.map((point) => ({
    x: point.x + offsetX,
    y: point.y + offsetY,
  }));
}

/**
 * 按预设生成槽位快照。
 *
 * 槽径来自项目 Slot Definition 的成品尺寸（已含公差），不重复叠加对话示例中的 0.6 mm。
 * 生成坐标按整组外接框居中；不因放不下而缩放槽径。
 */
export function createStorageSteppedPresetSlots(
  preset: StorageSteppedTrayPreset,
  options: StorageSteppedPresetLayoutOptions,
): FreeSlot[] {
  if (preset.layout.kind === "flat") return [];

  const definition = getPresetSlotDefinition(preset.layout.slotDefinitionId);
  // 成品槽径来自 Slot Definition，已含加工公差；width 保留名义底盘尺寸。
  const diameter = definition.slotDiameter;
  const pitch = diameter + options.spacing;
  const { rows, kind } = preset.layout;
  const width = options.trayWidth - 2 * options.boundarySpacing;
  const depth = options.trayDepth - 2 * options.boundarySpacing;
  // 预设适用于面板的制造尺寸范围，防止超大导入尺寸触发无界槽位分配。
  const epsilon = 1e-6;
  if (!Number.isFinite(width) || !Number.isFinite(depth) ||
      !Number.isFinite(pitch) || pitch < diameter || options.boundarySpacing < 0 ||
      width > STORAGE_STEPPED_LIMITS.bodyWidth.max) return [];

  const columnsAtOffset = (offset: number) =>
    Math.floor((width - diameter - offset + epsilon) / pitch) + 1;
  const fullRowCount = columnsAtOffset(0);
  if (fullRowCount < 1) return [];

  let shift = 0;
  let rowPitch = pitch;
  if (kind === "staggered") {
    // 先尝试用横向余量错开两排满槽；深度不足时用半节距交错。
    const spare = width - diameter - (fullRowCount - 1) * pitch;
    const fullRowShift = Math.min(pitch / 2, spare);
    const pitchWithFullRows = Math.sqrt(pitch ** 2 - fullRowShift ** 2);
    if (fullRowShift > epsilon && diameter + (rows - 1) * pitchWithFullRows <= depth + epsilon) {
      shift = fullRowShift;
      rowPitch = pitchWithFullRows;
    } else {
      shift = pitch / 2;
      rowPitch = pitch * Math.sqrt(3) / 2;
    }
  }
  if (depth + epsilon < diameter + (rows - 1) * rowPitch) return [];

  const points: CenterPoint[] = [];
  for (let row = 0; row < rows; row += 1) {
    const offset = row % 2 === 1 ? shift : 0;
    const columns = columnsAtOffset(offset);
    if (columns < 1) return [];
    for (let column = 0; column < columns; column += 1) {
      points.push({ x: offset + column * pitch, y: row * rowPitch });
    }
  }

  const centered = centerLayout(
    points,
    diameter,
    options.trayWidth,
    options.trayDepth,
  );
  return centered.map((point) => ({
    id: options.idFactory.createId(),
    x: point.x,
    y: point.y,
    shape: "circle" as const,
    width: definition.baseDiameter,
    height: definition.baseDiameter,
    rotation: 0,
    slotDefinitionId: definition.id,
    slotWidth: definition.slotDiameter,
    slotHeight: definition.slotDiameter,
  }));
}

export interface StorageSteppedPresetFitReport {
  presetId: string;
  slotCount: number;
  layoutWidth: number;
  layoutDepth: number;
  /** 最小槽间距（成品槽边缘距离） */
  minimumSpacing: number;
  fits: boolean;
}

/**
 * 预设落位报告：给出完整槽形边界、槽间距离与是否落在固定托盘内。
 * 由算法输出，供测试与界面说明使用，不替代完整参数校验。
 */
export function getStorageSteppedPresetFitReport(
  preset: StorageSteppedTrayPreset,
  options: Omit<StorageSteppedPresetLayoutOptions, "idFactory">,
): StorageSteppedPresetFitReport {
  let counter = 0;
  const slots = createStorageSteppedPresetSlots(preset, {
    ...options,
    idFactory: { createId: () => `preset-slot-${counter++}` },
  });
  if (slots.length === 0) {
    return {
      presetId: preset.id,
      slotCount: 0,
      layoutWidth: 0,
      layoutDepth: 0,
      minimumSpacing: Number.POSITIVE_INFINITY,
      fits: preset.layout.kind === "flat",
    };
  }
  const diameter = getFreeSlotProfileGeometry(slots[0]).width;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const slot of slots) {
    minX = Math.min(minX, slot.x - diameter / 2);
    maxX = Math.max(maxX, slot.x + diameter / 2);
    minY = Math.min(minY, slot.y - diameter / 2);
    maxY = Math.max(maxY, slot.y + diameter / 2);
  }
  let minimumSpacing = Number.POSITIVE_INFINITY;
  for (let left = 0; left < slots.length; left += 1) {
    for (let right = left + 1; right < slots.length; right += 1) {
      const centerDistance = Math.hypot(
        slots[left].x - slots[right].x,
        slots[left].y - slots[right].y,
      );
      minimumSpacing = Math.min(minimumSpacing, centerDistance - diameter);
    }
  }
  const layoutWidth = maxX - minX;
  const layoutDepth = maxY - minY;
  return {
    presetId: preset.id,
    slotCount: slots.length,
    layoutWidth,
    layoutDepth,
    minimumSpacing,
    fits:
      layoutWidth <= options.trayWidth - 2 * options.boundarySpacing + 1e-6 &&
      layoutDepth <= options.trayDepth - 2 * options.boundarySpacing + 1e-6 &&
      minimumSpacing >= options.spacing - 1e-6,
  };
}

export interface StorageSteppedPresetLayoutContext {
  trayWidth: number;
  trayDepth: number;
  spacing: number;
  boundarySpacing: number;
}

export function getStorageSteppedPresetLayoutContext(
  params: StorageSteppedParams,
  stepIndex = 0,
): StorageSteppedPresetLayoutContext {
  const size = deriveStorageSteppedTraySize(params.interface, stepIndex);
  return {
    trayWidth: size.width,
    trayDepth: size.depth,
    spacing: params.slotSpacing,
    boundarySpacing: params.slotBoundarySpacing,
  };
}

/**
 * 切换某一阶托盘的预设。保留槽深与底孔配置，只替换槽位布局。
 */
export function applyStorageSteppedTrayPreset(
  params: StorageSteppedParams,
  stepIndex: number,
  presetId: string,
  idFactory: IdFactory,
): StorageSteppedParams {
  const preset = findStorageSteppedTrayPreset(presetId);
  if (!preset) throw new Error(`未知托盘预设：${presetId}`);
  const tray = getStorageSteppedTray(params, stepIndex);
  if (!tray) throw new Error(`找不到第 ${stepIndex + 1} 阶托盘配置`);

  const slots = createStorageSteppedPresetSlots(preset, {
    ...getStorageSteppedPresetLayoutContext(params, stepIndex),
    idFactory,
  });
  if (preset.layout.kind !== "flat" && slots.length === 0) return params;
  const next: StorageSteppedTrayConfig = {
    ...cloneStorageSteppedTrayConfig(tray),
    presetId: preset.id,
    slots,
  };
  return replaceStorageSteppedTray(params, next);
}
