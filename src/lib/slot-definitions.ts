import type { FreeSlot } from "@/types/custom-tray";

export type SlotDefinitionId = string;

export interface CircleSlotDefinition {
  id: SlotDefinitionId;
  shape: "circle";
  name: string;
  baseDiameter: number;
  slotDiameter: number;
  tolerance: number;
}

export interface EllipseSlotDefinition {
  id: SlotDefinitionId;
  shape: "ellipse";
  name: string;
  width: number;
  height: number;
  outerOffset: number;
  profileExponent: number;
}

export type SlotDefinition = CircleSlotDefinition | EllipseSlotDefinition;

/** 未匹配到具体预设时使用；各预设仍可独立配置加工容差。 */
export const DEFAULT_CIRCLE_SLOT_TOLERANCE = 0.4;
/** 未匹配到具体预设时使用；各椭圆预设仍可独立配置法线外扩量。 */
export const DEFAULT_ELLIPSE_OUTER_OFFSET = 0.2;
export const DEFAULT_ELLIPSE_PROFILE_EXPONENT = 2.6;

export const CIRCLE_SLOT_DEFINITIONS: CircleSlotDefinition[] = [
  { id: "circle-10", shape: "circle", name: "10mm 圆形", baseDiameter: 10, slotDiameter: 10.4, tolerance: 0.4 },
  { id: "circle-25", shape: "circle", name: "小型步兵 (25mm)", baseDiameter: 25, slotDiameter: 25.4, tolerance: 0.4 },
  { id: "circle-28.5", shape: "circle", name: "中型步兵 (28.5mm)", baseDiameter: 28.5, slotDiameter: 28.9, tolerance: 0.4 },
  { id: "circle-32", shape: "circle", name: "标准步兵 (32mm)", baseDiameter: 32, slotDiameter: 32.4, tolerance: 0.4 },
  { id: "circle-40", shape: "circle", name: "大型 (40mm)", baseDiameter: 40, slotDiameter: 40.4, tolerance: 0.4 },
  { id: "circle-50", shape: "circle", name: "超大型 (50mm)", baseDiameter: 50, slotDiameter: 50.4, tolerance: 0.4 },
  { id: "circle-60", shape: "circle", name: "巨型 (60mm)", baseDiameter: 60, slotDiameter: 60.4, tolerance: 0.4 },
  { id: "circle-65", shape: "circle", name: "狮王 (65mm)", baseDiameter: 65, slotDiameter: 65.4, tolerance: 0.4 },
  { id: "circle-90", shape: "circle", name: "无畏 (90mm)", baseDiameter: 90, slotDiameter: 90.4, tolerance: 0.4 },
  { id: "circle-100", shape: "circle", name: "100mm 圆形", baseDiameter: 100, slotDiameter: 100.4, tolerance: 0.4 },
];

export const ELLIPSE_SLOT_DEFINITIONS: EllipseSlotDefinition[] = [
  {
    id: "ellipse-60x35.5",
    shape: "ellipse",
    name: "60x35.5mm",
    width: 60,
    height: 35.5,
    outerOffset: 0.2,
    profileExponent: 2.05,
  },
  {
    id: "ellipse-75x42",
    shape: "ellipse",
    name: "75x42mm",
    width: 75,
    height: 43.2,
    outerOffset: 0.4,
    profileExponent: 2.08,
  },
  {
    id: "ellipse-90x52",
    shape: "ellipse",
    name: "90x52mm",
    width: 90,
    height: 52,
    outerOffset: 0.2,
    profileExponent: DEFAULT_ELLIPSE_PROFILE_EXPONENT,
  },
  {
    id: "ellipse-105x70",
    shape: "ellipse",
    name: "105x70mm",
    width: 105,
    height: 70,
    outerOffset: 0.2,
    profileExponent: DEFAULT_ELLIPSE_PROFILE_EXPONENT,
  },
  {
    id: "ellipse-120x92",
    shape: "ellipse",
    name: "120x92mm",
    width: 120,
    height: 92,
    outerOffset: 0.2,
    profileExponent: DEFAULT_ELLIPSE_PROFILE_EXPONENT,
  },
  {
    id: "ellipse-150x95",
    shape: "ellipse",
    name: "150x95mm",
    width: 150,
    height: 95,
    outerOffset: 0.2,
    profileExponent: DEFAULT_ELLIPSE_PROFILE_EXPONENT,
  },
  {
    id: "ellipse-170x105",
    shape: "ellipse",
    name: "170x105mm",
    width: 170,
    height: 105,
    outerOffset: 0.2,
    profileExponent: DEFAULT_ELLIPSE_PROFILE_EXPONENT,
  },
];

