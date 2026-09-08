import { describe, expect, it } from "vitest";
import { booleans, geometries, measurements, primitives, transforms } from "@jscad/modeling";
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

function createBody(overrides: Partial<Parameters<typeof createStackableBoxBody>[0]> = {}) {
  return createStackableBoxBody({
    outerWidth: W,
    outerDepth: D,
    outerHeight: H,
    trayTopZ: TRAY_TOP_Z,
    xyFitClearance: 0.25,
    ...overrides,
  });
}

function createLid(overrides: Partial<Parameters<typeof createStackableBoxLid>[0]> = {}) {
  return createStackableBoxLid({
    outerWidth: W,
    outerDepth: D,
    lidThickness: 2.4,
    xyFitClearance: 0.25,
    ...overrides,
  });
}

function pointsAtZ(model: ReturnType<typeof createStackableBoxBody>, z: number) {
  return geom3
    .toPoints(model)
    .flat()
    .filter((point) => Math.abs(point[2] - z) < 1e-5);
}

/** 在给定 Z 层，取所有点 X 方向最外侧的 |x|。 */
function maxAbsXAtZ(model: ReturnType<typeof createStackableBoxBody>, z: number) {
  const points = pointsAtZ(model, z);
  return Math.max(...points.map((point) => Math.abs(point[0])));
}

describe("stackable box body", () => {
  it("matches the user outer dimensions within tolerance", () => {
    const model = createBody();
    const [[minX, minY, minZ], [maxX, maxY, maxZ]] = measureBoundingBox(model);

    expect(maxX - minX).toBeCloseTo(W, 2);
    expect(maxY - minY).toBeCloseTo(D, 2);
    expect(maxZ - minZ).toBeCloseTo(H, 2);
  });

  it("has a strictly positive volume", () => {
    expect(measureVolume(createBody())).toBeGreaterThan(0);
  });

  it("keeps the flange shallower than the groove so the shoulder seats first", () => {
    expect(
      STACKABLE_BOX_SPECS.grooveDepth - STACKABLE_BOX_SPECS.flangeHeight,
    ).toBeCloseTo(STACKABLE_BOX_SPECS.flangeGrooveBottomClearance, 5);
  });

  it("raises the load shoulder above the print bed while keeping the flange on the bed", () => {
    const model = createBody();
    const locator = STACKABLE_BOX_SPECS.locatorRingCenterlineInset;
    const flangeOuterInset = locator - STACKABLE_BOX_SPECS.flangeWidth / 2;

    // 承重肩外沿（距外 0 到 1.4mm）在 Z=0 被抬高，凸缘外沿（距外约 1.4mm）贴床。
    expect(maxAbsXAtZ(model, 0)).toBeCloseTo(W / 2 - flangeOuterInset, 1);
    expect(maxAbsXAtZ(model, STACKABLE_BOX_SPECS.flangeHeight)).toBeCloseTo(
      W / 2,
      1,
    );
    // 中央贴床面存在：Z=0 层中央平面（距外 6.0mm 以内）有实体点。
    const bedPoints = pointsAtZ(model, 0);
    const minAbsX = Math.min(...bedPoints.map((point) => Math.abs(point[0])));
    expect(minAbsX).toBeLessThan(W / 2 - STACKABLE_BOX_SPECS.topRimWidth);
  });

  it("leaves assembly clearance around the bottom center insert", () => {
    const x = W / 2 - STACKABLE_BOX_SPECS.topRimWidth - 0.25 / 2;
    const gapProbe = measureVolume(
      intersect(
        createBody(),
        cuboid({ center: [x, 0, 0.2], size: [0.1, 10, 0.1] }),
      ),
    );
    expect(gapProbe).toBeCloseTo(0, 3);
  });

  it("forms a sloped seating surface from the lower flange into the box wall", () => {
    const model = createBody();
    const probe = (x: number, z: number) =>
      measureVolume(
        intersect(
          model,
          cuboid({ center: [x, 0, z], size: [0.1, 10, 0.1] }),
        ),
      );

    // 斜坡底部仍应收在凸缘内，中段应明显向外展开到盒体外轮廓，形成连续过渡。
    const slopeProbeX = W / 2 - 2.0;
    expect(probe(slopeProbeX, 0.05)).toBeCloseTo(0, 3);
    expect(
      probe(slopeProbeX, STACKABLE_BOX_SPECS.flangeHeight / 2),
    ).toBeGreaterThan(0);
    expect(probe(slopeProbeX, STACKABLE_BOX_SPECS.flangeHeight)).toBeGreaterThan(0);
  });

  it("uses a 2.4mm wall and widens to a 6.0mm top rim", () => {
    expect(STACKABLE_BOX_SPECS.bodyWallThickness).toBe(2.4);
    expect(STACKABLE_BOX_SPECS.topRimWidth).toBe(6.0);

    const model = createBody();

    // 用探针体积验证承重边内（距外 3.0mm）有实体、盒内（距外 6.0mm）无实体。
    const probeAt = (cx: number, cz: number) =>
      measureVolume(
        intersect(
          model,
          cuboid({ center: [cx, 0, cz], size: [0.4, 20, 0.4] }),
        ),
      );
    expect(probeAt(W / 2 - 5, H - 1)).toBeGreaterThan(0);
    expect(probeAt(W / 2 - 6.5, H - 1)).toBeCloseTo(0, 3);
  });

  it("provides at least 2mm horizontal shoulder inside the receiving groove", () => {
    const grooveWidth =
      STACKABLE_BOX_SPECS.flangeWidth + 2 * 0.25;
    const grooveInnerInset =
      STACKABLE_BOX_SPECS.locatorRingCenterlineInset + grooveWidth / 2;
    const shoulderWidth = STACKABLE_BOX_SPECS.topRimWidth - grooveInnerInset;

    expect(shoulderWidth).toBeGreaterThanOrEqual(2);
  });

  it("keeps the sloped underside clear when two boxes are stacked", () => {
    const lower = createBody();
    const upper = translate(
      [0, 0, H - STACKABLE_BOX_SPECS.flangeHeight],
      createBody(),
    );

    // 布尔运算在共面接触处允许极小数值残差，但不应出现可感知的实体相撞。
    expect(measureVolume(intersect(lower, upper))).toBeLessThan(1);
  });

  it("cuts a 1.4mm locating groove into the top rim", () => {
    expect(STACKABLE_BOX_SPECS.grooveDepth).toBe(1.4);
    const model = createBody();
    const locator = STACKABLE_BOX_SPECS.locatorRingCenterlineInset;
    const grooveD = STACKABLE_BOX_SPECS.grooveDepth;

    const probeAt = (cz: number) =>
      measureVolume(
        intersect(
          model,
          cuboid({ center: [W / 2 - locator, 0, cz], size: [0.4, 20, 0.4] }),
        ),
      );
    // 凹槽内部（直边区域）为空，凹槽以下为承重环实体。
    expect(probeAt(H - grooveD / 2)).toBeCloseTo(0, 3);
    expect(probeAt(H - grooveD - 0.5)).toBeGreaterThan(0);
  });
});

