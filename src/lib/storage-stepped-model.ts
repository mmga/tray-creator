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
import generalizeModule from "@jscad/modeling/src/operations/modifiers/generalize";
import type { Vec3 } from "@jscad/modeling/src/maths/types";
import { RENDER_CONFIG } from "@/lib/config";
import { createOffsetSlotShape } from "@/lib/model-utils";
import { subtractBaseHoleConstructionPlan } from "@/lib/model-utils";
import { getFreeSlotProfileGeometry } from "@/lib/slot-definitions";
import {
  STORAGE_STEPPED_BODY_PART_ID,
  STORAGE_STEPPED_LIMITS,
  storageSteppedTrayPartId,
} from "@/lib/storage-stepped-config";
import {
  createStorageSteppedTrayBaseHolePlan,
  getStorageSteppedBaseHoleBlockingReason,
  getStorageSteppedTrayRequiredSupportingThickness,
} from "@/lib/storage-stepped-base-hole";
import {
  deriveStorageSteppedPlan,
  getStorageSteppedTrayAssemblyOffset,
} from "@/lib/storage-stepped-plan";
import type { StorageSteppedParams } from "@/types/storage-stepped";

const { subtract } = booleans;
const { geom2, geom3, poly3 } = geometries;
const { mat4 } = maths;
const { measureBoundingBox, measureVolume } = measurements;
const { cuboid, cylinder } = primitives;
const { extrudeFromSlices, extrudeLinear, slice } = extrusions;
const { rotateY, rotateZ, transform, translate } = transforms;

const DEG_TO_RAD = Math.PI / 180;
const BOOLEAN_OVERLAP = 0.5;
const REPAIR_KEY_SCALE = 1e5;

const generalize = generalizeModule as unknown as (
  options: { snap: boolean; triangulate: boolean },
  geometry: Geom3,
) => Geom3;

interface DirectedEdge {
  a: Vec3;
  b: Vec3;
  key: string;
}

function vertexKey(vertex: Vec3 | number[]): string {
  return vertex.map((value) => Math.round(value * REPAIR_KEY_SCALE)).join(",");
}

/**
 * 补齐 JSCAD 布尔在圆柱与开口/凹槽交角处留下的微小三角形缺口。
 *
 * 先做与 STL 导出相同的 T 形接点补齐和三角化；若仍存在由 3 条未配对有向边
 * 组成的闭合环，按相反绕序补一个三角形。缺口的面积在 1e-3 mm² 量级，
 * 不改变标称尺寸，只是把布尔内核的数值碎片补成闭合网格。
 */
export function finalizeStorageSteppedGeometry(geometry: Geom3): Geom3 {
  const generalized = generalize({ snap: true, triangulate: true }, geometry);
  const polygons = geom3.toPolygons(generalized);
  const directed = new Map<string, DirectedEdge>();
  polygons.forEach((polygon) => {
    const vertices = polygon.vertices;
    for (let index = 0; index < vertices.length; index += 1) {
      const a = vertices[index];
      const b = vertices[(index + 1) % vertices.length];
      const start = vertexKey(a);
      const end = vertexKey(b);
      if (start === end) continue;
      directed.set(`${start}|${end}`, { a, b, key: `${start}|${end}` });
    }
  });

  const matched = new Set<string>();
  for (const key of directed.keys()) {
    if (matched.has(key)) continue;
    const [start, end] = key.split("|");
    const reverse = `${end}|${start}`;
    if (directed.has(reverse)) {
      matched.add(key);
      matched.add(reverse);
    }
  }
  const unmatched = [...directed.values()].filter((edge) => !matched.has(edge.key));
  if (unmatched.length === 0) return generalized;

  const byStart = new Map<string, DirectedEdge[]>();
  for (const edge of unmatched) {
    const start = edge.key.split("|")[0];
    const bucket = byStart.get(start);
    if (bucket) bucket.push(edge);
    else byStart.set(start, [edge]);
  }

  const used = new Set<string>();
  const patches: Vec3[][] = [];
  for (const edge of unmatched) {
    if (used.has(edge.key)) continue;
    const loop: DirectedEdge[] = [edge];
    used.add(edge.key);
    let current = edge.b;
    let closed = false;
    while (loop.length <= 3) {
      const next = (byStart.get(vertexKey(current)) ?? []).find(
        (candidate) => !used.has(candidate.key),
      );
      if (!next) break;
      used.add(next.key);
      loop.push(next);
      if (vertexKey(next.b) === vertexKey(loop[0].a)) {
        closed = true;
        break;
      }
      current = next.b;
    }
    if (closed && loop.length === 3) {
      // 已有边界为 a→b→c→a，补面需要相反绕序。
      patches.push([loop[0].a, loop[2].a, loop[1].a]);
    }
  }
  if (patches.length === 0) return generalized;
  return geom3.create([
    ...polygons,
    ...patches.map((vertices) => poly3.create(vertices)),
  ]);
}

