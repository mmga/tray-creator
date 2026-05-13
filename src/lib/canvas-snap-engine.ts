import type { FreeSlot } from "@/types/custom-tray";
import type { CanvasGuideLine, CanvasPoint } from "./canvas-types";
import { getEllipseBoundingBox } from "./canvas-slot-geometry";
import { getFreeSlotProfileGeometry } from "@/lib/slot-definitions";

const SNAP_THRESHOLD = 1.5;
const SNAP_STEP = 0.2;

type CanvasSnapSlot = Pick<
  FreeSlot,
  | "id"
  | "x"
  | "y"
  | "width"
  | "height"
  | "rotation"
  | "shape"
  | "slotWidth"
  | "slotHeight"
  | "outerOffset"
  | "profileExponent"
>;

export interface CanvasDragSnapResult {
  finalX: number;
  finalY: number;
  guides: CanvasGuideLine[];
}

interface SnapCandidate {
  target: number;
  guide: number;
  distance: number;
}

interface CalculateCanvasDragSnapOptions<TSlot extends CanvasSnapSlot> {
  draggingSlotId: string;
  slots: ReadonlyArray<TSlot>;
  dragOrigins: ReadonlyMap<string, CanvasPoint>;
  trayWidth: number;
  trayDepth: number;
  currentMouse: CanvasPoint;
  startMouse: CanvasPoint;
  ellipseProfileExponent?: number;
}

function roundToStep(value: number) {
  return Math.round(value / SNAP_STEP) * SNAP_STEP;
}

export function calculateCanvasDragSnap<TSlot extends CanvasSnapSlot>({
  draggingSlotId,
  slots,
  dragOrigins,
  trayWidth,
  trayDepth,
  currentMouse,
  startMouse,
  ellipseProfileExponent,
}: CalculateCanvasDragSnapOptions<TSlot>): CanvasDragSnapResult | null {
  const draggingOrigin = dragOrigins.get(draggingSlotId);
  const draggingSlot = slots.find((slot) => slot.id === draggingSlotId);
  if (!draggingOrigin || !draggingSlot) {
    return null;
  }

  const totalSvgDeltaX = currentMouse.x - startMouse.x;
  const totalPhysicalDeltaX = totalSvgDeltaX;
  const totalPhysicalDeltaY = -(currentMouse.y - startMouse.y);

  const proposedX = roundToStep(draggingOrigin.x + totalPhysicalDeltaX);
  const proposedY = roundToStep(draggingOrigin.y + totalPhysicalDeltaY);
  const dragProfile = getFreeSlotProfileGeometry(draggingSlot);
  const dragBounds = getEllipseBoundingBox(
    dragProfile.width,
    dragProfile.height,
    draggingSlot.rotation,
    draggingSlot.shape,
    dragProfile.profileExponent ?? ellipseProfileExponent,
    dragProfile.outerOffset,
  );

  let finalX = proposedX;
  let finalY = proposedY;
  let bestXSnap: SnapCandidate | null = null;
  let bestYSnap: SnapCandidate | null = null;

  const considerXSnap = (target: number, guide: number) => {
    const distance = Math.abs(proposedX - target);
    if (distance >= SNAP_THRESHOLD) {
      return;
    }

    if (!bestXSnap || distance < bestXSnap.distance) {
      bestXSnap = { target, guide, distance };
    }
  };

  const considerYSnap = (target: number, guide: number) => {
    const distance = Math.abs(proposedY - target);
    if (distance >= SNAP_THRESHOLD) {
      return;
    }

    if (!bestYSnap || distance < bestYSnap.distance) {
      bestYSnap = { target, guide, distance };
    }
  };

  for (const other of slots) {
    if (dragOrigins.has(other.id)) {
      continue;
    }

    const otherProfile = getFreeSlotProfileGeometry(other);
    const otherBounds = getEllipseBoundingBox(
      otherProfile.width,
      otherProfile.height,
      other.rotation,
      other.shape,
      otherProfile.profileExponent ?? ellipseProfileExponent,
      otherProfile.outerOffset,
    );

    considerXSnap(other.x, other.x);
    considerXSnap(
      other.x - otherBounds.halfW + dragBounds.halfW,
      other.x - otherBounds.halfW,
    );
    considerXSnap(
      other.x + otherBounds.halfW - dragBounds.halfW,
      other.x + otherBounds.halfW,
    );

    considerYSnap(other.y, other.y);
    considerYSnap(
      other.y - otherBounds.halfH + dragBounds.halfH,
      other.y - otherBounds.halfH,
    );
    considerYSnap(
      other.y + otherBounds.halfH - dragBounds.halfH,
      other.y + otherBounds.halfH,
    );
  }

  considerXSnap(trayWidth / 2, trayWidth / 2);
  considerYSnap(trayDepth / 2, trayDepth / 2);

  const guides: CanvasGuideLine[] = [];
  const resolvedXSnap = bestXSnap as SnapCandidate | null;
  if (resolvedXSnap !== null) {
    finalX = resolvedXSnap.target;
    guides.push({ axis: "x", value: resolvedXSnap.guide });
  }

  const resolvedYSnap = bestYSnap as SnapCandidate | null;
  if (resolvedYSnap !== null) {
    finalY = resolvedYSnap.target;
    guides.push({ axis: "y", value: trayDepth - resolvedYSnap.guide });
  }

  return {
    finalX,
    finalY,
    guides,
  };
}
