# Stepped CAD Split Profile Design

## Goal

Replace the current post-body 3D split recess workflow with a split-profile workflow that derives final per-part interface geometry in 2D before layered extrusion, so stepped CAD split parts keep assembly clearance while avoiding fragmented coplanar faces on lower-part interface edges.

## Problem

The current `stepped-cad` split flow builds each split-unit body first, then applies assembly features with 3D CSG:

- Lower parts receive interface pockets via 3D `subtract`
- Upper parts receive interface tenons or tabs via 3D `union`
- Optional locator features are added afterward

This is acceptable for assembly semantics, but it creates unstable geometry at interface boundaries when the lower-part top surface already incorporates upper-group context in its footprint. A later recess cut with nearly the same boundary re-slices that horizontal surface into many small coplanar faces.

The issue is most visible when:

- There are only two height bands
- `enableSplitRecess` is enabled
- The lower-part top surface already follows the upper-part outline context
- The recess depth is shallow relative to the interface height

Increasing assembly clearance helps part-to-part fit, but it does not solve the root issue because the problematic near-coincident geometry is between the lower part's own existing top surface and the later recess cut, not only between the male and female assembly surfaces.

## Decision

Move split recess and tenon ownership from post-extrusion 3D body editing into a 2D split-profile contract:

1. Build the base stepped CAD feature graph as today.
2. Derive split-unit interface profiles in 2D for each relevant height band.
3. Extrude those final 2D profiles into layered solids.
4. Reserve 3D post-processing only for features that cannot be naturally represented in planar section, primarily locator pins and locator sockets.

This keeps the main split interface geometry out of the most fragile 3D coplanar CSG path.

## Scope

In scope:

- `stepped-cad` split-part generation
- `enableSplitRecess`
- Default groove-depth-based tenon/pocket interfaces
- Merged split-unit behavior
- Regression coverage for fragmented coplanar faces

Out of scope:

- The non-CAD `stepped` split path in `src/lib/stepped-tray-model.ts`
- Redesigning locator dimensions or aesthetics beyond what is needed to fit the new ownership model
- STL export behavior unrelated to split-part geometry

## Existing Geometry Model

The current flow has two levels:

1. `src/lib/stepped-cad-feature-graph.ts`
   - Builds base group footprints and height bands
   - Encodes slot-hole and base-hole data

2. `src/lib/stepped-cad-tray-model.ts`
   - Builds split units
   - Extrudes split bodies
   - Applies recess pockets, tenons, tabs, and locators as 3D features

The critical current behavior is that lower-group footprints can already include higher-group context before split assembly features are applied. That means the lower-part top surface is already shaped in relation to the upper part before the recess cut happens.

## Target Geometry Contract

The new split interface contract is defined in 2D first.

For each split interface:

- `contact footprint`
  - The shared support/contact region that defines alignment intent between upper and lower parts
- `male footprint`
  - The footprint used for the upper part's protruding alignment tenon
- `female footprint`
  - The footprint used for the lower part's receiving recess

Rules:

1. `male footprint` is derived from the contact footprint with an inward offset.
2. `female footprint` is derived from the male footprint with a small outward offset for assembly clearance.
3. The lower part's recess geometry is represented as one or more dedicated 2D layer profiles, not as a later 3D subtraction from an already-finished top surface.
4. The upper part's tenon/tab geometry is represented as one or more dedicated 2D layer profiles, not as a later 3D union into an already-finished body.

This preserves the intended fit relationship:

- Upper tenon smaller than lower recess
- Both derived from the same interface contact semantics
- Clearance explicitly encoded in 2D

## Parameters

This design keeps the existing public controls and introduces internal geometry constants first.

User-facing inputs that remain:

- `splitGrooveDepth`
- `enableSplitRecess`
- `enableSplitLocators`

Internal geometry parameters for the new contract:

- `interface contact inset`
  - Reuses the current intent of shrinking from the raw support footprint before creating a mating shape
- `assembly clearance`
  - New internal constant for the female-vs-male footprint difference
- `interface epsilon overlap`
  - Small vertical overlap retained only where needed to avoid open seams between adjacent extrusions

Initial recommendation:

- Keep the current contact inset behavior as the baseline
- Add a small female clearance around the male footprint
- Keep the clearance internal for the first pass so the migration stays narrow

## Proposed Data Model

Add a split-profile layer between the feature graph and split-part solid construction.

Suggested new module:

- `src/lib/stepped-cad-split-profiles.ts`

Suggested concepts:

- `SteppedCadSplitUnitProfile`
  - `key`
  - `minHeight`
  - `maxHeight`
  - `layers`
  - `slotHoles`
  - `baseHoles`

- `SteppedCadSplitLayerProfile`
  - `fromHeight`
  - `toHeight`
  - `footprint`
  - `kind`

- `SteppedCadInterfaceProfile`
  - `interfaceHeight`
  - `contactFootprint`
  - `maleFootprint`
  - `femaleFootprint`

`kind` is an internal label only, used to reason about which bands represent body, recess, or tenon layers during tests and debugging.