export interface StorageSteppedPartModel {
  partId: string;
  geometry: Geom3;
  volume: number;
  /** 装配坐标中的零件原点；打印几何仍以底面 Z=0 为原点。 */
  assemblyOffset: [number, number, number];
}

/**
 * 主体坐标：X 左右居中、Y 前后居中、Z 向上，底面 Z=0。
 * 编辑与参数推导使用“前缘 Y=0”坐标系，这里只做一次平移转换。
 */
function toCenteredY(planBodyDepth: number, y: number): number {
  return y - planBodyDepth / 2;
}

function rectangleSlice(width: number, depth: number) {
  const rectangle = geom2.fromPoints([
    [-width / 2, -depth / 2],
    [width / 2, -depth / 2],
    [width / 2, depth / 2],
    [-width / 2, depth / 2],
  ]);
  return slice.fromSides(geom2.toSides(rectangle));
}

/**
 * 从阶梯侧面轮廓沿宽度挤出连续主体。
 *
 * 直接拼接三个盒体会在共面处留下内部面；侧面轮廓挤出后，
 * 三个台阶属于同一张外壳，再统一切出仓腔、安装口和指扣。
 */
export function createStorageSteppedBodyModel(
  params: StorageSteppedParams,
): Geom3 {
  const plan = deriveStorageSteppedPlan(params);
  if (plan.steps.length === 0) {
    throw new Error("主体至少需要一个台阶");
  }
  const width = plan.bodyWidth;
  const depth = plan.bodyDepth;
  const front = -depth / 2;
  const back = depth / 2;
  const moduleDepth = plan.interface.moduleDepth;

  // 侧面轮廓（u=Y，v=Z），逆时针方向；从底边前缘出发。
  const profilePoints: Array<[number, number]> = [[front, 0], [back, 0]];
  for (let index = plan.steps.length - 1; index >= 0; index -= 1) {
    const deckHeight = plan.steps[index].deckHeight;
    const moduleFront = front + index * moduleDepth;
    profilePoints.push([back - (plan.steps.length - 1 - index) * moduleDepth, deckHeight]);
    profilePoints.push([moduleFront, deckHeight]);
  }

  const prism = extrudeLinear(
    { height: width },
    geom2.fromPoints(profilePoints),
  );

  // (u, v, w) → (w − W/2, u, v)：把挤出方向换成 X，并让宽度居中。
  const body = transform(
    mat4.fromValues(
      0, 1, 0, 0,
      0, 0, 1, 0,
      1, 0, 0, 0,
      -width / 2, 0, 0, 1,
    ),
    prism,
  );

  const cavityOpenings: Geom3[] = [];
  const fingerPulls: Geom3[] = [];
  for (const step of plan.steps) {
    const moduleFront = front + step.index * moduleDepth;
    const cavityWidth = plan.interface.bodyWidth - 2 * plan.interface.lowerWallThickness;
    const cavityDepth = moduleDepth - 2 * plan.interface.lowerWallThickness;
    const cavityHeight =
      step.cavity.maxZ - step.cavity.minZ + BOOLEAN_OVERLAP;
    cavityOpenings.push(
      translate(
        [
          0,
          toCenteredY(depth, (step.cavity.minY + step.cavity.maxY) / 2),
          step.cavity.minZ + cavityHeight / 2,
        ],
        cuboid({ size: [cavityWidth, cavityDepth, cavityHeight] }),
      ),
    );

    const openingWidth = plan.interface.bodyWidth - 2 * plan.interface.rimThickness;
    const openingDepth = moduleDepth - 2 * plan.interface.rimThickness;
    const openingBottom = step.opening.minZ;
    const openingHeight = step.opening.maxZ - openingBottom + BOOLEAN_OVERLAP;
    cavityOpenings.push(
      translate(
        [
          0,
          moduleFront + plan.interface.rimThickness + openingDepth / 2,
          openingBottom + openingHeight / 2,
        ],
        cuboid({ size: [openingWidth, openingDepth, openingHeight] }),
      ),
    );

    // 指扣：只在对应侧壁厚度范围内切削，避免误切内部结构。
    for (const pull of step.fingerPulls) {
      const wallThickness = plan.interface.lowerWallThickness;
      // 内侧端面伸入仓腔 0.5mm，避免与仓壁共面造成布尔碎片。
      const cutterLength = wallThickness + 1.5;
      const sideSign = pull.side === "left" ? -1 : 1;
      const centerX = sideSign * (width / 2 - (wallThickness - 0.5) / 2);
      fingerPulls.push(
        translate(
          [
            centerX,
            toCenteredY(depth, pull.centerY),
            pull.centerZ,
          ],
          rotateY(
            Math.PI / 2,
            rotateZ(
              Math.PI / RENDER_CONFIG.cylinderSegments,
              cylinder({
                radius: pull.radius,
                height: cutterLength,
                segments: RENDER_CONFIG.cylinderSegments,
              }),
            ),
          ),
        ),
      );
    }
  }

  const hollowed = cavityOpenings.length > 0
    ? subtract(body, ...cavityOpenings)
    : body;
  const notched = fingerPulls.length > 0
    ? subtract(hollowed, ...fingerPulls)
    : hollowed;
  return finalizeStorageSteppedGeometry(notched);
}

