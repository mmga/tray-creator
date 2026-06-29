# Grid Pricing Formula Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace grid-mode diameter-tier pricing with the shared flat-tray baseline, then round the final grid quote upward to the next integer yuan.

**Architecture:** Reuse `calculateTrayDimensions(params)` as the single source of truth for grid footprint width and depth, then price grid trays from slot count plus that footprint area, preserving decimal precision until the end of the formula and rounding the final quote upward with `Math.ceil`. Keep the grid panel call site unchanged, and lock the migration with focused Vitest coverage for zero-layout guards, slot-count sensitivity, area sensitivity, and representative `5x2` anchor layouts.

**Tech Stack:** TypeScript, Vitest, Next.js app code, existing tray geometry helpers

---

## File Structure

- Modify: `src/lib/pricing.ts`
  - Replace the legacy grid price ladder with the shared flat-tray baseline, and remove dead ladder helpers/config from the grid path.
- Modify: `src/lib/pricing.test.ts`
  - Remove the old grid ladder assertions and add coverage for the migrated grid formula.
- Read-only reference: `src/lib/tray-model.ts`
  - Reuse `calculateTrayDimensions(params)` for the grid footprint seam.
- Read-only reference: `src/components/ParameterPanel.tsx`
  - Confirm the existing quote display path still works unchanged with the migrated pricing function.

### Task 1: Migrate grid pricing to the flat-tray baseline

**Files:**
- Modify: `src/lib/pricing.ts`
- Modify: `src/lib/pricing.test.ts`
- Test: `src/lib/pricing.test.ts`

- [ ] **Step 1: Write the failing grid pricing tests**

Extend `src/lib/pricing.test.ts` with a grid snapshot helper, a grid params helper, and replace the old ladder test block with migrated grid pricing coverage:

```ts
import { createGridSlotSnapshotFromDefinition } from "@/lib/slot-instance-factory";

function createGridParams(overrides: Partial<typeof DEFAULT_TRAY_PARAMS>) {
  const holeDiameter =
    overrides.holeDiameter ?? DEFAULT_TRAY_PARAMS.holeDiameter;

  return {
    ...DEFAULT_TRAY_PARAMS,
    ...createGridSlotSnapshotFromDefinition(holeDiameter),
    ...overrides,
  };
}

describe("pricing", () => {
  it("returns zero for empty grid layouts", () => {
    expect(
      calculateGridPrice(
        createGridParams({
          rows: 0,
          columns: 5,
        }),
      ),
    ).toBe(0);
    expect(
      calculateGridPrice(
        createGridParams({
          rows: 2,
          columns: 0,
        }),
      ),
    ).toBe(0);
  });

  it("prices grid trays from slot count and footprint area", () => {
    const compactTwoSlot = createGridParams({
      rows: 1,
      columns: 2,
      holeDiameter: 25,
      spacing: 5,
      boundarySpacing: 5,
      spacingIndependent: false,
      boundarySpacingIndependent: false,
      enableBaseHole: false,
    });
    const compactThreeSlot = createGridParams({
      rows: 1,
      columns: 3,
      holeDiameter: 25,
      spacing: 2,
      boundarySpacing: 5,
      spacingIndependent: false,
      boundarySpacingIndependent: true,
      enableBaseHole: false,
    });
    const wideTwoSlot = createGridParams({
      rows: 1,
      columns: 2,
      holeDiameter: 25,
      spacing: 10,
      boundarySpacing: 20,
      spacingIndependent: false,
      boundarySpacingIndependent: true,
      enableBaseHole: false,
    });

    expect(calculateGridPrice(compactThreeSlot)).toBeGreaterThan(
      calculateGridPrice(compactTwoSlot),
    );
    expect(calculateGridPrice(wideTwoSlot)).toBeGreaterThan(
      calculateGridPrice(compactTwoSlot),
    );
  });

  it("matches the shared flat-tray anchors for representative 5x2 grid layouts", () => {
    const infantry25 = createGridParams({
      rows: 2,
      columns: 5,
      holeDiameter: 25,
      spacing: 5,
      boundarySpacing: 5,
      spacingIndependent: false,
      boundarySpacingIndependent: false,
      enableBaseHole: false,
    });
    const infantry32 = createGridParams({
      rows: 2,
      columns: 5,
      holeDiameter: 32,
      spacing: 5,
      boundarySpacing: 5,
      spacingIndependent: false,
      boundarySpacingIndependent: false,
      enableBaseHole: false,
    });

    const infantry25Price = calculateGridPrice(infantry25);
    const infantry32Price = calculateGridPrice(infantry32);

    expect(infantry25Price).toBe(8);

    expect(infantry32Price).toBe(10);
  });
});
```

- [ ] **Step 2: Run the focused pricing test file and confirm the old grid ladder fails**

Run:

```bash
pnpm exec vitest run src/lib/pricing.test.ts
```

Expected: FAIL because `calculateGridPrice` still uses diameter tiers and optional magnet-hole surcharges instead of the flat-tray baseline.

- [ ] **Step 3: Replace the grid ladder with the shared flat-tray baseline**

