import {
  booleans,
  geometries,
  primitives,
  transforms,
} from "@jscad/modeling";
import type { Geom2 } from "@jscad/modeling/src/geometries/types";
import { RENDER_CONFIG } from "@/lib/config";
import {
  generateOutlineGeom2,
  insetGeom2,
  type OutlineCircle,
} from "@/lib/outline-geometry";
import { sampleSlotProfilePoints } from "@/lib/slot-profile-geometry";
import type { ConnectivityCircle } from "@/lib/stepped-connectivity";
import type { FreeSlot } from "@/types/custom-tray";

const { union } = booleans;
const { geom2 } = geometries;
const { circle } = primitives;
const { rotateZ, translate } = transforms;
const DEG_TO_RAD = Math.PI / 180;

export interface SteppedFootprintSlot {
  id: string;
  cx: number;
  cy: number;
  rotation: number;
  shape: FreeSlot["shape"];
  profile: {
    width: number;
    height: number;
    outerOffset: number;
    profileExponent?: number;
  };
}

function createOffsetProfileShape(
  slot: SteppedFootprintSlot,
  offset: number,
): Geom2 {
  const points = sampleSlotProfilePoints(
    slot.profile.width,
    slot.profile.height,
    slot.shape,
    offset,
    RENDER_CONFIG.cylinderSegments,
    slot.profile.profileExponent,
  ).map((point): [number, number] => [point.x, point.y]);
  return geom2.fromPoints(points);
}

function buildProfileClusterFootprint(
  cluster: ConnectivityCircle[],
  slotsById: ReadonlyMap<string, SteppedFootprintSlot>,
  spacing: number,
  smoothingRadius: number,
): Geom2 | null {
  const clampedSmoothing = Math.max(0, smoothingRadius);
  const buildParts = (extraOffset: number) => cluster
    .map((connectivity) => slotsById.get(connectivity.id))
    .filter((item): item is SteppedFootprintSlot => Boolean(item))
    .map((item) => {
      const profile = createOffsetProfileShape(
        item,
        item.profile.outerOffset + spacing + extraOffset,
      );
      return translate(
        [item.cx, item.cy],
        rotateZ(item.rotation * DEG_TO_RAD, profile),
      ) as Geom2;
    });

  const parts = buildParts(clampedSmoothing);
  if (parts.length === 0) {
    return null;
  }

  const expanded = parts.length === 1 ? parts[0] : union(...parts);
  if (clampedSmoothing <= 0) {
    return expanded;
  }

  const smoothed = insetGeom2(
    expanded,
    clampedSmoothing,
    RENDER_CONFIG.cylinderSegments,
  );
  if (smoothed) {
    return smoothed;
  }

  const fallbackParts = buildParts(0);
  return fallbackParts.length === 1
    ? fallbackParts[0]
    : union(...fallbackParts);
}

function buildCircularClusterFootprint(
  cluster: ConnectivityCircle[],
  smoothingRadius: number,
): Geom2 | null {
  const outline = generateOutlineGeom2(
    cluster.map(
      (item): OutlineCircle => ({
        cx: item.cx,
        cy: item.cy,
        rOuter: item.rOuter,
      }),
    ),
    smoothingRadius,
    RENDER_CONFIG.cylinderSegments,
  );
  if (outline) {
    return outline;
  }

  const parts = cluster.map((item) =>
    translate(
      [item.cx, item.cy],
      circle({
        radius: item.rOuter,
        segments: RENDER_CONFIG.cylinderSegments,
      }),
    ) as Geom2,
  );
  return parts.length === 0
    ? null
    : parts.length === 1
      ? parts[0]
      : union(...parts);
}

export function buildSteppedClusterFootprint(
  cluster: ConnectivityCircle[],
  slotsById: ReadonlyMap<string, SteppedFootprintSlot>,
  spacing: number,
  smoothingRadius: number,
): Geom2 | null {
  const containsEllipse = cluster.some(
    (item) => slotsById.get(item.id)?.shape === "ellipse",
  );
  return containsEllipse
    ? buildProfileClusterFootprint(
        cluster,
        slotsById,
        spacing,
        smoothingRadius,
      )
    : buildCircularClusterFootprint(cluster, smoothingRadius);
}
