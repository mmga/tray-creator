import { makeCylinder, makePolygon, measureDistanceBetween, measureVolume, type Shape3D } from "replicad";
import { prepareGridTrayCutSource } from "@/lib/tray-model";
import { prepareCustomTrayCutSource } from "@/lib/custom-tray-model";
import { createManualSplitScene, extendSplitMaskPastTrayEdge } from "@/lib/manual-split-cad";
import { replayManualCuts, splitPrintRotation, validateManualSplitSettings, type FlatTraySnapshot } from "@/lib/manual-split-plan";
import type { SplitPoint } from "@/lib/manual-split-geometry";
import { drawStepPolygon, extrudeStepProfile, realizeStepBody, realizeStepGroove, validateStepSolid, type prepareStepConstruction } from "./step-realization";

type StepConstruction = ReturnType<typeof prepareStepConstruction>;
type Bounds = ReturnType<typeof validateStepSolid>["bounds"];

function verifyClearance(plan: StepConstruction, paths: SplitPoint[][], clearance: number, bottom: number, top: number) {
  if (!paths.length) return;
  const blank = plan.half ? realizeStepBody(plan) : undefined;
  const obstacles: { shape: Shape3D; bounds: Bounds }[] = [];
  function add(shape: Shape3D) {
    const box = shape.boundingBox;
    try { obstacles.push({ shape, bounds: box.bounds }); }
    catch (error) { shape.delete(); throw error; }
    finally { box.delete(); }
  }
  try {
    for (const groove of plan.grooves) {
      const cutter = realizeStepGroove(groove);
      if (!blank) add(cutter);
      else {
        try {
          const clipped = blank.intersect(cutter, { simplify: false });
          if (measureVolume(clipped) > 0) add(clipped);
          else clipped.delete();
        } finally { cutter.delete(); }
      }
    }
    for (const { x, y, bottom, top, diameter } of plan.baseHoles.instructions) {
      add(makeCylinder(diameter / 2, top - bottom, [x, y, bottom], [0, 0, 1]));
    }
    for (const path of paths) {
      for (let i = 1; i < path.length; i++) {
        const [a, b] = [path[i - 1], path[i]];
        const candidates = obstacles.filter(({ bounds: [min, max] }) => [0, 1].every((axis) =>
          Math.max(a[axis], b[axis]) + clearance >= min[axis] &&
          Math.min(a[axis], b[axis]) - clearance <= max[axis]));
        if (!candidates.length) continue;
        const face = makePolygon([[...a, bottom], [...b, bottom], [...b, top], [...a, top]]);
        try {
          for (const { shape } of candidates) {
            const distance = measureDistanceBetween(face, shape);
            if (!Number.isFinite(distance) || distance <= Math.max(clearance, 0.000001)) {
              throw new Error("分割线与 STEP 实体的凹槽或底孔距离不足，请调整切线");
            }
          }
        } finally { face.delete(); }
      }
    }
  } finally {
    blank?.delete();
    obstacles.forEach(({ shape }) => shape.delete());
  }
}

export function realizeStepParts(shape: Shape3D, snapshot: FlatTraySnapshot, plan: StepConstruction) {
  const settings = snapshot.params.manualSplit;
  validateManualSplitSettings(settings);
  if (!settings.enabled || plan.box.enabled) throw new Error("请对普通托盘启用拆件打印");
  const source = snapshot.mode === "grid" ? prepareGridTrayCutSource(snapshot.params)
    : prepareCustomTrayCutSource(snapshot.params, plan.contoured);
  const scene = createManualSplitScene(source, settings.clearance);
  const { parts, invalid } = replayManualCuts(scene, settings.cuts);
  if (invalid.size || parts.length < 2) throw new Error(invalid.size ? "分割线已失效，请回到二维编辑检查" : "请先确认分割线");
  const whole = validateStepSolid(shape, "整件托盘");
  const bottom = whole.bounds[0][2] - 1;
  const top = whole.bounds[1][2] + 1;
  verifyClearance(plan, settings.cuts.map(({ path }) => path), settings.clearance, bottom, top);
  const tolerance = Math.max(0.01, whole.volume * 1e-6);
  const realized: { shape: Shape3D; id: string; bounds: Bounds; volume: number; rotation: 0 | 90 }[] = [];
  try {
    for (const { id, outer } of parts) {
      const root = scene.roots.find((item) => id === item.id || id.startsWith(item.id + "."))!;
      // 仅延伸根外沿，切缝保留原来的直线或折线，覆盖其外侧的真实圆弧。
      const footprint = extendSplitMaskPastTrayEdge(outer, root.outer);
      const mask = extrudeStepProfile(drawStepPolygon(footprint), bottom, top - bottom);
      let part: Shape3D;
      try { part = shape.intersect(mask, { simplify: false }); }
      finally { mask.delete(); }
      try {
        const check = validateStepSolid(part, `零件 ${id}`);
        if (check.solidCount !== 1) throw new Error(`零件 ${id} 的 STEP 裁切产生了多个实体`);
        const rotation = splitPrintRotation(check.size, settings);
        if (rotation === null) throw new Error(`零件 ${id} 超出打印范围，请继续拆分或修改打印尺寸`);
        for (const prior of realized) {
          if (check.bounds[1].some((max, axis) =>
            Math.min(max, prior.bounds[1][axis]) - Math.max(check.bounds[0][axis], prior.bounds[0][axis]) <= 0.000001)) continue;
          const overlap = prior.shape.intersect(part, { simplify: false });
          try {
            if (Math.abs(measureVolume(overlap)) > 0.000001) throw new Error("STEP 分件在切缝处重叠，请调整切线");
          } finally { overlap.delete(); }
        }
        realized.push({ shape: part, id, bounds: check.bounds, volume: check.volume, rotation });
      } catch (error) { part.delete(); throw error; }
    }
    if (Math.abs(realized.reduce((sum, part) => sum + part.volume, 0) - whole.volume) > tolerance) {
      throw new Error("STEP 分件与整件体积不一致，请调整切线");
    }
    const oriented: { shape: Shape3D; id: string }[] = [];
    try {
      for (const { shape: part, id, rotation } of realized) {
        const rotated = rotation ? part.rotate(90, [0, 0, 0], [0, 0, 1]) : part.clone();
        try {
          const box = rotated.boundingBox;
          try {
            const [min, max] = box.bounds;
            oriented.push({ id, shape: rotated.translate([-(min[0] + max[0]) / 2, -(min[1] + max[1]) / 2, -min[2]]) });
          } finally { box.delete(); }
        } finally { rotated.delete(); }
      }
      return oriented;
    } catch (error) {
      oriented.forEach(({ shape }) => shape.delete());
      throw error;
    }
  } finally { realized.forEach(({ shape }) => shape.delete()); }
}
