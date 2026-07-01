# Stepped CAD Split Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `stepped-cad` split recess/tenon geometry from 2D split profiles before layered extrusion so split parts preserve assembly clearance while avoiding fragmented coplanar faces along lower-part interface edges.

**Architecture:** Keep `buildSteppedCadFeatureGraph()` as the base stepped-CAD source of truth, add a dedicated split-profile builder that derives per-split-unit interface footprints and final layer profiles, then refactor `createSteppedCadSplitParts()` to extrude those profiles instead of carving recesses out of already-finished 3D bodies. Keep locator pins and sockets as localized post-body 3D features attached on top of the new layered body so the migration stays narrow and the main interface edge leaves the fragile 3D pocket-cut path.

**Tech Stack:** TypeScript, Vitest, `@jscad/modeling` (`booleans`, `extrusions`, `measurements`, `primitives`, `transforms`)

---

## Post-Implementation Correction

The initial layer-profile implementation was reverted after testing showed it split the lower part's outer wall into additional vertical bands. The final implementation keeps the interface sketch contract but applies it as a localized recess feature:

- `A` is the upper-part male interface footprint.
- `femaleRaw = offset(A, 0.1mm)`.
- `B` is the lower-part top footprint at the contact height.
- `C = intersect(femaleRaw, B)`.
- `C` is used as the lower recess sketch, while `A` is used as the upper tenon sketch.

The separate `src/lib/stepped-cad-split-profiles.ts` module from the original plan was removed because rebuilding whole height bands from `B - C` caused the non-contact outer wall fragmentation reported during validation.

## File Structure

- Modify: `src/lib/stepped-cad-tray-model.ts`
  - Keep split-unit grouping, labels, slot-hole subtraction, base-hole subtraction, cleanup, and locator post-processing here.
  - Remove ownership of the main recess/tenon interface from this file.
- Create: `src/lib/stepped-cad-split-profiles.ts`
  - Own split-unit interface footprint derivation and final per-part 2D layer profiles.
- Modify: `src/lib/stepped-cad-user-repro.test.ts`
  - Add a regression that proves the two-height repro no longer explodes into many small coplanar faces when `enableSplitRecess` is enabled.
- Modify: `src/lib/stepped-cad-tray-model.test.ts`
  - Lock the new profile-driven recess/tenon semantics without depending on brittle exact polygon snapshots.

### Task 1: Lock the new split-profile contract in tests

**Files:**
- Modify: `src/lib/stepped-cad-user-repro.test.ts`
- Modify: `src/lib/stepped-cad-tray-model.test.ts`
- Test: `src/lib/stepped-cad-user-repro.test.ts`
- Test: `src/lib/stepped-cad-tray-model.test.ts`

- [ ] **Step 1: Add a downloaded-config repro fixture and shared face-count helpers**

```ts
import downloadedSteppedConfig from "@/../sample-config/tray-stepped-config.json";

const DOWNLOADED_REPRO_PARAMS =
  downloadedSteppedConfig.params as SteppedLayoutParams;

function countSmallHorizontalFacesNear(
  geometry: { polygons: { vertices: number[][] }[] },
  z: number,
  maxArea = 5,
) {
  return geometry.polygons.filter((polygon) => {
    if (polygon.vertices.length < 3) {
      return false;
    }

    const onPlane = polygon.vertices.every(
      (vertex) => Math.abs((vertex[2] ?? 0) - z) < 0.001,
    );

    return onPlane && polygonArea2d(polygon) < maxArea;
  }).length;
}
```

- [ ] **Step 2: Add a failing regression for the two-height recess case**

```ts
it("reduces lower-part coplanar fragments for the two-height recess repro", () => {
  const groovedParts = createSteppedCadSplitParts({
    ...DOWNLOADED_REPRO_PARAMS,
    splitGrooveDepth: 2,
    enableSplitRecess: true,
    enableSplitLocators: false,
  });
  const lowPart = groovedParts.find((part) => part.label === "组 2");

  expect(lowPart).toBeDefined();
  expect(
    countSmallHorizontalFacesNear(
      lowPart!.geometry as unknown as { polygons: { vertices: number[][] }[] },
      20,
    ),
  ).toBeLessThan(60);
});
```