function createTrayOutlineSlice(
  width: number,
  depth: number,
  z: number,
) {
  const baseSlice = rectangleSlice(width, depth);
  return slice.transform(
    mat4.fromTranslation(mat4.create(), [0, 0, z]),
    baseSlice,
  );
}

function createStorageSteppedTrayBody(
  width: number,
  depth: number,
  thickness: number,
  chamferRetreat: number,
  chamferAngle: number,
): Geom3 {
  const safeRetreat = Math.max(0, Math.min(chamferRetreat, width / 2, depth / 2));
  const angle = Math.min(89.9, Math.max(1, chamferAngle));
  const chamferHeight = safeRetreat > 0
    ? Math.min(safeRetreat / Math.tan(angle * DEG_TO_RAD), thickness)
    : 0;

  if (chamferHeight <= 1e-9) {
    return translate(
      [0, 0, thickness / 2],
      cuboid({ size: [width, depth, thickness] }),
    );
  }

  return extrudeFromSlices(
    {
      numberOfSlices: 3,
      callback: (_progress, index) => {
        const z = index === 0 ? 0 : index === 1 ? chamferHeight : thickness;
        const retreat = index === 0 ? safeRetreat : 0;
        return createTrayOutlineSlice(
          width - retreat * 2,
          depth - retreat * 2,
          z,
        );
      },
    },
    rectangleSlice(width - safeRetreat * 2, depth - safeRetreat * 2),
  );
}

function createTrayGrooveCutters(
  params: StorageSteppedParams,
  stepIndex: number,
  trayWidth: number,
  trayDepth: number,
  trayThickness: number,
): Geom3[] {
  const tray = params.trays.find((candidate) => candidate.stepIndex === stepIndex);
  if (!tray) {
    throw new Error(`找不到第 ${stepIndex + 1} 阶托盘配置`);
  }
  const { min, max } = STORAGE_STEPPED_LIMITS.holeDepth;
  if (!(tray.holeDepth >= min && tray.holeDepth <= max)) {
    throw new Error(`第 ${stepIndex + 1} 阶槽深必须在 ${min}–${max}mm 之间`);
  }

  const halfWidth = trayWidth / 2;
  const halfDepth = trayDepth / 2;
  return tray.slots.map((slot) => {
    const profile = getFreeSlotProfileGeometry(slot);
    const shape: Geom2 = createOffsetSlotShape(
      profile.width,
      profile.height,
      slot.shape,
      profile.outerOffset,
      profile.profileExponent,
    );
    const cutter = extrudeLinear(
      { height: tray.holeDepth + 0.02 },
      rotateZ((slot.rotation || 0) * DEG_TO_RAD, shape),
    );
    return translate(
      [
        slot.x - halfWidth,
        slot.y - halfDepth,
        trayThickness - tray.holeDepth,
      ],
      cutter,
    );
  });
}

