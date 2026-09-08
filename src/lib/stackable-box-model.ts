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
 * 本模块只拥有盒壳、底部定位截面、顶部凹槽、盖子和旁置预览组合，
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
    0,
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
 * 结构：完整底部实体 + 2.4mm 主墙环 + 顶部 4.0mm 承重环 + 顶部定位凹槽
 * + 底部承重肩浅凹区 + 带入口倒角的定位凸缘。
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
  const flangeW = STACKABLE_BOX_SPECS.flangeWidth;
  const flangeH = STACKABLE_BOX_SPECS.flangeHeight;
  const grooveD = STACKABLE_BOX_SPECS.grooveDepth;
  const locator = STACKABLE_BOX_SPECS.locatorRingCenterlineInset;
  const chamfer = STACKABLE_BOX_SPECS.flangeEntryChamfer;
  const rimThickness = wall; // 盒口最后 2.4mm 高度范围内向内加宽

  const outerProfile = roundedRectangleProfile(W, D, R);
  const innerWallProfile = roundedRectangleProfile(
    W - 2 * wall,
    D - 2 * wall,
    Math.max(R - wall, 0),
  );
  const innerRimProfile = roundedRectangleProfile(
    W - 2 * rim,
    D - 2 * rim,
    Math.max(R - rim, 0),
  );
  // 上层盒底会进入下层盒口；中央进入区域需要与盒口保留同样的打印间隙。
  const bottomCenterProfile = roundedRectangleProfile(
    W - 2 * (rim + xyFitClearance),
    D - 2 * (rim + xyFitClearance),
    Math.max(R - rim - xyFitClearance, 0),
  );

  // 1. 底部实体
  const base = extrudeProfile(outerProfile, trayTopZ);

  // 2. 主墙环（2.4mm，从 trayTopZ 到 H - rimThickness）
  const wallRing = subtract(outerProfile, innerWallProfile);
  const wallHeight = Math.max(0, H - trayTopZ - rimThickness);
  const wallSolid = translate(
    [0, 0, trayTopZ],
    extrudeProfile(wallRing, wallHeight),
  );

  // 3. 顶部承重环（4.0mm，从 H - rimThickness 到 H）
  const rimRing = subtract(outerProfile, innerRimProfile);
  const topRimSolid = translate(
    [0, 0, H - rimThickness],
    extrudeProfile(rimRing, rimThickness),
  );

  let body = union(base, wallSolid, topRimSolid);

  // 4. 顶部定位凹槽（从顶部向下 1.4mm）
  const grooveWidth = flangeW + 2 * xyFitClearance;
  const grooveOuterInset = locator - grooveWidth / 2;
  const grooveInnerInset = locator + grooveWidth / 2;
  const grooveOuterProfile = roundedRectangleProfile(
    W - 2 * grooveOuterInset,
    D - 2 * grooveOuterInset,
    Math.max(R - grooveOuterInset, 0),
  );
  const grooveInnerProfile = roundedRectangleProfile(
    W - 2 * grooveInnerInset,
    D - 2 * grooveInnerInset,
    Math.max(R - grooveInnerInset, 0),
  );
  const grooveRing = subtract(grooveOuterProfile, grooveInnerProfile);
  body = subtract(
    body,
    translate(
      [0, 0, H - grooveD],
      extrudeProfile(grooveRing, grooveD + 0.02),
    ),
  );

  // 5. 底部承重肩浅凹区：顶部承重边宽环（0 到 4.0mm）减去凸缘环，抬高 1.2mm
  const flangeOuterProfile = roundedRectangleProfile(
    W - 2 * (locator - flangeW / 2),
    D - 2 * (locator - flangeW / 2),
    Math.max(R - (locator - flangeW / 2), 0),
  );
  const flangeInnerProfile = roundedRectangleProfile(
    W - 2 * (locator + flangeW / 2),
    D - 2 * (locator + flangeW / 2),
    Math.max(R - (locator + flangeW / 2), 0),
  );
  const flangeRing = subtract(flangeOuterProfile, flangeInnerProfile);
  // 承重肩 = 顶部承重边宽环（0 到 4.0mm）减去凸缘环；外侧环外扩 0.2mm 以干净切穿外轮廓。
  const shoulderOuterRing = subtract(
    roundedRectangleProfile(W + 0.2, D + 0.2, R),
    flangeOuterProfile,
  );
  const shoulderInnerRing = subtract(
    flangeInnerProfile,
    bottomCenterProfile,
  );
  const shoulderRing = union(shoulderOuterRing, shoulderInnerRing);
  body = subtract(
    body,
    translate(
      [0, 0, -0.02],
      extrudeProfile(shoulderRing, flangeH + 0.02),
    ),
  );

  // 6. 定位凸缘（带入口倒角）：底部窄、往上 0.3mm 过渡到全宽，随后直壁到 1.2mm
  const chamferOuterProfile = roundedRectangleProfile(
    W - 2 * (locator - flangeW / 2 + chamfer),
    D - 2 * (locator - flangeW / 2 + chamfer),
    Math.max(R - (locator - flangeW / 2 + chamfer), 0),
  );
  const chamferInnerProfile = roundedRectangleProfile(
    W - 2 * (locator + flangeW / 2 - chamfer),
    D - 2 * (locator + flangeW / 2 - chamfer),
    Math.max(R - (locator + flangeW / 2 - chamfer), 0),
  );
  const chamferRing = subtract(chamferOuterProfile, chamferInnerProfile);

  const flangeChamfer = extrudeFromSlices(
    {
      numberOfSlices: 2,
      callback: (progress) => {
        const profile = progress === 0 ? chamferRing : flangeRing;
        const currentSlice = slice.fromSides(geom2.toSides(profile));
        return slice.transform(
          mat4.fromTranslation(mat4.create(), [0, 0, chamfer * progress]),
          currentSlice,
        );
      },
    },
    slice.fromSides(geom2.toSides(chamferRing)),
  );
  const flangeStraight = translate(
    [0, 0, chamfer],
    extrudeProfile(flangeRing, flangeH - chamfer),
  );
  body = union(body, flangeChamfer, flangeStraight);

  return orientPositiveVolume(body);
}

