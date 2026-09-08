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
import { STACKABLE_BOX_SPECS } from "@/lib/stackable-box";

/**
 * 堆叠盒体与盖子的共享 CAD 原语。
 *
 * 本模块只拥有盒壳、底部外倒角、顶部内倒角、盖子和旁置预览组合，
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
 * 结构：底部外倒角导向段 + 2mm 主墙环 + 开口下沿打印过渡斜面 + 顶部内倒角。
 * 倒角只负责导向，盒口顶面与盒底外围水平肩面负责承重。
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
  const transitionH = STACKABLE_BOX_SPECS.topTransitionHeight;

  if (!Number.isFinite(W) || !Number.isFinite(D) || !Number.isFinite(H)) {
    throw new Error("堆叠盒体外部尺寸必须是有限数值");
  }
  if (trayTopZ < guideH) {
    throw new Error(
      `盒底厚度 ${trayTopZ} mm 小于倒角导向高度 ${guideH} mm`,
    );
  }
  if (transitionH <= 0) {
    throw new Error("顶部开口下沿过渡斜面高度必须大于 0");
  }

  const transitionStartZ = H - guideH - transitionH;
  if (transitionStartZ < trayTopZ) {
    throw new Error(
      `盒体外高 ${H} mm 不足以容纳顶部过渡斜面和导向倒角（至少需要 ${(
        trayTopZ + transitionH + guideH
      ).toFixed(1)} mm）`,
    );
  }

  const outerProfile = roundedRectangleProfile(W, D, R);
  const innerWallProfile = roundedRectangleProfile(
    W - 2 * wall,
    D - 2 * wall,
    Math.max(R - wall, 0),
  );
  const innerRimProfile = insetRoundedRectangleProfile(W, D, R, rim);

  const bottomGuideInset = rim + xyFitClearance;
  const shoulderInset = rim - guideH + xyFitClearance;
  const bottomGuideProfile = insetRoundedRectangleProfile(
    W,
    D,
    R,
    bottomGuideInset,
  );
  const shoulderGuideProfile = insetRoundedRectangleProfile(
    W,
    D,
    R,
    shoulderInset,
  );
  const guide = loftProfiles(
    bottomGuideProfile,
    shoulderGuideProfile,
    guideH,
  );

  // 1. 底部实体：中央导向段落地，导向肩以上恢复完整外轮廓。
  const baseAboveGuide = translate(
    [0, 0, guideH],
    extrudeProfile(outerProfile, trayTopZ - guideH),
  );
  const base = union(guide, baseAboveGuide);

  // 2. 主墙环（2mm，从 trayTopZ 到开口下沿过渡斜面的起点）
  const wallRing = subtract(outerProfile, innerWallProfile);
  const wallHeight = transitionStartZ - trayTopZ;
  const wallSolid =
    wallHeight > 0
      ? translate([0, 0, trayTopZ], extrudeProfile(wallRing, wallHeight))
      : null;

  // 3. 开口下沿打印过渡斜面：内轮廓从主墙内缩 wall 连续过渡到 rim，
  //    以 45° 斜面替代原本向下悬空的水平台阶。
  const rimRing = subtract(outerProfile, innerRimProfile);
  const transitionOuter = translate(
    [0, 0, transitionStartZ - 0.02],
    extrudeProfile(outerProfile, transitionH + 0.02),
  );
  const transitionCavity = translate(
    [0, 0, transitionStartZ - 0.02],
    loftProfiles(innerWallProfile, innerRimProfile, transitionH + 0.02),
  );
  const transitionSolid = subtract(transitionOuter, transitionCavity);

  // 4. 顶部水平承重环（最后 guideH 高度）；内倒角从其下沿开始。
  const topRimSolid = translate(
    [0, 0, H - guideH],
    extrudeProfile(rimRing, guideH),
  );

  // 5. 顶部内倒角：下端内缩 R，上端内缩 R-G，形成连续向上外扩的承重环。
  const openingBottomProfile = insetRoundedRectangleProfile(W, D, R, rim);
  const openingTopProfile = insetRoundedRectangleProfile(
    W,
    D,
    R,
    rim - guideH,
  );
  // 顶部内倒角使用精确共面端点；额外延伸会在 H-guideH 水平边界留下退化 STL 三角面。
  const topChamferCavity = translate(
    [0, 0, H - guideH],
    loftProfiles(openingBottomProfile, openingTopProfile, guideH),
  );
  const topRimWithChamfer = subtract(topRimSolid, topChamferCavity);
  const body = orientPositiveVolume(
    union(
      base,
      ...(wallSolid ? [wallSolid] : []),
      transitionSolid,
      topRimWithChamfer,
    ),
  );

  return orientPositiveVolume(body);
}

/**
 * 生成盒体盖子（打印方向：大平面贴床、定位结构朝上）。
 *
 * 平板 + 反向打印的底部外倒角导向轮廓 + 两个短边指甲槽。
 */
export function createStackableBoxLid(input: StackableBoxLidInput): Geom3 {
  const {
    outerWidth: W,
    outerDepth: D,
    lidThickness,
    xyFitClearance,
  } = input;
  const R = STACKABLE_BOX_SPECS.outerCornerRadius;
  const guideH = STACKABLE_BOX_SPECS.guideChamferHeight;

  const outerProfile = roundedRectangleProfile(W, D, R);

  // 1. 平板（贴床，Z=0 到 lidThickness）
  const plate = extrudeProfile(outerProfile, lidThickness);

  // 2. 打印坐标：靠板面处较宽，向上逐渐内收；翻转后与盒底装配方向一致。
  const guideBaseProfile = insetRoundedRectangleProfile(
    W,
    D,
    R,
    R - guideH + xyFitClearance,
  );
  const guideTopProfile = insetRoundedRectangleProfile(
    W,
    D,
    R,
    R + xyFitClearance,
  );
  const lidGuide = translate(
    [0, 0, lidThickness],
    loftProfiles(guideBaseProfile, guideTopProfile, guideH),
  );

  let lid = union(plate, lidGuide);

  // 3. 两个短边中部指甲槽（宽 18、高 1.0、向内深 1.2，避开定位轮廓）
  const nailW = STACKABLE_BOX_SPECS.nailNotchWidth;
  const nailH = STACKABLE_BOX_SPECS.nailNotchHeight;
  const nailD = STACKABLE_BOX_SPECS.nailNotchDepth;
  // 指甲槽应位于两条短边的中部：长宽比变化时仍保持槽口宽度沿短边方向。
  const shortEdgesAlongX = W > D;
  const notchCenters: [number, number, number][] = shortEdgesAlongX
    ? [
        [-(W / 2 - nailD / 2), 0, nailH / 2],
        [W / 2 - nailD / 2, 0, nailH / 2],
      ]
    : [
        [0, -(D / 2 - nailD / 2), nailH / 2],
        [0, D / 2 - nailD / 2, nailH / 2],
      ];
  for (const center of notchCenters) {
    const notch = shortEdgesAlongX
      ? primitives.cuboid({
          center,
          size: [nailD, nailW, nailH + 0.02],
        })
      : primitives.cuboid({
          center,
          size: [nailW, nailD, nailH + 0.02],
        });
    lid = subtract(lid, notch);
  }

  return orientPositiveVolume(lid);
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
