import {
  BASE_HOLE_CONFIG,
  getBaseHoleMinBaseThickness,
  getBaseHolePreset,
} from "@/lib/config";
import {
  MAGNET_POST_HOLE_BOTTOM_WALL,
  resolveMagneticBaseHolePreset,
} from "@/lib/base-hole-config";
import type {
  BaseHoleParams,
  BaseHolePresetKey,
  BaseHoleStructure,
} from "@/types/tray";

export const MAGNETIC_BASE_HOLE_MIN_SIDE_WALL = 0.6;

export interface BaseHoleProjectedSlot {
  readonly id: string;
  readonly shape: "circle" | "ellipse" | "rectangle";
  readonly nominalWidth: number;
  readonly nominalHeight: number;
  readonly finalWidth: number;
  readonly finalHeight: number;
  readonly x: number;
  readonly y: number;
  readonly floorHeight: number;
  readonly containsExpandedHole: (radius: number) => boolean;
}

export interface BaseHoleFitViolation {
  readonly kind: "magnetic-base-hole-fit" | "magnet-post-hole-fit";
  readonly slotIds: readonly string[];
  readonly message: string;
}

export interface MagneticBaseHoleCutInstruction {
  readonly kind: "magnetic-base-hole";
  readonly slotId: string;
  readonly x: number;
  readonly y: number;
  readonly floorHeight: number;
  readonly preset: BaseHolePresetKey;
  readonly diameter: number;
  readonly depth: number;
  readonly topWall: number;
  readonly bottom: number;
  readonly top: number;
}

export interface MagnetPostHoleCutInstruction {
  readonly kind: "magnet-post-hole";
  readonly slotId: string;
  readonly x: number;
  readonly y: number;
  readonly floorHeight: number;
  readonly diameter: number;
  readonly depth: number;
  readonly bottom: number;
  readonly top: number;
}

export type BaseHoleCutInstruction =
  | MagneticBaseHoleCutInstruction
  | MagnetPostHoleCutInstruction;

export interface BaseHoleConstructionPlan {
  readonly structure: BaseHoleStructure;
  readonly supportingThickness: number;
  readonly instructions: readonly BaseHoleCutInstruction[];
  readonly resolvedMagneticPresets: readonly BaseHolePresetKey[];
  readonly violations: readonly BaseHoleFitViolation[];
  readonly blocked: boolean;
}

export function getRequiredBaseHoleSupportingThickness(
  params: Pick<BaseHoleParams, "baseHoleStructure" | "magnetPostHoleDepth">,
): number {
  if (params.baseHoleStructure === "magnetic-base-hole") {
    return Math.max(
      getBaseHoleMinBaseThickness("25"),
      getBaseHoleMinBaseThickness("40"),
    );
  }
  if (params.baseHoleStructure === "magnet-post-hole") {
    return params.magnetPostHoleDepth + MAGNET_POST_HOLE_BOTTOM_WALL;
  }
  return 0;
}

function cavityInterval(instruction: MagneticBaseHoleCutInstruction) {
  return { bottom: instruction.bottom, top: instruction.top };
}

function intervalsOverlap(
  left: { bottom: number; top: number },
  right: { bottom: number; top: number },
) {
  return left.bottom < right.top - 1e-6 && right.bottom < left.top - 1e-6;
}

function buildMagneticInstructions(
  slots: readonly BaseHoleProjectedSlot[],
): MagneticBaseHoleCutInstruction[] {
  return slots.map((slot) => {
    const preset = resolveMagneticBaseHolePreset(
      slot.shape,
      slot.nominalWidth,
      slot.nominalHeight,
    );
    const { diameter, depth } = getBaseHolePreset(preset);
    const top = slot.floorHeight - BASE_HOLE_CONFIG.topWall;
    return {
      kind: "magnetic-base-hole",
      slotId: slot.id,
      x: slot.x,
      y: slot.y,
      floorHeight: slot.floorHeight,
      preset,
      diameter,
      depth,
      topWall: BASE_HOLE_CONFIG.topWall,
      bottom: top - depth,
      top,
    };
  });
}

