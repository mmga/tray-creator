import {
  booleans,
  extrusions,
  geometries,
  maths,
  measurements,
  primitives,
  transforms,
} from "@jscad/modeling";
import type { Geom2, Geom3 } from "@jscad/modeling/src/geometries/types";
import { RENDER_CONFIG } from "@/lib/config";
import {
  calculateBottomSeatSlopeHeight,
  calculateTopSeatSupportHeight,
  STACKABLE_BOX_SPECS,
} from "@/lib/stackable-box";

/**
 * 堆叠盒体与盖子的共享 CAD 原语。
 *
 * 本模块只拥有盒壳、底部导向斜面、顶部接收斜面、盖子和旁置预览组合，
 * 不理解网格或自由槽位。坐标原点位于盒体外部轮廓中心（XY），Z=0 为底面。
 */

const { subtract, union } = booleans;
const { roundedRectangle } = primitives;
const { extrudeFromSlices, extrudeLinear, slice } = extrusions;
const { geom2, geom3 } = geometries;
const { mat4 } = maths;
const { translate } = transforms;
const { measureVolume } = measurements;

/** 保证几何体积为正，避免布尔运算后法线方向反转导致 measureVolume 返回负值。 */
function orientPositiveVolume(geometry: Geom3): Geom3 {
  return measureVolume(geometry) < 0 ? geom3.invert(geometry) : geometry;
}

/** 圆角矩形 2D 轮廓；圆角半径自动钳制到尺寸允许范围内。 */
function roundedRectangleProfile(
  width: number,
  depth: number,
  cornerRadius: number,
): Geom2 {
  const effectiveRadius = Math.max(
    0.01,
    Math.min(cornerRadius, width / 2 - 0.01, depth / 2 - 0.01),
  );
  return roundedRectangle({
    size: [width, depth],
    roundRadius: effectiveRadius,
    segments: RENDER_CONFIG.cornerSegments,
  });
}

/** 从 2D 轮廓线性拉伸为实体。 */
function extrudeProfile(profile: Geom2, height: number): Geom3 {
  return extrudeLinear({ height }, profile);
}

/** 由外轮廓和内缩量派生同心圆角矩形，保证上下装配截面使用同一规则。 */
function insetRoundedRectangleProfile(
  width: number,
  depth: number,
  cornerRadius: number,
  inset: number,
): Geom2 {
  return roundedRectangleProfile(
    width - 2 * inset,
    depth - 2 * inset,
    Math.max(cornerRadius - inset, 0),
  );
}

function loftProfiles(
  bottom: Geom2,
  top: Geom2,
  height: number,
): Geom3 {
  if (height <= 0) {
    return extrudeProfile(bottom, 0.001);
  }
  return extrudeFromSlices(
    {
      numberOfSlices: 2,
      callback: (progress) => {
        const profile = progress === 0 ? bottom : top;
        const currentSlice = slice.fromSides(geom2.toSides(profile));
        return slice.transform(
          mat4.fromTranslation(mat4.create(), [0, 0, height * progress]),
          currentSlice,
        );
      },
    },
    slice.fromSides(geom2.toSides(bottom)),
  );
}

/** 通过任意高度的轮廓序列生成连续实体，避免分段并集留下内部水平面。 */
function loftProfileSequence(
  profiles: readonly { profile: Geom2; z: number }[],
): Geom3 {
  if (profiles.length < 2) {
    throw new Error("轮廓序列至少需要两个截面");
  }
  return extrudeFromSlices(
    {
      numberOfSlices: profiles.length,
      callback: (_progress, index) => {
        const { profile, z } = profiles[index];
        return slice.transform(
          mat4.fromTranslation(mat4.create(), [0, 0, z]),
          slice.fromSides(geom2.toSides(profile)),
        );
      },
    },
    slice.fromSides(geom2.toSides(profiles[0].profile)),
  );
}

export interface StackableBoxBodyInput {
  outerWidth: number;
  outerDepth: number;
  outerHeight: number;
  /** 内部托盘顶面高度（盒底实体从 Z=0 到 trayTopZ）。 */
  trayTopZ: number;
  /** 每侧 XY 配合间隙 (mm)。 */
  xyFitClearance: number;
}

export interface StackableBoxLidInput {
  outerWidth: number;
  outerDepth: number;
  lidThickness: number;
  /** 每侧 XY 配合间隙 (mm)。 */
  xyFitClearance: number;
}

/**
 * 生成堆叠盒体空白主体（不含内部槽位切削）。
 *
 * 结构：贴床底面 + 底部外扩导向斜面 + 2mm 主墙 + 盒口内侧支撑斜面
 * + 下沉水平承重座 + 升至顶边的接收斜面。最高处只有边线，没有水平顶面。
 */
