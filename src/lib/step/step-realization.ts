import {
  draw, drawRoundedRectangle, getOC, isShape3D, loft, makeBox, makeCompound, makeCylinder, measureVolume, roundedRectangleBlueprint,
  type AnyShape, type Drawing, type Shape3D, type Sketch,
} from "replicad";
import { RENDER_CONFIG } from "@/lib/config";
import { planCustomTrayConstruction, planGridTrayConstruction, type FlatTrayGroove } from "@/lib/flat-tray-construction";
import { getBaseHoleFitBlockingReason } from "@/lib/base-hole-construction-plan";
import type { FlatTraySnapshot } from "@/lib/manual-split-plan";
import { sampleSlotProfilePoints } from "@/lib/slot-profile-geometry";
import { planHalfTraySections, planTrayBodyProfiles, type TrayBodyProfile } from "@/lib/tray-body-profiles";
import { buildCustomContouredState } from "@/lib/custom-contoured-footprint";
import { pointInSplitRing, splitRingArea, type SplitRing } from "@/lib/manual-split-geometry";
import { planStackableBoxBody, planStackableBoxLid } from "@/lib/stackable-box-construction";
import { validateGridBox } from "@/lib/grid-layout-math";
import { validateCustomBox } from "@/lib/custom-layout-math";

export function requireStepSolid(shape: AnyShape): Shape3D {
  if (isShape3D(shape)) return shape as Shape3D;
  shape.delete();
  throw new Error("STEP 构造结果不是实体");
}

export function drawStepPolygon(points: readonly [number, number][]): Drawing {
  const pen = draw(points[0]);
  for (const point of points.slice(1)) pen.lineTo(point);
  return pen.close();
}

export function extrudeStepProfile(profile: Drawing, bottom: number, height: number) {
  return requireStepSolid(profile.sketchOnPlane("XY", bottom).extrude(height));
}

export function cutStepSolid(body: Shape3D, cutter: Shape3D) {
  try {
    // 封闭磁吸腔在当前内核的默认合并面步骤中可能失效。
    return body.cut(cutter, { simplify: false });
  } finally {
    body.delete();
    cutter.delete();
  }
}

export function realizeStepProfiles(profiles: TrayBodyProfile[]) {
  const [bottom, top] = profiles;
  if (profiles.length === 2 && bottom.width === top.width && bottom.depth === top.depth && bottom.radius === top.radius) {
    return extrudeStepProfile(drawRoundedRectangle(bottom.width, bottom.depth, bottom.radius), bottom.z, top.z - bottom.z);
  }
  const sketches: Sketch[] = [];
  try {
    for (const { width, depth, radius, z } of profiles) {
      sketches.push(roundedRectangleBlueprint(width, depth, radius).sketchOnPlane("XY", z));
    }
    return loft(sketches.map(({ wire }) => wire), { ruled: true });
  } finally {
    sketches.forEach((sketch) => sketch.delete());
  }
}

export function realizeStepGroove({ shape, width, height, cx, cy, bottom, length, rotation, outerOffset, profileExponent }: FlatTrayGroove) {
  if (shape === "circle") return makeCylinder(width / 2, length, [cx, cy, bottom], [0, 0, 1]);
  if (shape === "rectangle") {
    return makeBox([cx - width / 2, cy - height / 2, bottom], [cx + width / 2, cy + height / 2, bottom + length]);
  }
  const points = sampleSlotProfilePoints(width, height, shape, Math.max(0, outerOffset),
    RENDER_CONFIG.cylinderSegments, outerOffset > 0 ? profileExponent : 2);
  const radians = rotation * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const outline = points.map(({ x, y }): [number, number] => [cx + x * cos - y * sin, cy + x * sin + y * cos]);
  return extrudeStepProfile(drawStepPolygon(outline), bottom, length);
}