/** 单块托盘：固定总厚度、底部倒角、槽位与可选底孔。 */
export function createStorageSteppedTrayModel(
  params: StorageSteppedParams,
  stepIndex: number,
): Geom3 {
  const plan = deriveStorageSteppedPlan(params);
  const tray = params.trays.find((candidate) => candidate.stepIndex === stepIndex);
  if (!tray) {
    throw new Error(`找不到第 ${stepIndex + 1} 阶托盘配置`);
  }

  const body = createStorageSteppedTrayBody(
    plan.trayWidth,
    plan.trayDepth,
    plan.trayThickness,
    plan.interface.trayBottomChamfer,
    plan.interface.trayChamferAngle,
  );
  const grooves = createTrayGrooveCutters(
    params,
    stepIndex,
    plan.trayWidth,
    plan.trayDepth,
    plan.trayThickness,
  );
  const withGrooves = grooves.length > 0 ? subtract(body, ...grooves) : body;

  const requiredThickness = getStorageSteppedTrayRequiredSupportingThickness(tray);
  const floorThickness = plan.trayThickness - tray.holeDepth;
  if (requiredThickness > 0 && floorThickness < requiredThickness - 1e-6) {
    throw new Error(
      `第 ${stepIndex + 1} 阶托盘槽底仅 ${floorThickness.toFixed(1)}mm，` +
        `无法容纳需要 ${requiredThickness.toFixed(1)}mm 底壁的底孔`,
    );
  }
  const baseHolePlan = createStorageSteppedTrayBaseHolePlan(
    tray,
    plan.trayWidth,
    plan.trayDepth,
    plan.trayThickness,
  );
  const blockingReason = getStorageSteppedBaseHoleBlockingReason(baseHolePlan);
  if (blockingReason) {
    throw new Error(`第 ${stepIndex + 1} 阶托盘${blockingReason}`);
  }
  return finalizeStorageSteppedGeometry(
    subtractBaseHoleConstructionPlan(withGrooves, baseHolePlan),
  );
}

/** 零件装配位移（主体坐标系）。托盘几何为打印坐标，底面 Z=0。 */
export function getStorageSteppedAssemblyOffset(
  params: StorageSteppedParams,
  partId: string,
): [number, number, number] {
  const plan = deriveStorageSteppedPlan(params);
  if (partId === STORAGE_STEPPED_BODY_PART_ID) {
    return [0, 0, 0];
  }
  const stepIndex = parseStorageSteppedTrayPartId(partId);
  if (stepIndex === null || stepIndex >= plan.steps.length) {
    throw new Error(`未知零件身份：${partId}`);
  }
  return getStorageSteppedTrayAssemblyOffset(plan, stepIndex);
}

export function parseStorageSteppedTrayPartId(partId: string): number | null {
  const match = /^tray-(\d+)$/.exec(partId);
  if (!match) return null;
  const stepNumber = Number(match[1]);
  return Number.isInteger(stepNumber) && stepNumber > 0 ? stepNumber - 1 : null;
}

export function createStorageSteppedPartModel(
  params: StorageSteppedParams,
  partId: string,
): StorageSteppedPartModel {
  const geometry = partId === STORAGE_STEPPED_BODY_PART_ID
    ? createStorageSteppedBodyModel(params)
    : (() => {
        const stepIndex = parseStorageSteppedTrayPartId(partId);
        if (stepIndex === null) throw new Error(`未知零件身份：${partId}`);
        return createStorageSteppedTrayModel(params, stepIndex);
      })();
  return {
    partId,
    geometry,
    volume: measureVolume(geometry),
    assemblyOffset: getStorageSteppedAssemblyOffset(params, partId),
  };
}

/** 全部零件的打印几何；按主体、第一阶、第二阶、第三阶顺序。 */
export function createStorageSteppedPartModels(
  params: StorageSteppedParams,
): StorageSteppedPartModel[] {
  const plan = deriveStorageSteppedPlan(params);
  const partIds = [
    STORAGE_STEPPED_BODY_PART_ID,
    ...Array.from({ length: plan.steps.length }, (_, index) =>
      storageSteppedTrayPartId(index),
    ),
  ];
  return partIds.map((partId) => createStorageSteppedPartModel(params, partId));
}

/** 主体外尺寸，用于检查与参数推导是否一致。 */
export function measureStorageSteppedBody(
  params: StorageSteppedParams,
): { min: [number, number, number]; max: [number, number, number] } {
  const [min, max] = measureBoundingBox(createStorageSteppedBodyModel(params));
  return {
    min: [min[0], min[1], min[2]],
    max: [max[0], max[1], max[2]],
  };
}
