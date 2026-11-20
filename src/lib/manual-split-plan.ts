import {
  cutSplitRegion, SPLIT_EPSILON, splitBounds, splitDistance, splitSegmentClear, type SplitPoint, type SplitRegion, type SplitRing,
} from "./manual-split-geometry";
import { isOrthogonalPath, mirrorSplitPoint, type SplitSymmetry } from "./manual-split-orthogonal";
import type { ModeParamSnapshot } from "./mode-param-snapshot";

export type FlatTraySnapshot = ModeParamSnapshot<"grid"> | ModeParamSnapshot<"custom">;

export interface ManualSplitCut {
  target: string;
  path: SplitRing;
  via?: [number, number];
  orthogonal?: true;
  symmetry?: SplitSymmetry;
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

export const MAX_MANUAL_SPLIT_CUTS = 128;
export const MAX_SPLIT_PATH_POINTS = 1024;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSplitPoint(value: unknown): value is SplitPoint {
  return Array.isArray(value) && value.length === 2 &&
    value.every((coordinate) => Number.isFinite(coordinate) && Math.abs(coordinate) <= 10000);
}

export function validateManualSplitSettings(value: unknown): asserts value is ManualSplitSettings {
  if (!isRecord(value) || typeof value.enabled !== "boolean" ||
      !Array.isArray(value.bed) || value.bed.length !== 3 ||
      typeof value.bedMargin !== "number" || typeof value.clearance !== "number" ||
      !isManualSplitBedValid(value as unknown as ManualSplitSettings) ||
      !Array.isArray(value.cuts) || value.cuts.length > MAX_MANUAL_SPLIT_CUTS) {
    throw new Error("拆件参数格式无效");
  }
  const targets = new Set<string>();
  for (const cut of value.cuts) {
    if (!isRecord(cut) || typeof cut.target !== "string" || !/^[1-9]\d{0,4}(?:\.[12]){0,128}$/.test(cut.target) ||
        targets.has(cut.target) || !Array.isArray(cut.path) || cut.path.length < 2 ||
        cut.path.length > MAX_SPLIT_PATH_POINTS || !cut.path.every(isSplitPoint) ||
        (cut.orthogonal !== undefined && (cut.orthogonal !== true || !isOrthogonalPath(cut.path))) ||
        (cut.via !== undefined && !isSplitPoint(cut.via))) {
      throw new Error("已保存的拆件切线格式无效");
    }
    targets.add(cut.target);
  }
  for (let i = 0; i < value.cuts.length; i++) {
    const { target, path, orthogonal, symmetry } = value.cuts[i] as ManualSplitCut;
    if (symmetry === undefined) continue;
    const pair = value.cuts[i + 1] as ManualSplitCut | undefined;
    if (!orthogonal || !isRecord(symmetry) ||
        !["left-right", "top-bottom", "rotate"].includes(symmetry.kind) || !isSplitPoint(symmetry.center) ||
        !pair?.orthogonal || pair.symmetry !== undefined || !isSplitChild(target, pair.target) ||
        pair.path.length !== path.length ||
        path.some((p, j) => splitDistance(mirrorSplitPoint(p, symmetry), pair.path[j]) > SPLIT_EPSILON)) {
      throw new Error("已保存的对称切线不成对，请检查拆件参数");
    }
  }
}

function isSplitChild(parent: string, child: string) {
  return child === parent + ".1" || child === parent + ".2";
}

function splitChildren(target: string, result: NonNullable<ReturnType<typeof cutSplitRegion>>): ManualSplitPart[] {
  return result.children.map((child, index) => ({ ...child, id: target + "." + (index + 1) }));
}

export function planOrthogonalSplit(region: ManualSplitPart, path: SplitRing, obstacles: SplitRing[], symmetry?: SplitSymmetry):
  { cuts: ManualSplitCut[]; parts: ManualSplitPart[]; issue?: string } {
  const first = path.length <= MAX_SPLIT_PATH_POINTS && isOrthogonalPath(path) && cutSplitRegion(region, path, obstacles);
  if (!first) return { cuts: [], parts: [], issue: "切线未能分开零件，请检查保护区、外边界或交叉线段。" };
  const parts = splitChildren(region.id, first);
  const cuts: ManualSplitCut[] = [{ target: region.id, path, orthogonal: true, ...(symmetry ? { symmetry } : {}) }];
  if (!symmetry) return { cuts, parts };
  const mirror = path.map((p) => mirrorSplitPoint(p, symmetry));
  if (mirror.slice(1).some((p, i) => !splitSegmentClear(mirror[i], p, region, obstacles))) {
    return { cuts: [], parts: [], issue: "对称线经过保护区或超出零件边界，请调整切线或关闭联动。" };
  }
  for (const part of parts) {
    const second = cutSplitRegion(part, mirror, obstacles);
    if (second) return {
      cuts: [...cuts, { target: part.id, path: mirror, orthogonal: true }],
      parts: [...parts.filter(({ id }) => id !== part.id), ...splitChildren(part.id, second)],
    };
  }
  return { cuts: [], parts: [], issue: "对称线未能分开零件。请检查外边界，以及两条线是否交叉或重合。" };
}

export function splitOperationStart(cuts: ManualSplitCut[], index: number) {
  return index > 0 && cuts[index - 1].symmetry ? index - 1 : index;
}

export function manualCutsToRemove(cuts: ManualSplitCut[], target: string) {
  const index = splitOperationStart(cuts, cuts.findIndex((cut) => cut.target === target));
  if (index < 0) return [];
  const root = cuts[index].target;
  return cuts.filter((cut) => cut.target === root || cut.target.startsWith(root + "."));
}

export function replayManualCuts(scene: ManualSplitScene, cuts: ManualSplitCut[]) {
  const parts = new Map(scene.roots.map((part) => [part.id, part]));
  const invalid = new Map<string, "boundary" | "dependency">();
  for (let i = 0; i < cuts.length; i++) {
    const cut = cuts[i];
    const pair = cut.symmetry ? cuts[++i] : undefined;
    const target = parts.get(cut.target);
    if ([...invalid.keys()].some((id) => cut.target.startsWith(id + "."))) {
      invalid.set(cut.target, "dependency");
      if (pair) invalid.set(pair.target, "dependency");
      continue;
    }
    const result = target && cutSplitRegion(target, cut.path, scene.obstacles);
    if (!result) {
      invalid.set(cut.target, "boundary");
      if (pair) invalid.set(pair.target, "dependency");
      continue;
    }
    const children = splitChildren(cut.target, result);
    if (cut.symmetry) {
      const secondary = children.find(({ id }) => id === pair?.target);
      const second = secondary && pair && cutSplitRegion(secondary, pair.path, scene.obstacles);
      if (!second || !pair) {
        invalid.set(cut.target, "boundary");
        if (pair) invalid.set(pair.target, "boundary");
        continue;
      }
      children.splice(children.findIndex(({ id }) => id === pair.target), 1);
      children.push(...splitChildren(pair.target, second));
    }
    parts.delete(cut.target);
    children.forEach((child) => parts.set(child.id, child));
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
