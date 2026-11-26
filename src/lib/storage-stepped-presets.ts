import type { IdFactory } from "@/lib/model-ports";
import {
  getStorageSteppedTray,
  replaceStorageSteppedTray,
  cloneStorageSteppedTrayConfig,
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
      columns: number;
      slotDefinitionId: string;
    }
  | {
      kind: "staggered";
      rows: number;
      columns: number;
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
 * 首版五个预设。
 *
 * 32 mm 十人交错布局为推导布局：按项目 32.4 mm 成品槽径与 5 mm 槽间距
 * 做六方交错排列，不等同于用户已验证托盘的实测坐标。
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
    label: "25 mm 十人双排",
    description: "两排各五个 25.4 mm 成品槽",
    source: "derived",
    layout: {
      kind: "grid",
      rows: 2,
      columns: 5,
      slotDefinitionId: "circle-25",
    },
  },
  {
    id: "circle-28.5-ten",
    label: "28.5 mm 十人双排",
    description: "两排各五个 28.9 mm 成品槽",
    source: "derived",
    layout: {
      kind: "grid",
      rows: 2,
      columns: 5,
      slotDefinitionId: "circle-28.5",
    },
  },
  {
    id: "circle-32-ten-staggered",
    label: "32 mm 十人交错双排",
    description: "两排各五个 32.4 mm 成品槽，六方交错；坐标由算法推导，未取得实测数据",
    source: "derived",
    layout: {
      kind: "staggered",
      rows: 2,
      columns: 5,
      slotDefinitionId: "circle-32",
    },
  },
  {
    id: "circle-40-five",
    label: "40 mm 五人单排",
    description: "单排五个 40.4 mm 成品槽",
    source: "derived",
    layout: {
      kind: "grid",
      rows: 1,
      columns: 5,
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
  const { rows, columns } = preset.layout;
  const points: CenterPoint[] = [];

  if (preset.layout.kind === "grid") {
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        points.push({
          x: column * pitch,
          y: row * pitch,
        });
      }
    }
  } else {
    // 六方交错：相邻两排水平错开半个节距，排距使对角槽仍保持槽间距。
    const rowPitch = (pitch * Math.sqrt(3)) / 2;
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        points.push({
          x: column * pitch + (row % 2) * (pitch / 2),
          y: row * rowPitch,
        });
      }
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
      fits: true,
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
): StorageSteppedPresetLayoutContext {
  const size = deriveStorageSteppedTraySize(params.interface);
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
    ...getStorageSteppedPresetLayoutContext(params),
    idFactory,
  });
  const next: StorageSteppedTrayConfig = {
    ...cloneStorageSteppedTrayConfig(tray),
    presetId: preset.id,
    slots,
  };
  return replaceStorageSteppedTray(params, next);
}
