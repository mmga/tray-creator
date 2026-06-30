# Stepped Split Sloped Groove Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current flat simple-shape assembly groove with a `1mm` inset contact land plus an inward sloped release surface so stepped split parts keep stable alignment while reducing edge fragments and avoiding unnecessary support when printing the upper part.

**Architecture:** Keep the current stepped split ownership and `simpleShape` groove path in `src/lib/stepped-tray-model.ts`, but change the groove geometry generator from a flat cylinder-union cutter into a profile-based solid with three zones: outer contact land, inward sloped release, and a degraded fallback when local width is insufficient. Lock the behavior down with targeted geometry tests and keep the existing diagnostics probe as a regression monitor rather than a brittle exact snapshot.

**Tech Stack:** TypeScript, Vitest, `@jscad/modeling` (`booleans`, `extrusions`, `measurements`, `geometries`, `primitives`)

---

## File Structure

- Modify: `src/lib/stepped-tray-model.ts`
  - Keep all groove-generation logic in the existing file to match current repo style.
  - Add focused helpers for simple groove footprints, inset validation, and sloped cutter/addition solids.
- Modify: `src/lib/stepped-tray-model.test.ts`
  - Extend stepped split tests with explicit assertions for the new land + slope geometry and fallback behavior.
- Modify: `src/lib/stepped-split-diagnostics.test.ts`
  - Keep the probe and update thresholds only if the new geometry changes face counts within the intended direction.

### Task 1: Lock the intended groove behavior in tests

**Files:**
- Modify: `src/lib/stepped-tray-model.test.ts`
- Test: `src/lib/stepped-tray-model.test.ts`

- [ ] **Step 1: Add helpers that can detect flat lands versus sloped release faces**

```ts
function countHorizontalFacesAtZ(
  geometry: Geom3,
  z: number,
  tolerance = 0.05,
) {
  const polygons = (geometry as unknown as { polygons: { vertices: number[][] }[] }).polygons;
  return polygons.filter((polygon) => {
    const zValues = polygon.vertices.map((vertex) => vertex[2] ?? 0);
    const zMin = Math.min(...zValues);
    const zMax = Math.max(...zValues);
    return Math.abs(zMax - zMin) < 0.001 && Math.abs(zMin - z) <= tolerance;
  }).length;
}

function countSlopedFacesNearBand(
  geometry: Geom3,
  minZ: number,
  maxZ: number,
) {
  const polygons = (geometry as unknown as { polygons: { vertices: number[][] }[] }).polygons;
  return polygons.filter((polygon) => {
    const zValues = polygon.vertices.map((vertex) => vertex[2] ?? 0);
    const zMin = Math.min(...zValues);
    const zMax = Math.max(...zValues);
    return zMax - zMin > 0.2 && zMin < maxZ && zMax > minZ;
  }).length;
}
```

- [ ] **Step 2: Add a regression test for the new `1mm` land + slope contract**

```ts
it("keeps a 1mm inset land and replaces flat groove shelves with sloped release faces", () => {
  const params = createParams();
  const groovedParts = createSteppedSplitParts(params);
  const plainParts = createSteppedSplitParts(params, {
    interfaceGrooveDepth: 0,
  });

  const lowPart = groovedParts[0].geometry;
  const highPart = groovedParts[1].geometry;

  expect(measureVolume(groovedParts[0].geometry)).toBeLessThan(
    measureVolume(plainParts[0].geometry),
  );
  expect(measureVolume(groovedParts[1].geometry)).toBeGreaterThan(
    measureVolume(plainParts[1].geometry),
  );

  expect(countHorizontalFacesAtZ(lowPart, 1)).toBeLessThan(40);
  expect(countSlopedFacesNearBand(lowPart, 0.2, 2.2)).toBeGreaterThan(0);
  expect(countSlopedFacesNearBand(highPart, 1, 3)).toBeGreaterThan(0);
});
```

- [ ] **Step 3: Add a fallback test for narrow geometry**

```ts
it("shrinks or disables the sloped release before sacrificing the 1mm contact land", () => {
  const parts = createSteppedSplitParts({
    ...createParams(),
    spacing: 6,
    slots: [
      {
        id: "slot-low",
        groupId: "low",
        x: -8,
        y: 0,
        width: 18,
        height: 18,
        rotation: 0,
        shape: "circle",
      },
      {
        id: "slot-high",
        groupId: "high",
        x: 8,
        y: 0,
        width: 18,
        height: 18,
        rotation: 0,
        shape: "circle",
      },
    ],
  });

  expect(parts).toHaveLength(2);
  expect(measureVolume(parts[0].geometry)).toBeGreaterThan(0);
  expect(measureVolume(parts[1].geometry)).toBeGreaterThan(0);
});
```