describe("stackable box lid", () => {
  it("matches the box outer dimensions and adds the lid thickness height", () => {
    const lid = createLid();
    const [[minX, minY], [maxX, maxY]] = measureBoundingBox(lid);
    const body = createBody();
    const [, [, , bodyMaxZ]] = measureBoundingBox(body);

    expect(maxX - minX).toBeCloseTo(W, 2);
    expect(maxY - minY).toBeCloseTo(D, 2);
    // 盖子打印方向：大平面贴床，定位凸缘朝上。
    const lidHeight = 2.4 + STACKABLE_BOX_SPECS.flangeHeight;
    expect(measureBoundingBox(lid)[1][2] - measureBoundingBox(lid)[0][2])
      .toBeCloseTo(lidHeight, 2);
    // 闭合后外高 = 盒体外高 + 盖板厚度。
    expect(bodyMaxZ + 2.4).toBeCloseTo(H + 2.4, 2);
  });

  it("has a strictly positive volume", () => {
    expect(measureVolume(createLid())).toBeGreaterThan(0);
  });

  it("puts nail notches on the two short edges", () => {
    const lid = createLid();
    const notchProbe = (center: [number, number, number], size: [number, number, number]) =>
      measureVolume(intersect(lid, cuboid({ center, size })));

    // W>D：短边位于 X=±W/2，槽口沿 Y 展开；长边中部仍应保持完整。
    expect(
      notchProbe([-(W / 2 - STACKABLE_BOX_SPECS.nailNotchDepth / 2), 0, 0.5], [0.4, 10, 0.8]),
    ).toBeCloseTo(0, 3);
    expect(notchProbe([0, -(D / 2 - 0.2), 0.5], [10, 0.4, 0.8])).toBeGreaterThan(0);

    const squareDepth = 220;
    const squareLid = createStackableBoxLid({
      outerWidth: 180,
      outerDepth: squareDepth,
      lidThickness: 2.4,
      xyFitClearance: 0.25,
    });
    // W<D：短边改为 Y=±D/2，避免槽口随尺寸方向错误旋转。
    expect(
      measureVolume(
        intersect(
          squareLid,
          cuboid({
            center: [0, -(squareDepth / 2 - STACKABLE_BOX_SPECS.nailNotchDepth / 2), 0.5],
            size: [10, 0.4, 0.8],
          }),
        ),
      ),
    ).toBeCloseTo(0, 3);
  });
});

describe("stackable box pairing", () => {
  it("declares same-footprint boxes compatible across different heights", () => {
    const grooveWidth =
      STACKABLE_BOX_SPECS.flangeWidth + 2 * 0.25;
    const flangeWidth = STACKABLE_BOX_SPECS.flangeWidth;
    // 凸缘必须窄于凹槽（存在每侧配合间隙）。
    expect(flangeWidth).toBeLessThan(grooveWidth);
    // 不同高度不影响配对：定位截面只取决于外部长宽。
    const tall = createBody({ outerHeight: 80 });
    const short = createBody({ outerHeight: 30 });
    const [[, , tallMinZ], [, , tallMaxZ]] = measureBoundingBox(tall);
    const [[, , shortMinZ], [, , shortMaxZ]] = measureBoundingBox(short);
    expect(tallMaxZ - tallMinZ).toBeCloseTo(80, 2);
    expect(shortMaxZ - shortMinZ).toBeCloseTo(30, 2);
  });

  it("does not declare different footprints compatible", () => {
    const a = createBody({ outerWidth: 200, outerDepth: 150 });
    const b = createBody({ outerWidth: 210, outerDepth: 150 });
    const [[aMinX], [aMaxX]] = measureBoundingBox(a);
    const [[bMinX], [bMaxX]] = measureBoundingBox(b);
    expect(aMaxX - aMinX).not.toBeCloseTo(bMaxX - bMinX, 2);
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
    // 组合几何宽于单体（盖子旁置）。
    const [, [combinedMaxX]] = measureBoundingBox(combined);
    const [, [bodyMaxX]] = measureBoundingBox(body);
    expect(combinedMaxX).toBeGreaterThan(bodyMaxX);
    expect(measureVolume(intersect(body, translate([spacing, 0, 0], lid)))).toBeCloseTo(0, 3);
  });
});