export const SLOT_DEFINITIONS: SlotDefinition[] = [
  ...CIRCLE_SLOT_DEFINITIONS,
  ...ELLIPSE_SLOT_DEFINITIONS,
];

function nearlyEqual(left: number, right: number) {
  return Math.abs(left - right) < 0.001;
}

export function findCircleSlotDefinitionByBaseDiameter(
  baseDiameter: number,
) {
  return CIRCLE_SLOT_DEFINITIONS.find((definition) =>
    nearlyEqual(definition.baseDiameter, baseDiameter),
  );
}

export function findCircleSlotDefinitionById(id: string | undefined) {
  return CIRCLE_SLOT_DEFINITIONS.find((definition) => definition.id === id);
}

export function findEllipseSlotDefinitionByGeometry(geometry: {
  width: number;
  height: number;
  outerOffset: number;
  profileExponent: number;
}) {
  return ELLIPSE_SLOT_DEFINITIONS.find(
    (definition) =>
      nearlyEqual(definition.width, geometry.width) &&
      nearlyEqual(definition.height, geometry.height) &&
      nearlyEqual(definition.outerOffset, geometry.outerOffset) &&
      nearlyEqual(definition.profileExponent, geometry.profileExponent),
  );
}

export function getLegacyCircleSlotDiameter(baseDiameter: number) {
  const definition = findCircleSlotDefinitionByBaseDiameter(baseDiameter);
  return definition?.slotDiameter ?? baseDiameter + DEFAULT_CIRCLE_SLOT_TOLERANCE;
}

export function createCircleSlotSnapshot(baseDiameter: number) {
  const definition = findCircleSlotDefinitionByBaseDiameter(baseDiameter);
  const slotDiameter = definition?.slotDiameter ?? getLegacyCircleSlotDiameter(baseDiameter);
  return {
    ...(definition ? { slotDefinitionId: definition.id } : {}),
    slotWidth: slotDiameter,
    slotHeight: slotDiameter,
  };
}

export function createGridSlotSnapshot(baseDiameter: number) {
  const definition = findCircleSlotDefinitionByBaseDiameter(baseDiameter);
  return {
    ...(definition ? { slotDefinitionId: definition.id } : {}),
    slotDiameter: definition?.slotDiameter ?? getLegacyCircleSlotDiameter(baseDiameter),
  };
}

export function createEllipseSlotSnapshot(definition: EllipseSlotDefinition) {
  return {
    slotDefinitionId: definition.id,
    outerOffset: definition.outerOffset,
    profileExponent: definition.profileExponent,
  };
}

export function getFreeSlotProfileGeometry(
  slot: Pick<
    FreeSlot,
    | "shape"
    | "width"
    | "height"
    | "slotWidth"
    | "slotHeight"
    | "outerOffset"
    | "profileExponent"
  >,
) {
  if (slot.shape === "circle") {
    const diameter =
      typeof slot.slotWidth === "number" && Number.isFinite(slot.slotWidth)
        ? slot.slotWidth
        : getLegacyCircleSlotDiameter(slot.width);
    return {
      width: diameter,
      height: diameter,
      outerOffset: 0,
      profileExponent: undefined,
    };
  }

  return {
    width: slot.width,
    height: slot.height,
    outerOffset:
      typeof slot.outerOffset === "number" && Number.isFinite(slot.outerOffset)
        ? slot.outerOffset
        : DEFAULT_ELLIPSE_OUTER_OFFSET,
    profileExponent:
      typeof slot.profileExponent === "number" &&
      Number.isFinite(slot.profileExponent)
        ? slot.profileExponent
        : DEFAULT_ELLIPSE_PROFILE_EXPONENT,
  };
}