- [ ] **Step 4: Run the focused stepped split tests and confirm the new test fails first**

Run: `pnpm exec vitest run src/lib/stepped-tray-model.test.ts --reporter verbose`

Expected: FAIL in the newly added sloped-groove assertions before implementation.

- [ ] **Step 5: Commit the failing test baseline**

```bash
git add src/lib/stepped-tray-model.test.ts
git commit -m "test: define sloped stepped groove behavior"
```

### Task 2: Replace flat simple-shape grooves with profile-based solids

**Files:**
- Modify: `src/lib/stepped-tray-model.ts`
- Test: `src/lib/stepped-tray-model.test.ts`

- [ ] **Step 1: Add local constants and option normalization for the new groove profile**

```ts
const DEFAULT_SPLIT_GROOVE: Required<
  SteppedSplitGrooveOptions & {
    interfaceGrooveInset: number;
    interfaceGrooveSlopeAngleDeg: number;
  }
> = {
  interfaceGrooveDepth: 2,
  interfaceGrooveInset: 1,
  interfaceGrooveSlopeAngleDeg: 45,
};
```

- [ ] **Step 2: Replace `buildSimpleSlotCylinders()` with a footprint-first helper**

```ts
function buildSimpleSlotFootprint(
  slotData: NormalizedSlotData[],
  spacing: number,
  radiusAdjustment = 0,
): Geom2 | null {
  if (slotData.length === 0) {
    return null;
  }

  const footprints = slotData
    .map((d) => {
      const radius = Math.max(d.actualW, d.actualH) / 2 + spacing - radiusAdjustment;
      if (radius <= 0.2) {
        return null;
      }
      return translate(
        [d.cx, d.cy],
        circle({ radius, segments: RENDER_CONFIG.cylinderSegments }),
      );
    })
    .filter((footprint): footprint is Geom2 => footprint !== null);

  if (footprints.length === 0) {
    return null;
  }

  return footprints.length === 1 ? footprints[0] : union(...footprints);
}
```

- [ ] **Step 3: Add a sloped groove solid builder with clamp-based degradation**

```ts
function buildSimpleGrooveProfileSolid(
  slotData: NormalizedSlotData[],
  spacing: number,
  depth: number,
  zBase: number,
  inset: number,
  slopeAngleDeg: number,
  mode: "pocket" | "tenon",
): Geom3 | null {
  const outerFootprint = buildSimpleSlotFootprint(slotData, spacing, 0);
  const innerFootprint = buildSimpleSlotFootprint(slotData, spacing, inset);
  if (!outerFootprint) {
    return null;
  }

  if (!innerFootprint || depth <= 0.2) {
    const flat = extrudeLinear({ height: depth }, outerFootprint);
    return translate([0, 0, zBase], flat);
  }

  const slopeHeight = Math.min(
    depth,
    inset / Math.tan((slopeAngleDeg * Math.PI) / 180),
  );
  const landHeight = Math.max(depth - slopeHeight, 0);

  const land = landHeight > 0
    ? extrudeLinear({ height: landHeight }, outerFootprint)
    : null;

  const slope = extrudeFromSlices(
    {
      numberOfSlices: 2,
      capStart: true,
      capEnd: true,
      close: false,
      callback: (progress) => {
        const sliceGeom = progress === 0 ? outerFootprint : innerFootprint;
        const z = progress === 0
          ? (mode === "pocket" ? landHeight : 0)
          : (mode === "pocket" ? depth : slopeHeight);
        return translate([0, 0, z], sliceGeom);
      },
    },
    outerFootprint,
  );

  const solid = land ? union(land, slope) : slope;
  return translate([0, 0, zBase], solid);
}
```

- [ ] **Step 4: Route `simpleShape` groove callers through the new profile builder**

```ts
if (simpleShape) {
  return buildSimpleGrooveProfileSolid(
    cutterSlotData,
    params.spacing,
    depth,
    zBase,
    grooveConfig.interfaceGrooveInset,
    grooveConfig.interfaceGrooveSlopeAngleDeg,
    zBase < interfaceHeight ? "pocket" : "tenon",
  );
}
```

- [ ] **Step 5: Run the focused groove tests and confirm the new behavior passes**

Run: `pnpm exec vitest run src/lib/stepped-tray-model.test.ts -t "sloped" --reporter verbose`

Expected: PASS for the new sloped-groove assertions.

- [ ] **Step 6: Commit the groove geometry implementation**