## Build Algorithm

### 1. Base feature graph

Keep `buildSteppedCadFeatureGraph()` as the source of:

- group footprints
- layers
- slot-hole geometry
- base-hole geometry

This file should stay responsible for stepped CAD base semantics, not split interface feature ownership.

### 2. Split-unit partitioning

Keep the existing split-unit grouping semantics:

- same merged-group behavior
- same ordering by height
- same external base-height calculation

This preserves file labeling and split ownership semantics.

### 3. Interface profile derivation

For each split unit and each relevant interface:

- Determine the `contact footprint` from the interface support area
- Derive:
  - `male footprint = inset(contact footprint, contact inset)`
  - `female footprint = offset(male footprint, clearance)`

The key point is that the lower part should not be constructed as "full top surface, then pocket cut". Instead, its final upper interface region is split into explicit vertical bands:

- body band below the recess
- recess band using the female footprint relationship

Similarly, the upper part should not be "body, then tenon union". It should be built as:

- tenon band below the base interface
- body band above the interface

### 4. Layer-profile assembly

Generate final 2D layer profiles for each split unit:

- body layers for the unit's ordinary height bands
- lower recess layers where applicable
- upper tenon/tab layers where applicable

Then extrude each layer and union only vertically adjacent layers belonging to the same part.

This still uses 3D union between stacked layers, but avoids the problematic "subtract pocket from existing horizontal top face with nearly identical boundary" path.

### 5. Hole application

After the final split-unit layered body is assembled:

- subtract slot holes
- subtract magnetic base holes if enabled

This remains unchanged from the current broad ownership model and is already consistent with the stepped CAD contract.

### 6. Locator features

Locator pins and sockets remain a special case.

For the first pass:

- Keep locator geometry as post-body 3D features
- Attach them to the new layered body result instead of the old pocket/tenon body
- Do not use locator features to define the main interface footprint

Rationale:

- Locator features are localized and do not own the full interface edge
- Their residual mesh complexity is acceptable compared with fragmenting the entire recess boundary
- This reduces migration risk while preserving printable locator behavior

## File Changes

### Modify

- `src/lib/stepped-cad-tray-model.ts`
  - Replace pocket/tenon body construction with profile-driven layered body construction
  - Keep split-unit grouping, labeling, hole subtraction, cleanup, and locator post-processing

- `src/lib/stepped-cad-user-repro.test.ts`
  - Extend regression assertions around fragmented coplanar faces

- `src/lib/stepped-cad-tray-model.test.ts`
  - Update or extend interface semantics tests for profile-driven split geometry

### Add

- `src/lib/stepped-cad-split-profiles.ts`
  - Build split-unit interface profiles and final layer profiles

## Migration Strategy

Implement in small stages:

1. Add split-profile builder without changing production behavior
2. Add tests that validate profile-derived footprints on representative fixtures
3. Switch `createSteppedCadSplitParts()` to the new profile-driven body path
4. Reattach locator post-processing on top of the new body
5. Tune thresholds in regression tests only if geometry is improved in the expected direction

This reduces the chance of mixing a geometry rewrite with an unobservable correctness change.

## Testing Strategy

### Targeted geometry tests

Add tests that prove:

- changing `splitGrooveDepth` still changes the mating geometry in the intended direction
- merged split groups still behave as one unified split unit
- `enableSplitRecess` still creates the expected lower receiving geometry and upper protruding geometry

### Fragmentation regression tests

Add or update tests that measure:

- small horizontal faces near the lower interface top
- small horizontal faces near the recess floor

Representative expectations:

- the two-height downloaded repro should show a clear reduction in small coplanar horizontal faces around the lower interface when `enableSplitRecess` is enabled
- the existing complex user repro should not regress into higher fragmentation than the current accepted thresholds

### Conversion regression tests

Keep tests that ensure:

- `jscadToThreeGeometry()` does not throw
- resulting parts have valid volume and expected bounds

## Risks

### Semantic drift

Rebuilding split interfaces in 2D could unintentionally change current mating geometry. This is controlled by keeping the contact-footprint derivation semantics aligned with the current support-footprint logic and validating bounds plus relative interface heights in tests.

### Merged split-unit behavior

Merged groups depend on whole-unit geometry semantics. The new profile builder must derive interface profiles at the merged-unit level, not per original group in isolation.

### Locator interaction

Locators may still add local mesh complexity. This is acceptable as long as they no longer force the full recess edge back into the fragile 3D pocket-cut path.

## Success Criteria

The change is successful when all of the following are true:

- Split parts still assemble with intended clearance semantics
- Lower-part recess edges no longer fragment into large numbers of tiny coplanar faces in the reported repro class
- Existing merged split-unit behavior remains valid
- Locator mode remains printable and convertible
- `jscadToThreeGeometry()` remains stable on the current repro fixtures

## Non-Goals

- Making every split-part surface perfectly minimal in polygon count
- Eliminating all 3D booleans from the entire stepped CAD pipeline
- Introducing new user-facing controls for clearance in the first pass
