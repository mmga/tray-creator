import { booleans, expansions, extrusions, geometries, measurements, primitives, transforms } from "@jscad/modeling";
import type { Geom2, Geom3 } from "@jscad/modeling/src/geometries/types";
import type { BaseHoleConstructionPlan } from "./base-hole-construction-plan";
import { RENDER_CONFIG } from "./config";
import {
  pointInSplitRing, projectSplitPoint, ringEdges, splitBounds, splitDistance, splitRingArea,
  type SplitPoint, type SplitRing,
} from "./manual-split-geometry";
import { isManualSplitBedValid, replayManualCuts, splitPrintRotation, type ManualSplitScene, type ManualSplitSettings } from "./manual-split-plan";

export interface FlatTrayCutSource {
  body: Geom3;
  grooves: Geom3[];
  baseHoles: BaseHoleConstructionPlan;
  clipGroovesToBody?: boolean;
}

const { geom2, geom3 } = geometries;
const { measureBoundingBox, measureVolume } = measurements;
const { extrudeLinear, project } = extrusions;
const { intersect, union } = booleans;
const { translate, rotateZ } = transforms;

function outlines(shape: Geom2): SplitRing[] {
  return geom2.toOutlines(shape) as SplitRing[];
}

export function createManualSplitScene(
  { body, grooves, baseHoles, clipGroovesToBody }: FlatTrayCutSource,
  clearance: number,
): ManualSplitScene {
  if (!Number.isFinite(clearance) || clearance < 0) throw new Error("请输入有效的凹槽保留边距");
  const [[, , bottom], [, , top]] = measureBoundingBox(body);
  const bottomFaces = geom3.toPolygons(body)
    .filter(({ vertices }) => vertices.every((point) => Math.abs(point[2] - bottom) < 0.000001))
    .map(({ vertices }) => geom2.fromPoints(vertices.map(([x, y]): [number, number] => [x, y]).reverse()));
  const rings = outlines(bottomFaces.length === 1 ? bottomFaces[0] : bottomFaces.length > 1 ? union(...bottomFaces) : project({}, body));
  const outer = rings.filter((ring) => splitRingArea(ring) > 0).sort((a, b) => {
    const left = splitBounds(a).min;
    const right = splitBounds(b).min;
    return left[0] - right[0] || left[1] - right[1];
  });
  const holes = rings.filter((ring) => splitRingArea(ring) < 0);
  if (!outer.length) throw new Error("无法提取可拆分的底板边界");
  const grooveProfiles = grooves.flatMap((groove) => {
    const actual = clipGroovesToBody ? intersect(body, groove) : groove;
    return geom3.toPolygons(actual).length ? [project({}, actual)] : [];
  });
  const baseProfiles = baseHoles.instructions.map(({ x, y, diameter }) =>
    primitives.circle({ center: [x, y], radius: diameter / 2, segments: RENDER_CONFIG.cylinderSegments }),
  );
  const obstacles = [...grooveProfiles, ...baseProfiles].flatMap((profile) => {
    // 为布尔量化和路径顶点误差预留余量，切线不会落到实际保护边界上。
    const expanded = outlines(expansions.offset({ delta: clearance + 0.02, corners: "edge" }, profile));
    if (!expanded.length) throw new Error("无法构造凹槽保护区");
    return expanded;
  });
  return {
    roots: outer.map((ring, i) => ({
      id: String(i + 1),
      outer: ring,
      holes: holes.filter((hole) => pointInSplitRing(hole[0], ring)),
    })),
    grooves: grooveProfiles.flatMap(outlines),
    obstacles,
    height: top - bottom,
  };
}

export function realizeManualSplitParts(model: Geom3, scene: ManualSplitScene, settings: ManualSplitSettings) {
  if (!isManualSplitBedValid(settings)) throw new Error("请输入有效的打印尺寸和边距");
  const { parts, invalid } = replayManualCuts(scene, settings.cuts);
  if (invalid.size) throw new Error("分割线已失效，请回到二维编辑检查");
  if (parts.length < 2) throw new Error("请先确认分割线");
  const [[, , bottom], [, , top]] = measureBoundingBox(model);
  const realized = parts.map(({ id, outer }) => {
    const root = scene.roots.find((item) => id === item.id || id.startsWith(item.id + "."))!;
    const footprint = extendSplitMaskPastTrayEdge(outer, root.outer);
    const mask = translate([0, 0, bottom - 1], extrudeLinear({ height: top - bottom + 2 }, geom2.fromPoints(footprint)));
    const geometry = intersect(model, mask);
    if (measureVolume(geometry) <= 0.001) throw new Error(`零件 ${id} 的裁切实体无效`);
    const [min, max] = measureBoundingBox(geometry);
    const size: [number, number, number] = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
    return { id, geometry, size, rotation: splitPrintRotation(size, settings) };
  });
  const volume = measureVolume(model);
  const total = realized.reduce((sum, { geometry }) => sum + measureVolume(geometry), 0);
  if (Math.abs(total - volume) > Math.max(0.01, volume * 0.00005)) {
    throw new Error("分割后体积与原模型不一致");
  }
  return realized;
}

/** 裁切体越过原托盘外壁，避免圆角处共面布尔裂缝。共享切线保持原位。 */
export function extendSplitMaskPastTrayEdge(ring: SplitRing, root: SplitRing): SplitRing {
  const rootEdges = ringEdges(root);
  const sides = ringEdges(ring).map(([a, b]) => {
    const length = splitDistance(a, b);
    const x = (b[1] - a[1]) / length;
    const y = (a[0] - b[0]) / length;
    const outside = rootEdges.some(([from, to]) =>
      splitDistance(a, projectSplitPoint(a, from, to)) < 0.0001 &&
      splitDistance(b, projectSplitPoint(b, from, to)) < 0.0001);
    return { x, y, delta: outside ? 0.1 : 0 };
  });
  return ring.map((p, i): SplitPoint => {
    const a = sides[(i + sides.length - 1) % sides.length];
    const b = sides[i];
    if (!a.delta && !b.delta) return p;
    const det = a.x * b.y - a.y * b.x;
    if (Math.abs(det) < 0.000001) return [p[0] + a.x * a.delta, p[1] + a.y * a.delta];
    return [p[0] + (a.delta * b.y - a.y * b.delta) / det, p[1] + (a.x * b.delta - a.delta * b.x) / det];
  });
}

export function orientManualPrintPart(geometry: Geom3, rotation: 0 | 90) {
  const oriented = rotation === 90 ? rotateZ(Math.PI / 2, geometry) : geometry;
  const [min, max] = measureBoundingBox(oriented);
  return translate([-(min[0] + max[0]) / 2, -(min[1] + max[1]) / 2, -min[2]], oriented);
}
