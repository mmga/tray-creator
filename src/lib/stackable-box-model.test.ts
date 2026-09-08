import { describe, expect, it } from "vitest";
import {
  booleans,
  geometries,
  measurements,
  primitives,
  transforms,
} from "@jscad/modeling";
import {
  composeBoxAndLidPreview,
  createBoxSideBySidePreviewSpacing,
  createStackableBoxBody,
  createStackableBoxLid,
} from "@/lib/stackable-box-model";
import { STACKABLE_BOX_SPECS } from "@/lib/stackable-box";

const { intersect } = booleans;
const { cuboid } = primitives;
const { translate } = transforms;
const { measureBoundingBox, measureVolume } = measurements;
const { geom3 } = geometries;

const W = 200;
const D = 150;
const H = 50;
const TRAY_TOP_Z = 6;
const CLEARANCE = 0.4;

function createBody(
  overrides: Partial<Parameters<typeof createStackableBoxBody>[0]> = {},
) {
  return createStackableBoxBody({
    outerWidth: W,
    outerDepth: D,
    outerHeight: H,
    trayTopZ: TRAY_TOP_Z,
    xyFitClearance: CLEARANCE,
    ...overrides,
  });
}

function createLid(
  overrides: Partial<Parameters<typeof createStackableBoxLid>[0]> = {},
) {
  return createStackableBoxLid({
    outerWidth: W,
    outerDepth: D,
    lidThickness: 2.4,
    xyFitClearance: CLEARANCE,
    ...overrides,
  });
}

function pointsAtZ(model: ReturnType<typeof createStackableBoxBody>, z: number) {
  return geom3
    .toPoints(model)
    .flat()
    .filter((point) => Math.abs(point[2] - z) < 1e-5);
}

function maxAbsXAtZ(model: ReturnType<typeof createStackableBoxBody>, z: number) {
  const points = pointsAtZ(model, z);
  return Math.max(...points.map((point) => Math.abs(point[0])));
}

function probe(model: ReturnType<typeof createStackableBoxBody>, x: number, z: number) {
  return measureVolume(
    intersect(
      model,
      cuboid({ center: [x, 0, z], size: [0.1, 10, 0.1] }),
    ),
  );
}

describe("stackable box body", () => {
  it("matches the user outer dimensions within tolerance", () => {
    const [[minX, minY, minZ], [maxX, maxY, maxZ]] = measureBoundingBox(createBody());

    expect(maxX - minX).toBeCloseTo(W, 2);
    expect(maxY - minY).toBeCloseTo(D, 2);
    expect(maxZ - minZ).toBeCloseTo(H, 2);
  });

  it("has a strictly positive volume", () => {
    expect(measureVolume(createBody())).toBeGreaterThan(0);
  });

  it("uses the configured guide height and keeps the bottom guide inset", () => {
    const guideH = STACKABLE_BOX_SPECS.guideChamferHeight;
    const bottomInset = STACKABLE_BOX_SPECS.topRimWidth + CLEARANCE;
    const shoulderInset =
      STACKABLE_BOX_SPECS.topRimWidth - guideH + CLEARANCE;

    expect(maxAbsXAtZ(createBody(), 0)).toBeCloseTo(W / 2 - bottomInset, 1);
    expect(probe(createBody(), W / 2 - shoulderInset + 0.05, guideH - 0.05))
      .toBeCloseTo(0, 3);
    expect(probe(createBody(), W / 2 - shoulderInset - 0.05, guideH - 0.05))
      .toBeGreaterThan(0);
    expect(maxAbsXAtZ(createBody(), guideH)).toBeCloseTo(W / 2, 1);
  });

  it("has a continuous horizontal shoulder above the guide", () => {
    const guideH = STACKABLE_BOX_SPECS.guideChamferHeight;
    const innerShoulderX =
      W / 2 -
      (STACKABLE_BOX_SPECS.topRimWidth - guideH + CLEARANCE / 2);

    expect(probe(createBody(), innerShoulderX, guideH + 0.05)).toBeGreaterThan(0);
    expect(probe(createBody(), W / 2 - 1, guideH - 0.05)).toBeCloseTo(0, 3);
  });

  it("forms a top inner chamfer from the rim inset to the opening inset", () => {
    const probeX = (inset: number) => W / 2 - inset;
    const topZ = H - 0.05;
    const bottomZ = H - STACKABLE_BOX_SPECS.guideChamferHeight + 0.05;
    expect(probe(createBody(), probeX(STACKABLE_BOX_SPECS.topRimWidth - STACKABLE_BOX_SPECS.guideChamferHeight - 0.3), topZ))
      .toBeGreaterThan(0);
    expect(probe(createBody(), probeX(STACKABLE_BOX_SPECS.topRimWidth - STACKABLE_BOX_SPECS.guideChamferHeight + 0.3), topZ))
      .toBeCloseTo(0, 3);
    expect(probe(createBody(), probeX(STACKABLE_BOX_SPECS.topRimWidth + 0.1), bottomZ))
      .toBeCloseTo(0, 3);
  });

  it("uses a 2mm wall and a printable sloped transition below the widened opening", () => {
    const transitionH = STACKABLE_BOX_SPECS.topTransitionHeight;
    const transitionStartZ =
      H - STACKABLE_BOX_SPECS.guideChamferHeight - transitionH;
    const midZ = transitionStartZ + transitionH / 2;
    const midInset =
      (STACKABLE_BOX_SPECS.bodyWallThickness +
        STACKABLE_BOX_SPECS.topRimWidth) /
      2;

    expect(
      probe(createBody(), W / 2 - (midInset + 0.2), midZ),
    ).toBeCloseTo(0, 3);
    expect(
      probe(createBody(), W / 2 - (midInset - 0.2), midZ),
    ).toBeGreaterThan(0);

    expect(
      probe(
        createBody(),
        W / 2 - (STACKABLE_BOX_SPECS.bodyWallThickness + 0.2),
        transitionStartZ + 0.05,
      ),
    ).toBeCloseTo(0, 3);
    expect(
      probe(
        createBody(),
        W / 2 - (STACKABLE_BOX_SPECS.bodyWallThickness - 0.2),
        transitionStartZ + 0.05,
      ),
    ).toBeGreaterThan(0);
  });

  it("rejects a bottom thinner than the guide height at the CAD boundary", () => {
    expect(() =>
      createBody({ trayTopZ: STACKABLE_BOX_SPECS.guideChamferHeight - 0.01 }),
    ).toThrow(/盒底厚度/);
  });

  it("rejects an outer height that cannot contain the printable transition", () => {
    const minimumHeight =
      TRAY_TOP_Z +
      STACKABLE_BOX_SPECS.topTransitionHeight +
      STACKABLE_BOX_SPECS.guideChamferHeight;
    expect(() => createBody({ outerHeight: minimumHeight - 0.01 })).toThrow(
      /顶部过渡斜面和导向倒角/,
    );
  });

  it("keeps two aligned boxes clear when their load shoulders meet", () => {
    const lower = createBody();
    const upper = translate(
      [0, 0, H - STACKABLE_BOX_SPECS.guideChamferHeight],
      createBody(),
    );

    const overlap = measureVolume(intersect(lower, upper));
    expect(overlap).toBeLessThan(0.05);
    expect(overlap).toBeLessThan(measureVolume(upper) * 1e-7);
  });

  it("keeps the straight-side guide gap equal to the configured clearance", () => {
    const lower = createBody();
    const upper = translate(
      [0, 0, H - STACKABLE_BOX_SPECS.guideChamferHeight],
      createBody(),
    );
    const z = H - STACKABLE_BOX_SPECS.guideChamferHeight / 2;
    const x =
      W / 2 -
      (STACKABLE_BOX_SPECS.topRimWidth -
        STACKABLE_BOX_SPECS.guideChamferHeight / 2 +
        CLEARANCE / 2);

    expect(probe(lower, x, z)).toBeCloseTo(0, 3);
    expect(probe(upper, x, z)).toBeCloseTo(0, 3);
  });
});