export function createStackableBoxBody(input: StackableBoxBodyInput): Geom3 {
  const {
    outerWidth: W,
    outerDepth: D,
    outerHeight: H,
    trayTopZ,
    xyFitClearance,
  } = input;
  const R = STACKABLE_BOX_SPECS.outerCornerRadius;
  const wall = STACKABLE_BOX_SPECS.bodyWallThickness;
  const rim = STACKABLE_BOX_SPECS.topRimWidth;
  const guideH = STACKABLE_BOX_SPECS.guideChamferHeight;
  const bottomSlopeH = calculateBottomSeatSlopeHeight(input);
  const topSeatSupportH = calculateTopSeatSupportHeight(input);
  const wallStartZ = Math.max(trayTopZ, bottomSlopeH);

  if (!Number.isFinite(W) || !Number.isFinite(D) || !Number.isFinite(H)) {
    throw new Error("堆叠盒体外部尺寸必须是有限数值");
  }
  if (!Number.isFinite(trayTopZ) || trayTopZ <= 0) {
    throw new Error("盒底厚度必须是大于 0 的有限数值");
  }

  const topSeatZ = H - guideH;
  const transitionStartZ = topSeatZ - topSeatSupportH;
  if (transitionStartZ < wallStartZ) {
    throw new Error(
      `盒体外高 ${H} mm 不足以容纳上下互补斜面和承重座（至少需要 ${(
        wallStartZ + topSeatSupportH + guideH
      ).toFixed(1)} mm）`,
    );
  }

  const outerProfile = roundedRectangleProfile(W, D, R);
  const innerWallProfile = roundedRectangleProfile(
    W - 2 * wall,
    D - 2 * wall,
    Math.max(R - wall, 0),
  );
  const topSeatInnerInset = rim + xyFitClearance;
  const topSeatInnerProfile = insetRoundedRectangleProfile(
    W,
    D,
    R,
    topSeatInnerInset,
  );

  // 1. 盒底中央承重面直接落在 Z=0 打印平面；外缘以 45° 连续外扩到完整外轮廓。
  //    有效装配段高 guideH，全段相对下层盒口斜面保持 xyFitClearance。
  const bottomFloorInset = guideH + xyFitClearance;
  const bottomFloorProfile = insetRoundedRectangleProfile(
    W,
    D,
    R,
    bottomFloorInset,
  );
  // 2. 外包络一次放样到底，避免底板、主墙和盒口分段并集产生内部水平面。
  const outerEnvelope = loftProfileSequence([
    { profile: bottomFloorProfile, z: 0 },
    { profile: outerProfile, z: bottomSlopeH },
    { profile: outerProfile, z: H },
  ]);

  // 3. 内腔从托盘顶面连续延伸到凹下的承重座内缘；所有新增材料均由 45° 斜面承托。
  const lowerCavityProfiles: Array<{ profile: Geom2; z: number }> = [];
  if (trayTopZ < bottomSlopeH) {
    lowerCavityProfiles.push({
      profile: insetRoundedRectangleProfile(
        W,
        D,
        R,
        bottomFloorInset * (1 - trayTopZ / bottomSlopeH) + wall,
      ),
      z: trayTopZ,
    });
    lowerCavityProfiles.push({ profile: innerWallProfile, z: bottomSlopeH });
  } else {
    lowerCavityProfiles.push({ profile: innerWallProfile, z: trayTopZ });
  }
  if (transitionStartZ > lowerCavityProfiles.at(-1)!.z) {
    lowerCavityProfiles.push({
      profile: innerWallProfile,
      z: transitionStartZ,
    });
  }
  lowerCavityProfiles.push({ profile: topSeatInnerProfile, z: topSeatZ });
  const lowerCavity = loftProfileSequence(lowerCavityProfiles);

  // 4. 盒口外侧接收斜面：从凹下的水平座外缘升到最高外轮廓边线。
  const topSlopeOpeningBottom = insetRoundedRectangleProfile(
    W,
    D,
    R,
    guideH,
  );
  const topSlopeOpening = translate(
    [0, 0, topSeatZ],
    loftProfiles(topSlopeOpeningBottom, outerProfile, guideH),
  );
  const body = subtract(outerEnvelope, union(lowerCavity, topSlopeOpening));

  return orientPositiveVolume(body);
}

/**
 * 生成盒体盖子（打印方向：大平面贴床、定位结构朝上）。
 *
 * 完整平板 + 反向打印的盒底同截面互补斜面，不设置边缘凹槽。
 */
export function createStackableBoxLid(input: StackableBoxLidInput): Geom3 {
  const {
    outerWidth: W,
    outerDepth: D,
    lidThickness,
    xyFitClearance,
  } = input;
  const R = STACKABLE_BOX_SPECS.outerCornerRadius;
  const slopeH = calculateBottomSeatSlopeHeight(input);

  const outerProfile = roundedRectangleProfile(W, D, R);

  // 1. 平板（贴床，Z=0 到 lidThickness）
  const plate = extrudeProfile(outerProfile, lidThickness);

  // 2. 打印坐标：从完整外轮廓向上收至盒底中央平面轮廓。
  //    使用时翻转，得到与盒体底部完全一致的 45° 装配截面。
  const guideBaseProfile = outerProfile;
  const guideTopProfile = insetRoundedRectangleProfile(
    W,
    D,
    R,
    STACKABLE_BOX_SPECS.guideChamferHeight + xyFitClearance,
  );
  const lidGuide = translate(
    [0, 0, lidThickness],
    loftProfiles(guideBaseProfile, guideTopProfile, slopeH),
  );

  return orientPositiveVolume(union(plate, lidGuide));
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