Update `src/lib/pricing.ts` to reuse `calculateTrayDimensions(params)` and share the same coefficient set as custom pricing:

```ts
import { calculateTrayDimensions } from "@/lib/tray-model";

const FLAT_TRAY_PRICING_CONFIG = {
  baseFee: 2,
  pricePerSlot: 0.2,
  footprintDivisor: 2560,
} as const;

export function calculateGridPrice(params: TrayParams): number {
  const slotCount = params.rows * params.columns;
  if (slotCount <= 0) return 0;

  const dimensions = calculateTrayDimensions(params);
  const footprintArea = dimensions.width * dimensions.depth;
  const rawPrice =
    FLAT_TRAY_PRICING_CONFIG.baseFee +
    slotCount * FLAT_TRAY_PRICING_CONFIG.pricePerSlot +
    footprintArea / FLAT_TRAY_PRICING_CONFIG.footprintDivisor;

  if (footprintArea <= 0) return 0;

  return Math.ceil(rawPrice);
}

export function calculateCustomPrice(
  params: CustomLayoutParams,
  volume: number,
): number {
  if (volume <= 0 || params.slots.length === 0) return 0;

  const effective = calculateCustomEffectiveBaseplate(params);
  const footprintArea = effective.width * effective.depth;
  const rawPrice =
    FLAT_TRAY_PRICING_CONFIG.baseFee +
    params.slots.length * FLAT_TRAY_PRICING_CONFIG.pricePerSlot +
    footprintArea / FLAT_TRAY_PRICING_CONFIG.footprintDivisor;

  if (!effective.hasSlots || footprintArea <= 0) return 0;

  return Math.ceil(rawPrice);
}
```

Delete the now-retired grid ladder pieces from `src/lib/pricing.ts`:

```ts
function getSlotPrice(diameter: number): number {
  if (diameter <= 25.01) return 0.5;
  if (diameter <= 28.51) return 0.6;
  if (diameter <= 32.01) return 0.8;
  if (diameter <= 40.01) return 1;
  if (diameter <= 50.01) return 1.3;
  return 2.0;
}
```

and remove the unused magnet-hole surcharge from `PRICING_CONFIG`:

```ts
const PRICING_CONFIG = {
  plaCostPerKg: 60,
  plaDensity: 1.24,
  infillRatio: 0.6,
};
```

- [ ] **Step 4: Re-run the focused pricing tests and confirm they pass**

Run:

```bash
pnpm exec vitest run src/lib/pricing.test.ts
```

Expected: PASS, including the new grid zero-layout, slot-count, area-sensitivity, and `5x2` anchor assertions.

- [ ] **Step 5: Commit the migrated grid pricing behavior**

Run:

```bash
git add src/lib/pricing.ts src/lib/pricing.test.ts
git commit -m "feat: align grid pricing with flat tray baseline"
```

Expected: a clean commit containing only the grid pricing migration and its tests.

### Task 2: Verify the unchanged grid panel integration

**Files:**
- Read: `src/components/ParameterPanel.tsx`
- Test: `src/lib/pricing.test.ts`

- [ ] **Step 1: Confirm the grid panel quote display call site stays unchanged**

Inspect `src/components/ParameterPanel.tsx` and confirm the existing quote rendering remains:

```tsx
<span className="text-sm font-mono font-bold text-[#eab308]">
  ¥{calculateGridPrice(params).toFixed(2)}
</span>
{volume > 0 ? (
  <span className="text-[9px] text-muted-foreground">
    PLA估重: {calculateWeight(volume).toFixed(1)}g
  </span>
) : (
  <span className="text-[9px] text-muted-foreground">
    {isGenerating ? "图纸生成中..." : "待锻造"}
  </span>
)}
```

Expected: no code edit is needed because the `calculateGridPrice(params)` signature stays unchanged, and the panel should keep showing quote and estimated weight separately.

- [ ] **Step 2: Run lint and typecheck on the touched pricing files**

Run:

```bash
pnpm exec eslint src/lib/pricing.ts src/lib/pricing.test.ts --max-warnings=0
pnpm typecheck
```

Expected: both commands PASS with no new lint or TypeScript errors in the touched files.

- [ ] **Step 3: Re-run the focused pricing suite as the final regression check**

Run:

```bash
pnpm exec vitest run src/lib/pricing.test.ts
```

Expected: PASS, confirming the grid migration did not regress the existing custom, simple-stepped, or stepped pricing coverage in the shared test file.

- [ ] **Step 4: Record the representative grid anchors for later coefficient calibration**

Use the passing representative grid test expectations as the initial migrated anchors:

```text
5x2 25mm grid layout -> raw price just under 8 -> final quote 8
5x2 32mm grid layout -> raw price just under 10 -> final quote 10
```

Expected: these anchors remain documented for any later pricing-tuning pass without adding ad hoc scripts.

- [ ] **Step 5: Commit only if verification required a tidy-up**

If Step 2 or Step 3 required source edits, run:

```bash
git add src/lib/pricing.ts src/lib/pricing.test.ts
git commit -m "chore: verify grid pricing migration"
```

Expected: no commit is needed when verification passes without code changes; otherwise create one small tidy-up commit only for the fixes discovered during verification.
