import { describe, expect, it } from "vitest";
import {
  booleans,
  extrusions,
  measurements,
  transforms,
} from "@jscad/modeling";
import type { Geom2, Geom3 } from "@jscad/modeling/src/geometries/types";
import { measureBoundingBox } from "@jscad/modeling/src/measurements";
import traySteppedCadUserReproFixture from "@/lib/fixtures/tray-stepped-cad-user-repro.json";
import {
  createSteppedCadSplitParts,
  createSteppedCadTrayModel,
} from "@/lib/stepped-cad-tray-model";
import { insetGeom2 } from "@/lib/outline-geometry";
import { buildSteppedCadFeatureGraph } from "@/lib/stepped-cad-feature-graph";
import { jscadToThreeGeometry } from "@/lib/jscad-to-three";
import type { SteppedLayoutParams } from "@/types/custom-tray";

const { subtract, union } = booleans;
const { extrudeLinear } = extrusions;
const { measureVolume } = measurements;
const { rotateZ, translate } = transforms;
const DEG_TO_RAD = Math.PI / 180;
const FEATURE_EPSILON = 0.02;
const GROOVE_INSET = 1;
const MERGED_GROUP_IDS = new Set([
  "e110a00d-a7f7-4537-9c39-6f0c2322d197",
  "7c91d837-1004-4251-a08d-b02723c0b491",
]);

const USER_REPRO_PARAMS =
  traySteppedCadUserReproFixture.params as SteppedLayoutParams;

function buildExpectedMergedPartGeometry(grooveDepth: number) {
  const graph = buildSteppedCadFeatureGraph(USER_REPRO_PARAMS);
  const mergedGroups = graph.groups.filter((group) =>
    MERGED_GROUP_IDS.has(group.groupId),
  );
  const mergedBaseHeight = Math.max(
    0,
    ...graph.groups
      .filter(
        (group) =>
          !MERGED_GROUP_IDS.has(group.groupId) &&
          group.columnHeight < Math.min(...mergedGroups.map((item) => item.columnHeight)),
      )
      .map((group) => group.columnHeight),
  );
  const mergedSolids = mergedGroups.map((group) =>
    translate(
      [0, 0, mergedBaseHeight],
      extrudeLinear(
        { height: group.columnHeight - mergedBaseHeight },
        group.footprint,
      ),
    )
  );
  let mergedBody =
    mergedSolids.length === 1 ? mergedSolids[0] : union(...mergedSolids);

  if (grooveDepth > 0) {
    const mergedHeights = new Set(mergedGroups.map((group) => group.columnHeight));
    const tenonFootprintSource: Geom2 =
      mergedGroups.length === 1
        ? mergedGroups[0].footprint
        : (union(...mergedGroups.map((group) => group.footprint)) as Geom2);
    let tenonFootprint: Geom2 = tenonFootprintSource;
    try {
      tenonFootprint =
        insetGeom2(tenonFootprintSource, GROOVE_INSET) ?? tenonFootprintSource;
    } catch {
      tenonFootprint = tenonFootprintSource;
    }
    const tenon = translate(
      [0, 0, mergedBaseHeight - grooveDepth],
      extrudeLinear(
        { height: grooveDepth + FEATURE_EPSILON },
        tenonFootprint,
      ),
    );
    mergedBody = union(mergedBody, tenon);

    const pocketFootprints = new Map<number, Geom2>();
    for (const group of graph.groups.filter((item) => !MERGED_GROUP_IDS.has(item.groupId))) {
      const groupBaseHeight = Math.max(
        0,
        ...graph.groups
          .filter(
            (candidate) =>
              candidate.groupId !== group.groupId &&
              candidate.columnHeight < group.columnHeight,
          )
          .map((candidate) => candidate.columnHeight),
      );
      if (!mergedHeights.has(groupBaseHeight)) {
        continue;
      }

      const existing = pocketFootprints.get(groupBaseHeight);
      pocketFootprints.set(
        groupBaseHeight,
        existing ? (union(existing, group.footprint) as Geom2) : group.footprint,
      );
    }

    for (const [interfaceHeight, pocketFootprintSource] of pocketFootprints.entries()) {
      let pocketFootprint: Geom2 = pocketFootprintSource;
      try {
        pocketFootprint =
          insetGeom2(pocketFootprintSource, GROOVE_INSET) ?? pocketFootprintSource;
      } catch {
        pocketFootprint = pocketFootprintSource;
      }
      const pocketDepth = Math.min(grooveDepth, interfaceHeight - mergedBaseHeight);
      const pocket = translate(
        [0, 0, interfaceHeight - pocketDepth],
        extrudeLinear(
          { height: pocketDepth + FEATURE_EPSILON },
          pocketFootprint,
        ),
      );
      mergedBody = subtract(mergedBody, pocket);
    }
  }

  const mergedSlotHoles = graph.slotHoles
    .filter((slotHole) => MERGED_GROUP_IDS.has(slotHole.groupId))
    .map((slotHole) =>
      translate(
        [slotHole.cx, slotHole.cy, slotHole.topHeight - slotHole.depth],
        rotateZ(
          slotHole.rotation * DEG_TO_RAD,
          extrudeLinear(
            { height: slotHole.depth + FEATURE_EPSILON },
            slotHole.profile,
          ),
        ),
      )
    );

  return mergedSlotHoles.length > 0
    ? subtract(mergedBody, ...mergedSlotHoles)
    : mergedBody;
}