- [ ] **Step 3: Add a semantics test for profile-driven recess and tenon bands**

```ts
it("builds recess and tenon from layered profiles instead of post-body CSG pockets", () => {
  const plainParts = createSteppedCadSplitParts({
    ...createParams(),
    enableSplitRecess: true,
    splitGrooveDepth: 0,
  });
  const groovedParts = createSteppedCadSplitParts({
    ...createParams(),
    enableSplitRecess: true,
    splitGrooveDepth: 2,
  });

  const lowPart = groovedParts[0].geometry;
  const highPart = groovedParts[1].geometry;

  expect(measureVolume(lowPart)).toBeLessThan(measureVolume(plainParts[0].geometry));
  expect(measureBoundingBox(highPart)[0][2]).toBeLessThan(
    measureBoundingBox(plainParts[1].geometry)[0][2],
  );
});
```

- [ ] **Step 4: Run the focused tests to confirm the new regression fails first**

Run: `/Users/bianyunpeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vitest/vitest.mjs run src/lib/stepped-cad-user-repro.test.ts src/lib/stepped-cad-tray-model.test.ts --reporter=verbose`

Expected: FAIL in the new two-height recess regression because the current implementation still cuts the lower-part top surface with a post-body pocket.

- [ ] **Step 5: Commit the failing test baseline**

```bash
git add src/lib/stepped-cad-user-repro.test.ts src/lib/stepped-cad-tray-model.test.ts
git commit -m "test: define stepped cad split profile regressions"
```

### Task 2: Build the split-profile layer generator

**Files:**
- Create: `src/lib/stepped-cad-split-profiles.ts`
- Test: `src/lib/stepped-cad-tray-model.test.ts`

- [ ] **Step 1: Add the split-profile types and constants**

```ts
import { booleans } from "@jscad/modeling";
import type { Geom2 } from "@jscad/modeling/src/geometries/types";
import type { SteppedLayoutParams } from "@/types/custom-tray";
import type {
  SteppedCadBaseHoleFeature,
  SteppedCadFeatureGraph,
  SteppedCadGroupFeature,
  SteppedCadSlotHoleFeature,
} from "@/lib/stepped-cad-feature-graph";

const { union } = booleans;
const DEFAULT_INTERFACE_CLEARANCE = 0.2;
const DEFAULT_INTERFACE_INSET = 1;

export interface SteppedCadSplitLayerProfile {
  fromHeight: number;
  toHeight: number;
  footprint: Geom2;
  kind: "body" | "recess" | "tenon";
}

export interface SteppedCadSplitUnitProfile {
  key: string;
  minHeight: number;
  maxHeight: number;
  layers: SteppedCadSplitLayerProfile[];
  slotHoles: SteppedCadSlotHoleFeature[];
  baseHoles: SteppedCadBaseHoleFeature[];
}
```

- [ ] **Step 2: Add helpers to derive `contact`, `male`, and `female` footprints**

```ts
import { insetGeom2, offsetGeom2 } from "@/lib/outline-geometry";

function deriveMaleFootprint(contactFootprint: Geom2) {
  return insetGeom2(contactFootprint, DEFAULT_INTERFACE_INSET) ?? contactFootprint;
}

function deriveFemaleFootprint(maleFootprint: Geom2) {
  return offsetGeom2(maleFootprint, DEFAULT_INTERFACE_CLEARANCE) ?? maleFootprint;
}
```

- [ ] **Step 3: Add a builder that turns split-unit interfaces into final layer profiles**