/**
 * 生成盒体盖子（打印方向：大平面贴床、定位结构朝上）。
 *
 * 平板 + 与盒底相同的定位轮廓（凸缘）+ 两个短边指甲槽。
 */
export function createStackableBoxLid(input: StackableBoxLidInput): Geom3 {
  const { outerWidth: W, outerDepth: D, lidThickness } = input;
  const R = STACKABLE_BOX_SPECS.outerCornerRadius;
  const flangeW = STACKABLE_BOX_SPECS.flangeWidth;
  const flangeH = STACKABLE_BOX_SPECS.flangeHeight;
  const locator = STACKABLE_BOX_SPECS.locatorRingCenterlineInset;
  const chamfer = STACKABLE_BOX_SPECS.flangeEntryChamfer;

  const outerProfile = roundedRectangleProfile(W, D, R);

  // 1. 平板（贴床，Z=0 到 lidThickness）
  const plate = extrudeProfile(outerProfile, lidThickness);

  // 2. 定位凸缘（与盒底相同轮廓），装配面朝上
  const flangeOuterProfile = roundedRectangleProfile(
    W - 2 * (locator - flangeW / 2),
    D - 2 * (locator - flangeW / 2),
    Math.max(R - (locator - flangeW / 2), 0),
  );
  const flangeInnerProfile = roundedRectangleProfile(
    W - 2 * (locator + flangeW / 2),
    D - 2 * (locator + flangeW / 2),
    Math.max(R - (locator + flangeW / 2), 0),
  );
  const flangeRing = subtract(flangeOuterProfile, flangeInnerProfile);

  const chamferOuterProfile = roundedRectangleProfile(
    W - 2 * (locator - flangeW / 2 + chamfer),
    D - 2 * (locator - flangeW / 2 + chamfer),
    Math.max(R - (locator - flangeW / 2 + chamfer), 0),
  );
  const chamferInnerProfile = roundedRectangleProfile(
    W - 2 * (locator + flangeW / 2 - chamfer),
    D - 2 * (locator + flangeW / 2 - chamfer),
    Math.max(R - (locator + flangeW / 2 - chamfer), 0),
  );
  const chamferRing = subtract(chamferOuterProfile, chamferInnerProfile);

  // 直段：从 lidThickness 到 lidThickness + flangeH - chamfer
  const flangeStraight = translate(
    [0, 0, lidThickness],
    extrudeProfile(flangeRing, flangeH - chamfer),
  );
  // 倒角段：顶端从全宽过渡到窄环
  const flangeChamfer = extrudeFromSlices(
    {
      numberOfSlices: 2,
      callback: (progress) => {
        const profile = progress === 0 ? flangeRing : chamferRing;
        const currentSlice = slice.fromSides(geom2.toSides(profile));
        return slice.transform(
          mat4.fromTranslation(mat4.create(), [
            0,
            0,
            lidThickness + flangeH - chamfer + chamfer * progress,
          ]),
          currentSlice,
        );
      },
    },
    slice.fromSides(geom2.toSides(flangeRing)),
  );

  let lid = union(plate, flangeStraight, flangeChamfer);

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
