import type {
  FreeSlot,
  SteppedSlot,
} from "@/types/custom-tray";
import type { TrayParams } from "@/types/tray";
import {
  DEFAULT_ELLIPSE_OUTER_OFFSET,
  DEFAULT_ELLIPSE_PROFILE_EXPONENT,
  createCircleSlotSnapshot,
  createGridSlotSnapshot,
  findEllipseSlotDefinitionByGeometry,
} from "@/lib/slot-definitions";

export interface EllipseSlotInstanceConfig {
  outerOffset?: number;
  profileExponent?: number;
  slotDefinitionId?: string;
}

export interface CircleSlotInstanceConfig {
  /** 手动输入直径时保留原始尺寸，不追加预设加工容差。 */
  applyTolerance?: boolean;
}

export interface CreateFreeSlotInstanceOptions {
  id: string;
  x: number;
  y: number;
  width: number;
  height?: number;
  rotation?: number;
  circleConfig?: CircleSlotInstanceConfig;
  ellipseConfig?: EllipseSlotInstanceConfig;
}

export interface CreateSteppedSlotInstanceOptions {
  id: string;
  x: number;
  y: number;
  width: number;
  height?: number;
  rotation?: number;
  ellipseConfig?: EllipseSlotInstanceConfig;
  groupId: string;
}

function normalizeRotation(rotation: number) {
  return (((rotation % 360) + 360) % 360);
}

export function createGridSlotSnapshotFromDefinition(
  baseDiameter: number,
): Pick<TrayParams, "slotDefinitionId"> & { slotDiameter: number } {
  return createGridSlotSnapshot(baseDiameter);
}

export function createFreeSlotInstance({
  id,
  x,
  y,
  width,
  height,
  rotation = 0,
  circleConfig,
  ellipseConfig,
}: CreateFreeSlotInstanceOptions): FreeSlot {
  const slotHeight = height ?? width;
  const isCircle = width === slotHeight;

  if (isCircle) {
    return {
      id,
      x,
      y,
      shape: "circle",
      width,
      height: slotHeight,
      ...(circleConfig?.applyTolerance === false
        ? { slotWidth: width, slotHeight }
        : createCircleSlotSnapshot(width)),
      rotation: normalizeRotation(rotation),
    };
  }

  const outerOffset =
    ellipseConfig?.outerOffset ?? DEFAULT_ELLIPSE_OUTER_OFFSET;
  const profileExponent =
    ellipseConfig?.profileExponent ?? DEFAULT_ELLIPSE_PROFILE_EXPONENT;
  const matchedDefinition = findEllipseSlotDefinitionByGeometry({
    width,
    height: slotHeight,
    outerOffset,
    profileExponent,
  });

  return {
    id,
    x,
    y,
    shape: "ellipse",
    width,
    height: slotHeight,
    rotation: normalizeRotation(rotation),
    outerOffset,
    profileExponent,
    slotDefinitionId:
      ellipseConfig?.slotDefinitionId ?? matchedDefinition?.id,
  };
}

export function createSteppedSlotInstance({
  id,
  x,
  y,
  width,
  height,
  rotation = 0,
  ellipseConfig,
  groupId,
}: CreateSteppedSlotInstanceOptions): SteppedSlot {
  return {
    ...createFreeSlotInstance({
      id,
      x,
      y,
      width,
      height,
      rotation,
      ellipseConfig,
    }),
    groupId,
  };
}

export function normalizeFreeSlotInstanceSnapshot(slot: FreeSlot): FreeSlot {
  const rotation = normalizeRotation(slot.rotation);

  if (slot.shape === "ellipse") {
    const outerOffset =
      typeof slot.outerOffset === "number" && Number.isFinite(slot.outerOffset)
        ? slot.outerOffset
        : DEFAULT_ELLIPSE_OUTER_OFFSET;
    const profileExponent =
      typeof slot.profileExponent === "number" &&
      Number.isFinite(slot.profileExponent)
        ? slot.profileExponent
        : DEFAULT_ELLIPSE_PROFILE_EXPONENT;
    const matchedDefinition = findEllipseSlotDefinitionByGeometry({
      width: slot.width,
      height: slot.height,
      outerOffset,
      profileExponent,
    });

    return {
      id: slot.id,
      x: slot.x,
      y: slot.y,
      shape: "ellipse",
      width: slot.width,
      height: slot.height,
      rotation,
      outerOffset,
      profileExponent,
      ...(matchedDefinition
        ? { slotDefinitionId: matchedDefinition.id }
        : typeof slot.slotDefinitionId === "string"
          ? { slotDefinitionId: slot.slotDefinitionId }
          : {}),
    };
  }

  const snapshot = createCircleSlotSnapshot(slot.width);
  return {
    id: slot.id,
    x: slot.x,
    y: slot.y,
    shape: "circle",
    width: slot.width,
    height: slot.height,
    rotation,
    ...(snapshot.slotDefinitionId
      ? { slotDefinitionId: snapshot.slotDefinitionId }
      : typeof slot.slotDefinitionId === "string"
        ? { slotDefinitionId: slot.slotDefinitionId }
        : {}),
    slotWidth:
      typeof slot.slotWidth === "number" && Number.isFinite(slot.slotWidth)
        ? slot.slotWidth
        : snapshot.slotWidth,
    slotHeight:
      typeof slot.slotHeight === "number" && Number.isFinite(slot.slotHeight)
        ? slot.slotHeight
        : snapshot.slotHeight,
  };
}