export function prepareStepConstruction(snapshot: FlatTraySnapshot) {
  const { params } = snapshot;
  if (![params.baseThickness, params.holeDepth, params.cornerRadius, params.sideBevelWidth].every(Number.isFinite) ||
      params.baseThickness <= 0 || params.holeDepth <= 0 || params.cornerRadius < 0 || params.sideBevelWidth < 0) {
    throw new Error("托盘高度、槽深、圆角或斜面参数无效");
  }
  if (snapshot.mode === "grid") {
    const { rows, columns } = snapshot.params;
    if (![rows, columns].every((value) => Number.isInteger(value) && value > 0 && value <= 30)) {
      throw new Error("网格行列必须是 1 至 30 的整数");
    }
  }
  const contoured = snapshot.mode === "custom" ? buildCustomContouredState(snapshot.params) : { status: "inactive" as const };
  if (contoured.status === "failed") throw new Error(contoured.error.message);
  const plan = snapshot.mode === "grid"
    ? planGridTrayConstruction(snapshot.params)
    : planCustomTrayConstruction(snapshot.params, contoured);
  if (plan.box.enabled) {
    const boxCheck = snapshot.mode === "grid" ? validateGridBox(snapshot.params) : validateCustomBox(snapshot.params);
    if (!boxCheck.valid) throw new Error(boxCheck.blockingReasons[0]?.message ?? "堆叠盒体参数无效");
  }
  if (plan.baseHoles.blocked) {
    throw new Error(getBaseHoleFitBlockingReason(plan.baseHoles.violations) ?? "底板孔位不适配");
  }
  if (![plan.width, plan.depth, plan.height].every((value) => Number.isFinite(value) && value > 0) ||
      plan.grooves.some(({ width, height, cx, cy, bottom, length, rotation, outerOffset, profileExponent }) =>
        ![width, height, cx, cy, bottom, length, rotation, outerOffset, profileExponent ?? 2].every(Number.isFinite) ||
        width <= 0 || height <= 0 || length <= 0 || (profileExponent ?? 2) <= 0) ||
      plan.baseHoles.instructions.some(({ x, y, bottom, top, diameter }) =>
        ![x, y, bottom, top, diameter].every(Number.isFinite) || top <= bottom || diameter <= 0)) {
    throw new Error("托盘轮廓或切削尺寸无效");
  }
  const half = snapshot.mode === "grid" && "halfAxis" in plan && plan.halfAxis
    ? planHalfTraySections(plan.width, plan.depth, params.baseThickness, params.holeDepth,
        params.cornerRadius, params.sideBevelWidth, plan.halfAxis)
    : null;
  const width = contoured.status === "ready" && !contoured.value.bodies.length && snapshot.mode === "custom"
    ? snapshot.params.trayWidth : plan.width;
  const depth = contoured.status === "ready" && !contoured.value.bodies.length && snapshot.mode === "custom"
    ? snapshot.params.trayDepth : plan.depth;
  return { ...plan, half, contoured, profiles: planTrayBodyProfiles(width, depth, plan.height,
    contoured.status === "ready" ? 0 : params.cornerRadius, contoured.status === "ready" ? 0 : params.sideBevelWidth) };
}

export function extrudeStepRegion(outer: SplitRing, holes: SplitRing[], bottom: number, height: number) {
  let body = extrudeStepProfile(drawStepPolygon(outer), bottom, height);
  for (const hole of holes) {
    let cutter: Shape3D;
    try { cutter = extrudeStepProfile(drawStepPolygon(hole), bottom - 1, height + 2); }
    catch (error) { body.delete(); throw error; }
    body = cutStepSolid(body, cutter);
  }
  return body;
}

