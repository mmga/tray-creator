import {
  booleans,
  extrusions,
  geometries,
  maths,
  primitives,
} from "@jscad/modeling";
import type { Geom2, Geom3 } from "@jscad/modeling/src/geometries/types";
import { RENDER_CONFIG } from "@/lib/config";
import { ROUND_BASE_SHELL_THICKNESS } from "@/lib/round-base-profile";
import type { SquareBaseProfileSnapshot } from "@/types/custom-tray";

const { extrudeFromSlices, slice } = extrusions;
const { subtract } = booleans;
const { geom2 } = geometries;
const { mat4 } = maths;
const { roundedRectangle } = primitives;

const CAVITY_CUT_EPSILON = 0.02;

interface SquareProfileDimensions {
  width: number;
  depth: number;
  cornerRadius: number;
}

/**
 * 方形底盘在指定高度处的外轮廓。
 * 单边内缩按高度线性收分，圆角同步收缩，与圆形底盘的锥面口径一致。
 */
export function getSquareBaseOuterDimensionsAtHeight(
  profile: SquareBaseProfileSnapshot,
  height: number,
): SquareProfileDimensions {
  const clampedHeight = Math.min(Math.max(height, 0), profile.height);
  const inset = profile.topInset * (clampedHeight / profile.height);
  return {
    width: profile.width - inset * 2,
    depth: profile.depth - inset * 2,
    cornerRadius: Math.max(profile.cornerRadius - inset, 0),
  };
}

export function getSquareBaseTopDimensions(
  profile: SquareBaseProfileSnapshot,
): SquareProfileDimensions {
  return getSquareBaseOuterDimensionsAtHeight(profile, profile.height);
}

/**
 * 开腔尺寸：顶板保留与圆形底盘相同的壳厚，腔体在顶板下方截止，
 * 腔壁与外侧收分平行地向内退一个壳厚。
 */
export function getSquareBaseCavityDimensions(
  profile: SquareBaseProfileSnapshot,
) {
  const depth = profile.height - ROUND_BASE_SHELL_THICKNESS;
  const outerAtCeiling = getSquareBaseOuterDimensionsAtHeight(profile, depth);
  return {
    depth,
    bottom: {
      width: profile.width - ROUND_BASE_SHELL_THICKNESS * 2,
      depth: profile.depth - ROUND_BASE_SHELL_THICKNESS * 2,
      cornerRadius: Math.max(
        profile.cornerRadius - ROUND_BASE_SHELL_THICKNESS,
        0,
      ),
    } satisfies SquareProfileDimensions,
    ceiling: {
      width: outerAtCeiling.width - ROUND_BASE_SHELL_THICKNESS * 2,
      depth: outerAtCeiling.depth - ROUND_BASE_SHELL_THICKNESS * 2,
      cornerRadius: Math.max(
        outerAtCeiling.cornerRadius - ROUND_BASE_SHELL_THICKNESS,
        0,
      ),
    } satisfies SquareProfileDimensions,
  };
}

/**
 * JSCAD 的 roundedRectangle 在 roundRadius 为 0 时返回 4 顶点矩形，大于 0 时返回多边形；
 * extrudeFromSlices 按边配对连接两端，顶点数不一致会静默生成错误实体，
 * 因此收分两端必须统一走圆角或统一走直角。
 */
const MIN_CORNER_RADIUS = 0.01;

function squareProfile(
  dimensions: SquareProfileDimensions,
  forceRounded: boolean,
): Geom2 {
  const maxRadius = Math.min(dimensions.width, dimensions.depth) / 2 - 0.01;
  const radius = forceRounded
    ? Math.max(dimensions.cornerRadius, MIN_CORNER_RADIUS)
    : 0;
  return roundedRectangle({
    size: [dimensions.width, dimensions.depth],
    roundRadius: Math.max(Math.min(radius, maxRadius), 0),
    segments: RENDER_CONFIG.cornerSegments,
  });
}

function createTaperedSquareBody(
  bottom: SquareProfileDimensions,
  top: SquareProfileDimensions,
  height: number,
  zOffset = 0,
): Geom3 {
  const forceRounded = bottom.cornerRadius > 0 || top.cornerRadius > 0;
  const bottomProfile = squareProfile(bottom, forceRounded);
  const topProfile = squareProfile(top, forceRounded);
  const bottomSlice = slice.fromSides(geom2.toSides(bottomProfile));

  return extrudeFromSlices(
    {
      numberOfSlices: 2,
      callback: (progress) => {
        const currentProfile = progress === 0 ? bottomProfile : topProfile;
        return slice.transform(
          mat4.fromTranslation(
            mat4.create(),
            [0, 0, zOffset + height * progress],
          ),
          slice.fromSides(geom2.toSides(currentProfile)),
        );
      },
    },
    bottomSlice,
  );
}

export function createSquareBaseOuterBody(
  profile: SquareBaseProfileSnapshot,
): Geom3 {
  return createTaperedSquareBody(
    {
      width: profile.width,
      depth: profile.depth,
      cornerRadius: profile.cornerRadius,
    },
    getSquareBaseTopDimensions(profile),
    profile.height,
  );
}

export function createSquareBaseBody(
  profile: SquareBaseProfileSnapshot,
): Geom3 {
  const outerBody = createSquareBaseOuterBody(profile);
  const cavity = getSquareBaseCavityDimensions(profile);
  if (
    cavity.depth <= 0
    || cavity.bottom.width <= 0
    || cavity.bottom.depth <= 0
    || cavity.ceiling.width <= 0
    || cavity.ceiling.depth <= 0
  ) {
    return outerBody;
  }
  const cavityBody = createTaperedSquareBody(
    cavity.bottom,
    cavity.ceiling,
    cavity.depth + CAVITY_CUT_EPSILON,
    -CAVITY_CUT_EPSILON,
  );
  return subtract(outerBody, cavityBody);
}