function validateMagneticInstructions(
  slots: readonly BaseHoleProjectedSlot[],
  instructions: readonly MagneticBaseHoleCutInstruction[],
): BaseHoleFitViolation[] {
  const slotById = new Map(slots.map((slot) => [slot.id, slot]));
  const violations: BaseHoleFitViolation[] = [];

  for (const instruction of instructions) {
    const slot = slotById.get(instruction.slotId)!;
    const radius = instruction.diameter / 2 + MAGNETIC_BASE_HOLE_MIN_SIDE_WALL;
    if (!slot.containsExpandedHole(radius)) {
      violations.push({
        kind: "magnetic-base-hole-fit",
        slotIds: [slot.id],
        message: `磁吸孔周围无法保留 ${MAGNETIC_BASE_HOLE_MIN_SIDE_WALL}mm 侧壁`,
      });
    }
  }

  for (let leftIndex = 0; leftIndex < instructions.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < instructions.length; rightIndex += 1) {
      const left = instructions[leftIndex];
      const right = instructions[rightIndex];
      if (!intervalsOverlap(cavityInterval(left), cavityInterval(right))) continue;
      const requiredDistance =
        left.diameter / 2 +
        right.diameter / 2 +
        MAGNETIC_BASE_HOLE_MIN_SIDE_WALL;
      if (Math.hypot(left.x - right.x, left.y - right.y) < requiredDistance - 1e-6) {
        violations.push({
          kind: "magnetic-base-hole-fit",
          slotIds: [left.slotId, right.slotId],
          message: `相邻磁吸孔之间无法保留 ${MAGNETIC_BASE_HOLE_MIN_SIDE_WALL}mm 隔墙`,
        });
      }
    }
  }
  return violations;
}

function buildPostInstructions(
  params: BaseHoleParams,
  slots: readonly BaseHoleProjectedSlot[],
): MagnetPostHoleCutInstruction[] {
  return slots.map((slot) => ({
    kind: "magnet-post-hole",
    slotId: slot.id,
    x: slot.x,
    y: slot.y,
    floorHeight: slot.floorHeight,
    diameter: params.magnetPostHoleDiameter,
    depth: params.magnetPostHoleDepth,
    bottom: slot.floorHeight - params.magnetPostHoleDepth,
    top: slot.floorHeight,
  }));
}

function validatePostInstructions(
  slots: readonly BaseHoleProjectedSlot[],
  instructions: readonly MagnetPostHoleCutInstruction[],
): BaseHoleFitViolation[] {
  const slotById = new Map(slots.map((slot) => [slot.id, slot]));
  return instructions.flatMap((instruction) => {
    const slot = slotById.get(instruction.slotId)!;
    const shortestSide = Math.min(slot.finalWidth, slot.finalHeight);
    return instruction.diameter > shortestSide + 1e-6
      ? [{
          kind: "magnet-post-hole-fit" as const,
          slotIds: [slot.id],
          message: `磁铁桩孔直径 ${instruction.diameter}mm 超过槽位最短成品尺寸 ${shortestSide.toFixed(1)}mm`,
        }]
      : [];
  });
}

export function createBaseHoleConstructionPlan(
  params: BaseHoleParams,
  slots: readonly BaseHoleProjectedSlot[],
): BaseHoleConstructionPlan {
  const supportingThickness = getRequiredBaseHoleSupportingThickness(params);
  if (params.baseHoleStructure === "none") {
    return {
      structure: "none",
      supportingThickness,
      instructions: [],
      resolvedMagneticPresets: [],
      violations: [],
      blocked: false,
    };
  }

  if (params.baseHoleStructure === "magnet-post-hole") {
    const instructions = buildPostInstructions(params, slots);
    const violations = validatePostInstructions(slots, instructions);
    return {
      structure: params.baseHoleStructure,
      supportingThickness,
      instructions,
      resolvedMagneticPresets: [],
      violations,
      blocked: violations.length > 0,
    };
  }

  const instructions = buildMagneticInstructions(slots);
  const violations = validateMagneticInstructions(slots, instructions);
  const resolvedMagneticPresets = [...new Set(
    instructions.map((instruction) => instruction.preset),
  )].sort();
  return {
    structure: params.baseHoleStructure,
    supportingThickness,
    instructions,
    resolvedMagneticPresets: resolvedMagneticPresets.length > 0
      ? resolvedMagneticPresets
      : [BASE_HOLE_CONFIG.defaultPreset],
    violations,
    blocked: violations.length > 0,
  };
}

export function getBaseHoleFitBlockingReason(
  violations: readonly BaseHoleFitViolation[],
): string | null {
  if (violations.length === 0) return null;
  const remaining = violations.length - 1;
  return `底板孔位不适配：${violations[0].message}${remaining > 0 ? `（另有 ${remaining} 项）` : ""}`;
}