function realizeContouredBody(plan: ReturnType<typeof prepareStepConstruction>) {
  if (plan.contoured.status !== "ready") throw new Error("轮廓尚未构造");
  const { bounds, bodies } = plan.contoured.value;
  const cx = bounds ? (bounds.minX + bounds.maxX) / 2 : 0;
  const cy = bounds ? (bounds.minY + bounds.maxY) / 2 : 0;
  const solids: Shape3D[] = [];
  try {
    for (const body of bodies) {
      const rings = body.outlines.map((ring): SplitRing => ring.map(({ x, y }) => [x - cx, y - cy]));
      const outers = rings.filter((ring) => splitRingArea(ring) > 0);
      if (!outers.length) throw new Error("自定义底座缺少有效的外轮廓");
      for (const outer of outers) {
        const holes = rings.filter((ring) => splitRingArea(ring) < 0 && pointInSplitRing(ring[0], outer));
        solids.push(extrudeStepRegion(outer, holes, 0, plan.height));
      }
    }
    return requireStepSolid(makeCompound(solids));
  } finally { solids.forEach((solid) => solid.delete()); }
}

export function realizeStepBody(plan: ReturnType<typeof prepareStepConstruction>) {
  if (plan.box.enabled) {
    const profiles = planStackableBoxBody({ ...plan.box, trayTopZ: plan.height });
    let body: Shape3D | undefined = realizeStepProfiles(profiles.envelope);
    try {
      for (const section of [profiles.lowerCavity, profiles.upperCavity]) {
        const cutter = realizeStepProfiles(section);
        const prior = body;
        body = undefined;
        body = cutStepSolid(prior, cutter);
      }
      const result = body;
      body = undefined;
      return result;
    } finally { body?.delete(); }
  }
  if (plan.contoured.status === "ready" && plan.contoured.value.bodies.length) return realizeContouredBody(plan);
  if (!plan.half) return realizeStepProfiles(plan.profiles);
  const { base, upper, clipCenter, clipSize } = plan.half;
  const upperProfiles = planTrayBodyProfiles(...upper).map((profile) => ({ ...profile, z: profile.z + base[2] }));
  const corner = (sign: number) => clipCenter.map((v, i) => v + sign * clipSize[i] / 2) as [number, number, number];
  const mask = makeBox(corner(-1), corner(1));
  let clipped: Shape3D | undefined;
  try {
    const top = realizeStepProfiles(upperProfiles);
    try { clipped = top.intersect(mask, { simplify: false }); }
    finally { top.delete(); }
    const bottom = realizeStepProfiles(planTrayBodyProfiles(...base));
    try { return bottom.fuse(clipped, { simplify: false }); }
    finally { bottom.delete(); }
  } finally {
    mask.delete();
    clipped?.delete();
  }
}

export function realizeStepLid(plan: ReturnType<typeof prepareStepConstruction>) {
  return realizeStepProfiles(planStackableBoxLid(plan.box));
}

export function realizeStepTray(plan: ReturnType<typeof prepareStepConstruction>) {
  let body: Shape3D | undefined;
  try {
    body = realizeStepBody(plan);
    for (const groove of plan.grooves) {
      const cutter = realizeStepGroove(groove);
      const old = body;
      body = undefined;
      body = cutStepSolid(old, cutter);
    }
    for (const { x, y, bottom, top, diameter } of plan.baseHoles.instructions) {
      const cutter = makeCylinder(diameter / 2, top - bottom, [x, y, bottom], [0, 0, 1]);
      const old = body;
      body = undefined;
      body = cutStepSolid(old, cutter);
    }
    const result = body;
    body = undefined;
    return result;
  } finally {
    body?.delete();
  }
}

export function validateStepSolid(shape: Shape3D, label: string) {
  const oc = getOC();
  const check = new oc.BRepCheck_Analyzer(shape.wrapped, true);
  const box = shape.boundingBox;
  const solids = shape.solids;
  try {
    const bounds = box.bounds;
    const volume = measureVolume(shape);
    const size = bounds[1].map((v, index) => v - bounds[0][index]) as [number, number, number];
    if (!solids.length || !check.IsValid() || !Number.isFinite(volume) || volume <= 0 ||
        size.some((v) => !Number.isFinite(v) || v <= 0)) {
      throw new Error(`${label}的 STEP 实体拓扑、尺寸或体积无效`);
    }
    return { bounds, size, volume, solidCount: solids.length };
  } finally {
    box.delete();
    check.delete();
    solids.forEach((solid) => solid.delete());
  }
}
