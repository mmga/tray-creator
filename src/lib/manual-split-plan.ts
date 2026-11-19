import {
  cutSplitRegion, splitBounds, type SplitRegion, type SplitRing,
} from "./manual-split-geometry";

export interface ManualSplitCut {
  target: string;
  path: SplitRing;
  via?: [number, number];
}

export interface ManualSplitSettings {
  enabled: boolean;
  bed: [number, number, number];
  bedMargin: number;
  clearance: number;
  cuts: ManualSplitCut[];
}

export interface ManualSplitPart extends SplitRegion {
  id: string;
}

export interface ManualSplitScene {
  roots: ManualSplitPart[];
  obstacles: SplitRing[];
  grooves: SplitRing[];
  height: number;
}

export const MANUAL_SPLIT_DEFAULTS: ManualSplitSettings = {
  enabled: false,
  bed: [220, 220, 250],
  bedMargin: 3,
  clearance: 2,
  cuts: [],
};

export function replayManualCuts(scene: ManualSplitScene, cuts: ManualSplitCut[]) {
  const parts = new Map(scene.roots.map((part) => [part.id, part]));
  const invalid = new Map<string, "boundary" | "dependency">();
  for (const cut of cuts) {
    const target = parts.get(cut.target);
    if ([...invalid.keys()].some((id) => cut.target.startsWith(id + "."))) {
      invalid.set(cut.target, "dependency");
      continue;
    }
    const result = target && cutSplitRegion(target, cut.path, scene.obstacles);
    if (!result) {
      invalid.set(cut.target, "boundary");
      continue;
    }
    parts.delete(cut.target);
    result.children.forEach((child, index) => {
      const id = cut.target + "." + (index + 1);
      parts.set(id, { ...child, id });
    });
  }
  return { parts: [...parts.values()], invalid };
}

export function splitPartSize(part: SplitRegion, height: number): [number, number, number] {
  const { min, max } = splitBounds(part.outer);
  return [max[0] - min[0], max[1] - min[1], height];
}

export function splitPrintRotation(
  [width, depth, height]: ManualSplitSettings["bed"],
  { bed, bedMargin }: ManualSplitSettings,
): 0 | 90 | null {
  const usableWidth = bed[0] - bedMargin * 2;
  const usableDepth = bed[1] - bedMargin * 2;
  if (height > bed[2] + 0.0001) return null;
  if (width <= usableWidth + 0.0001 && depth <= usableDepth + 0.0001) return 0;
  if (depth <= usableWidth + 0.0001 && width <= usableDepth + 0.0001) return 90;
  return null;
}

export function isManualSplitBedValid({ bed, bedMargin, clearance }: ManualSplitSettings) {
  return bed.every((value) => Number.isFinite(value) && value > 0) &&
    Number.isFinite(bedMargin) && bedMargin >= 0 && bedMargin * 2 < Math.min(bed[0], bed[1]) &&
    Number.isFinite(clearance) && clearance >= 0;
}
