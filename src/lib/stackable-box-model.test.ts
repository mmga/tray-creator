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
import {
  calculateBottomSeatSlopeHeight,
  calculateTopSeatSupportHeight,
  STACKABLE_BOX_SPECS,
} from "@/lib/stackable-box";

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

  it("places the load-bearing bottom plane on the print bed", () => {
    const stackingSlopeRun =
      STACKABLE_BOX_SPECS.topRimWidth -
      STACKABLE_BOX_SPECS.minLoadBearingWidth;
    const expectedBottomInset = stackingSlopeRun + CLEARANCE;

    expect(maxAbsXAtZ(createBody(), 0)).toBeCloseTo(
      W / 2 - expectedBottomInset,
      1,
    );
  });

  it("expands the bottom continuously from the print bed to the outer wall", () => {
    const body = createBody();
    const slopeH = calculateBottomSeatSlopeHeight({ xyFitClearance: CLEARANCE });
    const bottomInset = STACKABLE_BOX_SPECS.guideChamferHeight + CLEARANCE;
    const midInset = bottomInset / 2;

    expect(maxAbsXAtZ(body, 0)).toBeCloseTo(W / 2 - bottomInset, 1);
    expect(probe(body, W / 2 - (midInset - 0.2), slopeH / 2)).toBeCloseTo(0, 3);
    expect(probe(body, W / 2 - (midInset + 0.2), slopeH / 2)).toBeGreaterThan(0);
    expect(maxAbsXAtZ(body, slopeH)).toBeCloseTo(W / 2, 1);
  });

  it("keeps a recessed horizontal load seat below the rim edge", () => {
    const body = createBody();
    const seatZ = H - STACKABLE_BOX_SPECS.guideChamferHeight;
    const seatProbeInset =
      (STACKABLE_BOX_SPECS.guideChamferHeight +
        STACKABLE_BOX_SPECS.topRimWidth +
        CLEARANCE) /
      2;

    expect(probe(body, W / 2 - seatProbeInset, seatZ - 0.05)).toBeGreaterThan(0);
    expect(probe(body, W / 2 - seatProbeInset, seatZ + 0.05)).toBeCloseTo(0, 3);
  });

  it("forms the receiving slope from the recessed seat to the top edge", () => {
    const body = createBody();
    const guideH = STACKABLE_BOX_SPECS.guideChamferHeight;
    const seatZ = H - guideH;
    const midZ = seatZ + guideH / 2;
    const midInset = guideH / 2;

    expect(probe(body, W / 2 - (midInset - 0.2), midZ)).toBeGreaterThan(0);
    expect(probe(body, W / 2 - (midInset + 0.2), midZ)).toBeCloseTo(0, 3);
    expect(probe(body, W / 2 - 1, H - 0.05)).toBeCloseTo(0, 3);
  });

  it("supports the recessed seat with a continuous 45-degree inner slope", () => {
    const body = createBody();
    const supportH = calculateTopSeatSupportHeight({ xyFitClearance: CLEARANCE });
    const seatZ = H - STACKABLE_BOX_SPECS.guideChamferHeight;
    const transitionStartZ = seatZ - supportH;
    const seatInnerInset = STACKABLE_BOX_SPECS.topRimWidth + CLEARANCE;
    const midInset =
      (STACKABLE_BOX_SPECS.bodyWallThickness + seatInnerInset) / 2;

    expect(probe(body, W / 2 - (midInset + 0.2), transitionStartZ + supportH / 2))
      .toBeCloseTo(0, 3);
    expect(probe(body, W / 2 - (midInset - 0.2), transitionStartZ + supportH / 2))
      .toBeGreaterThan(0);
  });

  it("allows a base plate thinner than the stacking slope", () => {
    expect(() => createBody({ trayTopZ: 2.4 })).not.toThrow();
  });

  it("rejects an outer height that cannot contain both stacking slopes", () => {
    const minimumHeight =
      TRAY_TOP_Z +
      calculateTopSeatSupportHeight({ xyFitClearance: CLEARANCE }) +
      STACKABLE_BOX_SPECS.guideChamferHeight;
    expect(() => createBody({ outerHeight: minimumHeight - 0.01 })).toThrow(
      /上下互补斜面和承重座/,
    );
  });

  it("seats two aligned boxes on the recessed horizontal load ring", () => {
    const lower = createBody();
    const upper = translate(
      [0, 0, H - STACKABLE_BOX_SPECS.guideChamferHeight],
      createBody(),
    );
    const seatZ = H - STACKABLE_BOX_SPECS.guideChamferHeight;
    const contactInset =
      (STACKABLE_BOX_SPECS.guideChamferHeight +
        STACKABLE_BOX_SPECS.topRimWidth) /
        2 +
      CLEARANCE;

    const overlap = measureVolume(intersect(lower, upper));
    expect(overlap).toBeLessThan(0.05);
    expect(overlap).toBeLessThan(measureVolume(upper) * 1e-7);
    expect(probe(lower, W / 2 - contactInset, seatZ - 0.05)).toBeGreaterThan(0);
    expect(probe(upper, W / 2 - contactInset, seatZ + 0.05)).toBeGreaterThan(0);
  });

  it("allows vertical insertion to the recessed horizontal load seat", () => {
    const lower = createBody();
    const stackingDepth =
      STACKABLE_BOX_SPECS.topRimWidth -
      STACKABLE_BOX_SPECS.minLoadBearingWidth;

    for (let lift = stackingDepth; lift >= 0; lift -= 1) {
      const upper = translate(
        [0, 0, H - stackingDepth + lift],
        createBody(),
      );
      expect(measureVolume(intersect(lower, upper))).toBeLessThan(0.05);
    }
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
      (STACKABLE_BOX_SPECS.guideChamferHeight / 2 +
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