describe("stackable box lid", () => {
  it("matches the box footprint and keeps the guide above the print plate", () => {
    const lid = createLid();
    const [[minX, minY, minZ], [maxX, maxY, maxZ]] = measureBoundingBox(lid);

    expect(maxX - minX).toBeCloseTo(W, 2);
    expect(maxY - minY).toBeCloseTo(D, 2);
    expect(minZ).toBeCloseTo(0, 5);
    expect(maxZ - minZ).toBeCloseTo(
      2.4 + STACKABLE_BOX_SPECS.guideChamferHeight,
      2,
    );
    expect(measureVolume(lid)).toBeGreaterThan(0);
  });

  it("keeps nail notches on the two short edges", () => {
    const lid = createLid();
    const notchProbe = (center: [number, number, number], size: [number, number, number]) =>
      measureVolume(intersect(lid, cuboid({ center, size })));

    expect(
      notchProbe(
        [-(W / 2 - STACKABLE_BOX_SPECS.nailNotchDepth / 2), 0, 0.5],
        [0.4, 10, 0.8],
      ),
    ).toBeCloseTo(0, 3);
    expect(notchProbe([0, -(D / 2 - 0.2), 0.5], [10, 0.4, 0.8])).toBeGreaterThan(0);
  });
});

describe("stackable box pairing", () => {
  it("supports different heights with the same footprint", () => {
    const tall = createBody({ outerHeight: 80 });
    const short = createBody({ outerHeight: 30 });
    expect(measureBoundingBox(tall)[1][2] - measureBoundingBox(tall)[0][2]).toBeCloseTo(80, 2);
    expect(measureBoundingBox(short)[1][2] - measureBoundingBox(short)[0][2]).toBeCloseTo(30, 2);
  });

  it("does not declare different footprints compatible", () => {
    const a = createBody({ outerWidth: 200, outerDepth: 150 });
    const b = createBody({ outerWidth: 210, outerDepth: 150 });
    expect(measureBoundingBox(a)[1][0] - measureBoundingBox(a)[0][0]).not.toBeCloseTo(
      measureBoundingBox(b)[1][0] - measureBoundingBox(b)[0][0],
      2,
    );
  });
});

describe("side-by-side preview", () => {
  it("composes two disconnected shells and derives spacing from the short side", () => {
    const body = createBody();
    const lid = createLid();
    const spacing = createBoxSideBySidePreviewSpacing(W, D);
    const combined = composeBoxAndLidPreview(body, lid, spacing);

    expect(spacing).toBeGreaterThan(0);
    expect(measureVolume(combined)).toBeGreaterThan(0);
    expect(measureBoundingBox(combined)[1][0]).toBeGreaterThan(
      measureBoundingBox(body)[1][0],
    );
    expect(measureVolume(intersect(body, translate([spacing, 0, 0], lid)))).toBeCloseTo(0, 3);
  });
});
