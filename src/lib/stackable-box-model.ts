import {
  booleans,
  extrusions,
  geometries,
  maths,
  measurements,
  primitives,
  transforms,
} from "@jscad/modeling";
import type { Geom3 } from "@jscad/modeling/src/geometries/types";
import { RENDER_CONFIG } from "@/lib/config";
import { planStackableBoxBody, planStackableBoxLid, type StackableBoxBodyInput, type StackableBoxLidInput } from "./stackable-box-construction";
import type { TrayBodyProfile } from "./tray-body-profiles";
export type { StackableBoxBodyInput, StackableBoxLidInput } from "./stackable-box-construction";

/**
 * 堆叠盒体与盖子的共享 CAD 原语。
 *
 * 本模块只拥有盒壳、底部导向斜面、顶部接收斜面、盖子和旁置预览组合，
 * 不理解网格或自由槽位。坐标原点位于盒体外部轮廓中心（XY），Z=0 为底面。
 */

const { subtract, union } = booleans;
const { roundedRectangle } = primitives;
const { extrudeFromSlices, slice } = extrusions;
const { geom2, geom3 } = geometries;
const { mat4 } = maths;
const { translate } = transforms;
const { measureVolume } = measurements;

/** 保证几何体积为正，避免布尔运算后法线方向反转导致 measureVolume 返回负值。 */
function orientPositiveVolume(geometry: Geom3): Geom3 {
  return measureVolume(geometry) < 0 ? geom3.invert(geometry) : geometry;
}

function loftProfiles(profiles: TrayBodyProfile[]): Geom3 {
  const sections = profiles.map(({ width, depth, radius, z }) => ({
    z,
    slice: slice.fromSides(geom2.toSides(roundedRectangle({ size: [width, depth],
      roundRadius: radius, segments: RENDER_CONFIG.cornerSegments }))),
  }));
  return extrudeFromSlices({
    numberOfSlices: sections.length,
    callback: (_progress, index) => slice.transform(
      mat4.fromTranslation(mat4.create(), [0, 0, sections[index].z]),
      sections[index].slice,
    ),
  }, sections[0].slice);
}

export function createStackableBoxBody(input: StackableBoxBodyInput): Geom3 {
  const { envelope, lowerCavity, upperCavity } = planStackableBoxBody(input);
  return orientPositiveVolume(subtract(loftProfiles(envelope),
    union(loftProfiles(lowerCavity), loftProfiles(upperCavity))));
}

export function createStackableBoxLid(input: StackableBoxLidInput): Geom3 {
  return orientPositiveVolume(loftProfiles(planStackableBoxLid(input)));
}

/** 旁置预览组合：直立盒体 + 打印方向盖子，按视觉间距摆开为两个不相连壳体。 */
export function composeBoxAndLidPreview(
  body: Geom3,
  lid: Geom3,
  spacing: number,
): Geom3 {
  return union(body, translate([spacing, 0, 0], lid));
}

/** 旁置预览间距：按盒体短边比例并设上限，避免极大盒子把相机拉得过远。 */
export function createBoxSideBySidePreviewSpacing(
  outerWidth: number,
  outerDepth: number,
): number {
  const shortSide = Math.min(outerWidth, outerDepth);
  const visualGap = Math.min(Math.max(shortSide * 0.5, 24), 160);
  // composeBoxAndLidPreview 使用该值作为盖子相对盒体的平移量，而非额外间隙。
  return outerWidth + visualGap;
}