function expectGeometryRoughlyMatches(actual: Geom3, expected: Geom3) {
  expect(
    Math.abs(measureVolume(actual) - measureVolume(expected)),
  ).toBeLessThan(10);

  const actualBounds = measureBoundingBox(actual);
  const expectedBounds = measureBoundingBox(expected);

  expect(Math.abs(actualBounds[0][0] - expectedBounds[0][0])).toBeLessThan(0.01);
  expect(Math.abs(actualBounds[0][1] - expectedBounds[0][1])).toBeLessThan(0.01);
  expect(Math.abs(actualBounds[0][2] - expectedBounds[0][2])).toBeLessThan(0.01);
  expect(Math.abs(actualBounds[1][0] - expectedBounds[1][0])).toBeLessThan(0.01);
  expect(Math.abs(actualBounds[1][1] - expectedBounds[1][1])).toBeLessThan(0.01);
  expect(Math.abs(actualBounds[1][2] - expectedBounds[1][2])).toBeLessThan(0.01);
}

function expectBoundsRoughlyMatch(actual: Geom3, expected: Geom3) {
  const actualBounds = measureBoundingBox(actual);
  const expectedBounds = measureBoundingBox(expected);

  expect(Math.abs(actualBounds[0][0] - expectedBounds[0][0])).toBeLessThan(0.01);
  expect(Math.abs(actualBounds[0][1] - expectedBounds[0][1])).toBeLessThan(0.01);
  expect(Math.abs(actualBounds[0][2] - expectedBounds[0][2])).toBeLessThan(0.01);
  expect(Math.abs(actualBounds[1][0] - expectedBounds[1][0])).toBeLessThan(0.01);
  expect(Math.abs(actualBounds[1][1] - expectedBounds[1][1])).toBeLessThan(0.01);
  expect(Math.abs(actualBounds[1][2] - expectedBounds[1][2])).toBeLessThan(0.01);
}

function findMergedPart(grooveDepth: number) {
  return createSteppedCadSplitParts({
    ...USER_REPRO_PARAMS,
    splitGrooveDepth: grooveDepth,
  }).find(
    (part) =>
      part.label.includes("组 2") &&
      part.label.includes("组 4") &&
      part.fromHeight === 10 &&
      part.toHeight === 35,
  );
}

describe("stepped cad user repro", { timeout: 15000 }, () => {
  it("keeps the complex CAD main tray convertible when magnetic holes are enabled", () => {
    const plainModel = createSteppedCadTrayModel({
      ...USER_REPRO_PARAMS,
      enableBaseHole: false,
    });
    const magnetModel = createSteppedCadTrayModel({
      ...USER_REPRO_PARAMS,
      enableBaseHole: true,
    });

    expect(measureVolume(magnetModel)).toBeLessThan(measureVolume(plainModel));
    expect(() => jscadToThreeGeometry(magnetModel)).not.toThrow();
  });

  it("converts split parts from the user repro without closed-geometry errors", () => {
    const parts = createSteppedCadSplitParts(USER_REPRO_PARAMS);

    expect(parts.length).toBeGreaterThan(0);
    for (const part of parts) {
      expect(() => jscadToThreeGeometry(part.geometry)).not.toThrow();
    }
  });

  it("changes split geometry when the groove depth changes", () => {
    const plainParts = createSteppedCadSplitParts({
      ...USER_REPRO_PARAMS,
      splitGrooveDepth: 0,
    });
    const groovedParts = createSteppedCadSplitParts({
      ...USER_REPRO_PARAMS,
      splitGrooveDepth: 2,
    });

    expect(plainParts).toHaveLength(groovedParts.length);

    const highestPlainPart = [...plainParts].sort(
      (left, right) => right.toHeight - left.toHeight,
    )[0];
    const highestGroovedPart = [...groovedParts].sort(
      (left, right) => right.toHeight - left.toHeight,
    )[0];

    const [[, , plainMinZ]] = measureBoundingBox(highestPlainPart.geometry);
    const [[, , groovedMinZ]] = measureBoundingBox(highestGroovedPart.geometry);

    expect(groovedMinZ).toBeLessThan(plainMinZ);
  });

  it("rebuilds merged split groups as one unified body using whole-model geometry semantics", () => {
    const plainParts = createSteppedCadSplitParts({
      ...USER_REPRO_PARAMS,
      splitGrooveDepth: 0,
    });
    const mergedPart = findMergedPart(0);

    expect(plainParts).toHaveLength(3);
    expect(mergedPart).toBeDefined();
    expect(mergedPart?.fromHeight).toBe(10);
    expect(mergedPart?.toHeight).toBe(35);

    expectGeometryRoughlyMatches(
      mergedPart!.geometry,
      buildExpectedMergedPartGeometry(0),
    );
  });

  it("builds merged split group bottom tenons from the unified merged footprint", () => {
    const mergedPart = findMergedPart(2);

    expect(mergedPart).toBeDefined();
    expect(mergedPart?.fromHeight).toBe(10);
    expect(mergedPart?.toHeight).toBe(35);

    expectBoundsRoughlyMatch(
      mergedPart!.geometry,
      buildExpectedMergedPartGeometry(2),
    );
  });
});