```ts
export function buildSteppedCadSplitUnitProfiles(
  graph: SteppedCadFeatureGraph,
  params: SteppedLayoutParams,
  splitUnits: {
    key: string;
    groups: SteppedCadGroupFeature[];
    slotHoles: SteppedCadSlotHoleFeature[];
    baseHoles: SteppedCadBaseHoleFeature[];
    minHeight: number;
    maxHeight: number;
  }[],
  partitions: Map<string, { footprint: Geom2 }>,
) {
  return splitUnits.map<SteppedCadSplitUnitProfile>((splitUnit) => {
    const layers: SteppedCadSplitLayerProfile[] = [];
    const baseHeight = getSplitUnitExternalBaseHeight(splitUnit, splitUnits);
    const supportFootprint = buildSupportFootprint(splitUnit, partitions);

    layers.push({
      fromHeight: baseHeight,
      toHeight: splitUnit.maxHeight,
      footprint: supportFootprint!,
      kind: "body",
    });

    if (params.splitGrooveDepth > 0 && supportFootprint) {
      const maleFootprint = deriveMaleFootprint(supportFootprint);
      const femaleFootprint = deriveFemaleFootprint(maleFootprint);

      if (params.enableSplitRecess && baseHeight > 0) {
        layers.push({
          fromHeight: baseHeight - params.splitGrooveDepth,
          toHeight: baseHeight,
          footprint: maleFootprint,
          kind: "tenon",
        });
      }

      if (params.enableSplitRecess && splitUnit.minHeight > baseHeight) {
        layers.push({
          fromHeight: splitUnit.minHeight - params.splitGrooveDepth,
          toHeight: splitUnit.minHeight,
          footprint: femaleFootprint,
          kind: "recess",
        });
      }
    }

    return {
      key: splitUnit.key,
      minHeight: splitUnit.minHeight,
      maxHeight: splitUnit.maxHeight,
      layers,
      slotHoles: splitUnit.slotHoles,
      baseHoles: splitUnit.baseHoles,
    };
  });
}
```

- [ ] **Step 4: Run the focused tests and confirm type/build errors are gone**

Run: `/Users/bianyunpeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vitest/vitest.mjs run src/lib/stepped-cad-tray-model.test.ts --reporter=verbose`

Expected: FAIL in behavior assertions, not on missing imports or type errors.

- [ ] **Step 5: Commit the profile-builder skeleton**

```bash
git add src/lib/stepped-cad-split-profiles.ts
git commit -m "feat: add stepped cad split profile builder"
```

### Task 3: Refactor split-part body construction to consume layer profiles

**Files:**
- Modify: `src/lib/stepped-cad-tray-model.ts`
- Modify: `src/lib/stepped-cad-tray-model.test.ts`
- Modify: `src/lib/stepped-cad-user-repro.test.ts`
- Test: `src/lib/stepped-cad-tray-model.test.ts`
- Test: `src/lib/stepped-cad-user-repro.test.ts`

- [ ] **Step 1: Replace pocket/tenon body construction with profile extrusion**

```ts
import {
  buildSteppedCadSplitUnitProfiles,
} from "@/lib/stepped-cad-split-profiles";

function buildBodyFromLayerProfiles(
  layers: { fromHeight: number; toHeight: number; footprint: Geom2 }[],
) {
  const solids = layers
    .map((layer) =>
      buildSolidFromFootprint(layer.footprint, layer.fromHeight, layer.toHeight),
    )
    .filter((item): item is Geom3 => item !== null);

  if (solids.length === 0) {
    return null;
  }

  return solids.length === 1 ? solids[0] : (union(...solids) as Geom3);
}
```

- [ ] **Step 2: Switch `createSteppedCadSplitParts()` to the new profile path**

```ts
const splitProfiles = buildSteppedCadSplitUnitProfiles(
  graph,
  params,
  splitUnits,
  partitions,
);

return splitProfiles.flatMap((profile, index) => {
  const body = buildBodyFromLayerProfiles(profile.layers);
  if (!body) {
    return [];
  }

  let part = profile.slotHoles.length > 0
    ? subtract(body, ...profile.slotHoles.map(buildSlotHoleSolid))
    : body;

  if (params.enableBaseHole) {
    part = subtractBaseHoles(part, profile.baseHoles, 0, params.baseHoleSize);
  }

  part = attachLocatorFeaturesIfNeeded(part, profile, splitUnits, partitions, params);
  part = orientPositiveVolume(cleanupIfBeneficial(part));

  return [{
    index,
    filenameLabel: `part_${String(index + 1).padStart(2, "0")}_${buildSplitPartIdLabel(profile.groups)}`,
    label: buildSplitPartLabel(profile.groups, params),
    fromHeight: getSplitUnitExternalBaseHeight(profile, splitUnits),
    toHeight: profile.maxHeight,
    geometry: part,
  }];
});
```

