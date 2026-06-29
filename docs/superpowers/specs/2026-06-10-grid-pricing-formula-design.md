# Grid Pricing Formula Design

## Context

Grid mode currently prices trays from a legacy quote ladder:

- per-slot diameter tiers
- optional magnet-hole surcharge

That pricing rule now diverges from the agreed flat-tray pricing baseline already adopted by custom mode.

The agreed migration rule for grid mode is:

- fully replace the legacy grid quote ladder
- reuse the same coefficients as custom mode
- price from slot count plus displayed tray footprint area

The migrated grid pricing baseline is:

`rawPrice = 2 + 0.2 * slotCount + gridFootprintArea / 2560`
`price = ceil(rawPrice)`

Where:

- `slotCount = rows * columns`
- `gridFootprintArea = displayedWidth * displayedDepth`
- `displayedWidth` and `displayedDepth` come from the same `calculateTrayDimensions()` derivation already shown in the grid UI

## Goals

- Replace grid-mode diameter-tier pricing with the agreed area-and-slot-count baseline.
- Keep grid and custom flat-tray modes aligned on the same quote coefficients.
- Use the same displayed footprint dimensions that grid mode already exposes to the user.
- Add focused test coverage for the migrated grid pricing rule.

## Non-Goals

- No pricing changes for custom, stepped, or simple stepped modes in this change.
- No hybrid rule that keeps magnet-hole surcharges or diameter-tier pricing.
- No UI redesign for the grid panel.
- No recalibration of the shared coefficients in this change.

## Design

### 1. Pricing inputs

Grid pricing will stop depending on:

- slot-diameter price tiers
- magnet-hole surcharge flags

The quote will instead use:

- fixed base fee: `2`
- per-slot increment: `0.2`
- area coefficient: `1 / 2560`

The grid quote inputs are:

- `slotCount = params.rows * params.columns`
- `displayedWidth` and `displayedDepth` from `calculateTrayDimensions(params)`
- `gridFootprintArea = displayedWidth * displayedDepth`

### 2. Formula behavior

`calculateGridPrice` will be redefined to return:

`ceil(2 + 0.2 * slotCount + gridFootprintArea / 2560)`

Subject to these guards:

- return `0` when `slotCount <= 0`
- return `0` when the derived grid footprint area is non-positive

The formula should keep decimal precision internally until the final quote is produced, then round the final quote upward with `Math.ceil`. The grid panel can keep its existing rendering path; it will simply show integer-valued quotes through the current formatting.

### 3. Shared dimension seam

The implementation should reuse `calculateTrayDimensions(params)` instead of re-deriving width and depth inside pricing.

That keeps:

- displayed grid dimensions
- grid pricing footprint

on the same source of truth.

### 4. Tests

`pricing.test.ts` will stop asserting the old diameter-tier ladder for grid pricing.
Instead it will assert that:

- zero-slot grid layouts return `0`
- grid pricing rises with slot count when footprint is otherwise comparable
- grid pricing rises with footprint area when slot count is held constant
- representative `2x5` grid layouts priced as `5 columns x 2 rows` ceil to the shared flat-tray anchors:
  - `25mm -> 8`
  - `32mm -> 10`

## Task Breakdown

1. Replace `calculateGridPrice` with the shared flat-tray baseline using grid dimensions.
2. Remove dependence on the legacy diameter-tier ladder and magnet-hole surcharge in grid pricing.
3. Update pricing tests to cover the migrated grid rule and remove the old ladder assertions.
4. Verify the existing grid panel quote display path still works unchanged.

## Verification

- Run the pricing test file after the change.
- Verify the grid panel still shows quote and estimated weight separately.
- Spot-check representative `5x2` grid layouts for `25mm` and `32mm` against the pre-ceil raw formula and the final ceiled anchors.

## Risks

- Migrating grid to the shared baseline will intentionally change all legacy grid prices at once.
- Because footprint area includes actual slot size, spacing, and boundary spacing, small layout parameter changes can move the quote more than the old ladder did.
