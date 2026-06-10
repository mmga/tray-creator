# Custom Pricing Formula Design

## Context

Custom mode currently prices trays from generated model volume via `weight * 0.4`.
That pricing model no longer matches the agreed business rule for custom trays.

The agreed custom pricing baseline is now:

`price = 2 + 0.2 * slotCount + effectiveBaseplateArea / 2560`

Where:

- `slotCount` is the number of placed slot instances in the current custom layout.
- `effectiveBaseplateArea` is the derived printable footprint area of the custom tray, calculated from the effective baseplate width and depth already shown in the UI.

Historical sample prices are treated as reference points and sanity checks, not as an exact fitted law. Representative layouts will be reviewed later to recalibrate coefficients if needed.

## Goals

- Replace the custom-mode weight-based quote with the agreed area-and-slot-count baseline.
- Keep the pricing inputs aligned with the custom-mode domain language already used in the UI: effective baseplate size and slot count.
- Preserve current display behavior in the custom panel except for the quote value itself.
- Add test coverage for the new custom pricing rule.

## Non-Goals

- No pricing changes for grid, stepped, or simple stepped modes.
- No new custom-mode surcharge tiers by slot size, shape, magnet holes, or spacing.
- No immediate calibration pass against a broader layout catalog in this change.
- No redesign of the custom panel statistics UI.

## Design

### 1. Pricing inputs

Custom pricing will stop depending on generated model volume except for the existing zero-price guard when there is no printable geometry.

The quote will instead use:

- fixed base fee: `2`
- per-slot increment: `0.2`
- area coefficient: `1 / 2560`

The custom quote inputs are:

- `slotCount = params.slots.length`
- `effectiveWidth` and `effectiveDepth` from the same effective-baseplate derivation already used by custom-mode dimensions
- `effectiveBaseplateArea = effectiveWidth * effectiveDepth`

### 2. Formula behavior

`calculateCustomPrice` will be redefined to return:

`2 + 0.2 * slotCount + effectiveBaseplateArea / 2560`

Subject to these guards:

- return `0` when there is no printable geometry
- treat the derived effective baseplate as the pricing footprint, not raw `trayWidth` and `trayDepth`

The function should continue to return a numeric quote without rounding to an integer. The custom panel can keep rendering one decimal place as it does today.

### 3. Shared calculation seam

The implementation should avoid duplicating the effective-baseplate calculation logic.

If the current effective width/depth derivation is private to the model module, expose or reuse it through a small shared helper so both:

- custom dimensions
- custom pricing

consume the same source of truth.

### 4. Tests

`pricing.test.ts` will stop asserting that custom pricing scales from model weight.
Instead it will assert that:

- non-positive or non-printable custom geometry returns `0`
- custom pricing rises with slot count when footprint is otherwise comparable
- custom pricing rises with effective baseplate area when slot count is held constant
- at least one representative layout matches the baseline formula numerically

## Task Breakdown

1. Refactor the custom effective-baseplate calculation into a reusable seam if needed.
2. Replace `calculateCustomPrice` with the agreed baseline formula.
3. Keep the custom panel quote display path unchanged except for consuming the new quote value.
4. Update pricing tests to cover the new rule and remove the old weight-based custom assertions.
5. Generate representative layout quotes after implementation to support later calibration.

## Verification

- Run the pricing test file after the change.
- Verify the custom panel still shows quote and estimated weight separately.
- Manually spot-check a few representative custom layouts after implementation and compare them against the baseline formula.

## Risks

- Effective footprint is sensitive to slot geometry, rotation, and boundary spacing, so visually similar layouts can price differently by design.
- The baseline coefficients are intentionally provisional and may need recalibration after reviewing representative layouts.