- [ ] **Step 3: Keep locator pins and sockets as localized post-body features**

```ts
function attachLocatorFeaturesIfNeeded(
  body: Geom3,
  profile: SteppedCadSplitUnitProfile,
  splitUnits: SteppedCadSplitUnit[],
  partitions: Map<string, SteppedCadPartition>,
  params: SteppedLayoutParams,
) {
  if (!params.enableSplitLocators) {
    return body;
  }

  const locatorSolids = buildLocatorFeatureSolids(
    profile,
    splitUnits,
    partitions,
    params.splitGrooveDepth,
  );

  if (locatorSolids.additions.length > 0) {
    body = union(body, ...locatorSolids.additions) as Geom3;
  }
  if (locatorSolids.subtractions.length > 0) {
    body = subtract(body, ...locatorSolids.subtractions) as Geom3;
  }

  return body;
}
```

- [ ] **Step 4: Run the focused split tests and make the new regressions pass**

Run: `/Users/bianyunpeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vitest/vitest.mjs run src/lib/stepped-cad-tray-model.test.ts src/lib/stepped-cad-user-repro.test.ts --reporter=verbose`

Expected: PASS for the new two-height recess regression and existing split semantics tests.

- [ ] **Step 5: Commit the refactor**

```bash
git add src/lib/stepped-cad-tray-model.ts src/lib/stepped-cad-split-profiles.ts src/lib/stepped-cad-tray-model.test.ts src/lib/stepped-cad-user-repro.test.ts
git commit -m "refactor: derive stepped cad split interfaces from 2d profiles"
```

### Task 4: Run regression coverage and clean up

**Files:**
- Modify: `src/lib/stepped-cad-tray-model.ts`
- Modify: `src/lib/stepped-cad-split-profiles.ts`
- Modify: `src/lib/stepped-cad-user-repro.test.ts`
- Modify: `src/lib/stepped-cad-tray-model.test.ts`
- Test: `src/lib/jscad-to-three.test.ts`
- Test: `src/lib/stepped-cad-tray-model.test.ts`
- Test: `src/lib/stepped-cad-user-repro.test.ts`

- [ ] **Step 1: Run the conversion regression**

Run: `/Users/bianyunpeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vitest/vitest.mjs run src/lib/jscad-to-three.test.ts --reporter=verbose`

Expected: PASS, confirming the new split geometry still converts to Three.js without closed-geometry errors.

- [ ] **Step 2: Run the full stepped-CAD regression set**

Run: `/Users/bianyunpeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vitest/vitest.mjs run src/lib/stepped-cad-tray-model.test.ts src/lib/stepped-cad-user-repro.test.ts src/lib/jscad-to-three.test.ts --reporter=verbose`

Expected: PASS with lower coplanar-fragment counts for the two-height recess repro and no regression in merged split-unit behavior.

- [ ] **Step 3: Run type-aware sanity checks if geometry code changed shape significantly**

Run: `/Users/bianyunpeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/typescript/bin/tsc --noEmit`

Expected: PASS

- [ ] **Step 4: Inspect the worktree and ensure no temporary probes remain**

Run: `git status --short`

Expected: only intended source/test changes, plus any pre-existing untracked cache directories that should remain untouched.

- [ ] **Step 5: Commit the verified final result**

```bash
git add src/lib/stepped-cad-tray-model.ts src/lib/stepped-cad-split-profiles.ts src/lib/stepped-cad-tray-model.test.ts src/lib/stepped-cad-user-repro.test.ts
git commit -m "fix: reduce stepped cad split interface fragments"
```

## Self-Review

- Spec coverage:
  - 2D split-profile ownership is implemented in Task 2 and Task 3.
  - Merged split-unit behavior is preserved and regression-tested in Task 3 and Task 4.
  - Locator post-processing remains explicit in Task 3.
  - Fragmentation regression coverage is added in Task 1 and enforced in Task 4.
- Placeholder scan:
  - No `TODO`, `TBD`, or deferred implementation markers remain.
- Type consistency:
  - The plan consistently uses `SteppedCadSplitUnitProfile`, `SteppedCadSplitLayerProfile`, `buildSteppedCadSplitUnitProfiles()`, and `attachLocatorFeaturesIfNeeded()`.