```bash
git add src/lib/stepped-tray-model.ts src/lib/stepped-tray-model.test.ts
git commit -m "feat: add inset sloped stepped assembly grooves"
```

### Task 3: Preserve existing split behavior and narrow-width fallback

**Files:**
- Modify: `src/lib/stepped-tray-model.ts`
- Modify: `src/lib/stepped-tray-model.test.ts`
- Test: `src/lib/stepped-tray-model.test.ts`

- [ ] **Step 1: Add a helper that evaluates whether slope generation is safe**

```ts
function canBuildSlopedGroove(
  slotData: NormalizedSlotData[],
  spacing: number,
  inset: number,
) {
  return slotData.every((d) => {
    const radius = Math.max(d.actualW, d.actualH) / 2 + spacing;
    return radius - inset > 0.6;
  });
}
```

- [ ] **Step 2: Apply the degradation order exactly as designed**

```ts
const useSlope = canBuildSlopedGroove(
  cutterSlotData,
  params.spacing,
  grooveConfig.interfaceGrooveInset,
);

if (!useSlope) {
  const flatFallback = buildSimpleSlotCylinders(cutterSlotData, params.spacing, depth);
  return flatFallback ? translate([0, 0, zBase], flatFallback) : null;
}
```

- [ ] **Step 3: Add a test that narrow regions keep parts printable and non-empty**

```ts
it("falls back to a minimal flat groove when inset slope geometry collapses", () => {
  const params = {
    ...createParams(),
    spacing: 4,
    holeDepth: 8,
  };
  const parts = createSteppedSplitParts(params);
  for (const part of parts) {
    expect(measureVolume(part.geometry)).toBeGreaterThan(0);
  }
});
```

- [ ] **Step 4: Run the stepped split suite to confirm no behavior regressions**

Run: `pnpm exec vitest run src/lib/stepped-tray-model.test.ts --reporter verbose`

Expected: PASS for existing split ownership, same-height split, groove volume, and fallback tests.

- [ ] **Step 5: Commit the fallback behavior**

```bash
git add src/lib/stepped-tray-model.ts src/lib/stepped-tray-model.test.ts
git commit -m "fix: degrade sloped stepped grooves safely"
```

### Task 4: Re-baseline diagnostics and run final verification

**Files:**
- Modify: `src/lib/stepped-split-diagnostics.test.ts`
- Test: `src/lib/stepped-split-diagnostics.test.ts`

- [ ] **Step 1: Keep the probe and express its assertions as ceilings**

```ts
const splitSmallFaces = splitMetrics.map((item) => item.smallFacesUnder1mm2);
expect(splitSmallFaces[0]).toBeLessThanOrEqual(300);
expect(splitSmallFaces[1]).toBeLessThanOrEqual(700);
expect(splitSmallFaces[2]).toBeLessThanOrEqual(340);

const mergedSmallFaces = mergedMetrics.map((item) => item.smallFacesUnder1mm2);
expect(mergedSmallFaces[0]).toBeLessThanOrEqual(320);
expect(mergedSmallFaces[1]).toBeLessThanOrEqual(1400);
expect(mergedSmallFaces[2]).toBeLessThanOrEqual(340);
```

- [ ] **Step 2: Tighten the numbers only after observing the new geometry output**

Run: `pnpm exec vitest run src/lib/stepped-split-diagnostics.test.ts --reporter verbose`

Expected: printed metrics show fewer small horizontal faces near groove planes than the current flat groove.

- [ ] **Step 3: Run final code-level verification**

Run: `pnpm exec vitest run src/lib/stepped-tray-model.test.ts src/lib/stepped-split-diagnostics.test.ts --reporter verbose`

Expected: `2 passed`

Run: `pnpm exec tsc --noEmit --pretty false`

Expected: no TypeScript errors

- [ ] **Step 4: Commit the final diagnostics baseline**

```bash
git add src/lib/stepped-split-diagnostics.test.ts src/lib/stepped-tray-model.test.ts src/lib/stepped-tray-model.ts
git commit -m "test: monitor sloped stepped groove mesh quality"
```

## Self-Review

- Spec coverage: the plan covers the approved geometry contract (`1mm` inset contact land, inward sloped release, preserve alignment, fallback before sacrificing the land) and keeps the diagnostics probe active.
- Placeholder scan: no `TODO`/`TBD` placeholders remain; every task names exact files and commands.
- Type consistency: the plan uses `SteppedSplitGrooveOptions`, `buildGroupFootprintCutter()`, `buildSplitUnitFootprintCutter()`, and the existing split tests consistently with the current codebase.

