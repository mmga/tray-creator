# Custom Pricing Formula Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace custom-mode weight-based pricing with the agreed `2 + 0.2 * slotCount + effectiveBaseplateArea / 2560` baseline, while keeping the existing custom panel display flow intact.

**Architecture:** Reuse the existing custom effective-footprint derivation as the single source of truth for both model sizing and pricing. Update `calculateCustomPrice` to consume that shared footprint plus slot count, then lock the new behavior with focused Vitest coverage, including representative `2x5` layouts that anchor future recalibration.

**Tech Stack:** TypeScript, Vitest, Next.js app code, JSCAD-derived geometry helpers

---

## File Structure

- Modify: `src/lib/custom-tray-model.ts`
  - Export the custom effective-baseplate calculation so pricing and model dimensions use the same footprint source of truth.
- Modify: `src/lib/custom-tray-model.test.ts`
  - Prove the exported effective-baseplate helper reports stable bounds for pricing reuse.
- Modify: `src/lib/pricing.ts`
  - Replace custom weight-based pricing with the agreed area-and-slot-count baseline.
- Modify: `src/lib/pricing.test.ts`
  - Replace the old custom weight assertions with custom pricing coverage for zero-geometry, slot-count sensitivity, area sensitivity, and representative layouts.
- Read-only reference: `src/components/CustomPanel.tsx`
  - Confirm the existing quote display call site can stay unchanged after the pricing function changes.

### Task 1: Share the custom effective-baseplate helper

**Files:**
- Modify: `src/lib/custom-tray-model.ts`
- Modify: `src/lib/custom-tray-model.test.ts`
- Test: `src/lib/custom-tray-model.test.ts`

- [ ] **Step 1: Write the failing helper-export test**

Add a reusable circle-slot test helper and a new assertion that the effective-baseplate helper exposes the same derived footprint used by custom dimensions:

```ts
import { createCircleSlotSnapshot } from "@/lib/slot-definitions";
import {
  calculateCustomEffectiveBaseplate,
  calculateCustomTrayDimensions,
  createCustomTrayModel,
} from "@/lib/custom-tray-model";

function createCustomCircleSlot(
  id: string,
  x: number,
  y: number,
  baseDiameter: number,
) {
  return {
    id,
    x,
    y,
    width: baseDiameter,
    height: baseDiameter,
    rotation: 0,
    shape: "circle" as const,
    ...createCircleSlotSnapshot(baseDiameter),
  };
}

it("exports the effective custom baseplate footprint for pricing reuse", () => {
  const params = {
    ...CUSTOM_LAYOUT_DEFAULTS,
    spacing: 5,
    boundarySpacing: 5,
    boundarySpacingIndependent: true,
    slots: [
      createCustomCircleSlot("slot-1", 20, 40, 25),
      createCustomCircleSlot("slot-2", 55, 40, 25),
    ],
  };

  expect(calculateCustomEffectiveBaseplate(params)).toEqual({
    hasSlots: true,
    width: 71,
    depth: 36,
    minX: 7.4,
    maxX: 67.6,
    minY: 27.4,
    maxY: 52.6,
  });
  expect(calculateCustomTrayDimensions(params)).toEqual({
    width: 71,
    depth: 36,
    height: 6,
  });
});
```

- [ ] **Step 2: Run the focused helper test and confirm it fails**

Run:

```bash
pnpm exec vitest run src/lib/custom-tray-model.test.ts
```

Expected: FAIL because `calculateCustomEffectiveBaseplate` is not exported from `src/lib/custom-tray-model.ts`.

- [ ] **Step 3: Export and reuse the helper in the model module**

Update `src/lib/custom-tray-model.ts` so the footprint helper becomes the shared seam for model generation and dimensions:

```ts
export function calculateCustomEffectiveBaseplate(
  params: CustomLayoutParams,
) {
  const boundarySpacing = params.boundarySpacingIndependent
    ? params.boundarySpacing
    : params.spacing;

  if (params.slots.length === 0) {
    return {
      hasSlots: false,
      width: 0,
      depth: 0,
      minX: 0,
      maxX: 0,
      minY: 0,
      maxY: 0,
    };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  params.slots.forEach((slot) => {
    const profile = getFreeSlotProfileGeometry(slot);
    const { halfW, halfH } = getSlotBoundingHalfSize(
      profile.width,
      profile.height,
      slot.rotation,
      slot.shape,
      profile.profileExponent,
      profile.outerOffset,
    );
    minX = Math.min(minX, slot.x - halfW);
    maxX = Math.max(maxX, slot.x + halfW);
    minY = Math.min(minY, slot.y - halfH);
    maxY = Math.max(maxY, slot.y + halfH);
  });

  return {
    hasSlots: true,
    width: Math.ceil(maxX - minX + boundarySpacing * 2),
    depth: Math.ceil(maxY - minY + boundarySpacing * 2),
    minX,
    maxX,
    minY,
    maxY,
  };
}

export function createCustomTrayModel(params: CustomLayoutParams): Geom3 {
  const { slots, baseThickness, holeDepth, cornerRadius } = params;
  const effective = calculateCustomEffectiveBaseplate(params);
  const trayWidth = effective.hasSlots ? effective.width : params.trayWidth;
  const trayDepth = effective.hasSlots ? effective.depth : params.trayDepth;
  const totalHeight = baseThickness + holeDepth;
  const sourceCenterX = effective.hasSlots
    ? (effective.minX + effective.maxX) / 2
    : trayWidth / 2;
  const sourceCenterY = effective.hasSlots
    ? (effective.minY + effective.maxY) / 2
    : trayDepth / 2;
}

export function calculateCustomTrayDimensions(params: CustomLayoutParams) {
  const effective = calculateCustomEffectiveBaseplate(params);
  return {
    width: effective.hasSlots ? effective.width : params.trayWidth,
    depth: effective.hasSlots ? effective.depth : params.trayDepth,
    height: params.baseThickness + params.holeDepth,
  };
}
```

- [ ] **Step 4: Re-run the helper test and confirm it passes**

Run:

```bash
pnpm exec vitest run src/lib/custom-tray-model.test.ts
```

Expected: PASS for the new helper-export test and the existing custom tray model tests.

- [ ] **Step 5: Commit the shared-footprint seam**

Run:

```bash
git add src/lib/custom-tray-model.ts src/lib/custom-tray-model.test.ts
git commit -m "refactor: share custom effective baseplate"
```

Expected: a clean commit containing only the helper export and its tests.

### Task 2: Replace custom pricing with the agreed baseline

**Files:**
- Modify: `src/lib/pricing.ts`
- Modify: `src/lib/pricing.test.ts`
- Test: `src/lib/pricing.test.ts`

- [ ] **Step 1: Write the failing pricing tests for the new custom rule**

Extend `src/lib/pricing.test.ts` with custom-layout helpers and replace the old weight-based custom assertions:

```ts
import { createCircleSlotSnapshot } from "@/lib/slot-definitions";

function createCustomCircleSlot(
  id: string,
  x: number,
  y: number,
  baseDiameter: number,
) {
  return {
    id,
    x,
    y,
    width: baseDiameter,
    height: baseDiameter,
    rotation: 0,
    shape: "circle" as const,
    ...createCircleSlotSnapshot(baseDiameter),
  };
}

function createCustomGridLayout(
  baseDiameter: number,
  columns: number,
  rows: number,
) {
  const spacing = 5;
  const boundarySpacing = 5;
  const snapshot = createCircleSlotSnapshot(baseDiameter);
  const slotDiameter = snapshot.slotWidth;

  if (typeof slotDiameter !== "number") {
    throw new Error("Expected slot diameter snapshot");
  }

  const startX = boundarySpacing + slotDiameter / 2;
  const startY = boundarySpacing + slotDiameter / 2;
  const slots = Array.from({ length: rows * columns }, (_, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    return {
      id: `slot-${index + 1}`,
      x: startX + column * (slotDiameter + spacing),
      y: startY + row * (slotDiameter + spacing),
      width: baseDiameter,
      height: baseDiameter,
      rotation: 0,
      shape: "circle" as const,
      ...snapshot,
    };
  });

  return {
    ...CUSTOM_LAYOUT_DEFAULTS,
    spacing,
    boundarySpacing,
    boundarySpacingIndependent: true,
    slots,
  };
}

it("returns zero for non-printable custom geometry and non-positive stepped/simple-stepped volume", () => {
  expect(calculateCustomPrice(CUSTOM_LAYOUT_DEFAULTS, 0)).toBe(0);
  expect(calculateCustomPrice(CUSTOM_LAYOUT_DEFAULTS, 1)).toBe(0);
  expect(
    calculateCustomPrice(
      {
        ...CUSTOM_LAYOUT_DEFAULTS,
        slots: [createCustomCircleSlot("slot-1", 20, 20, 25)],
      },
      0,
    ),
  ).toBe(0);
  expect(calculateSteppedPrice(STEPPED_LAYOUT_DEFAULTS, -1)).toBe(0);
  expect(calculateSimpleSteppedPrice(SIMPLE_STEPPED_LAYOUT_DEFAULTS, 0)).toBe(0);
});

it("prices custom trays from slot count and effective footprint area", () => {
  const compactTwoSlot = {
    ...CUSTOM_LAYOUT_DEFAULTS,
    spacing: 5,
    boundarySpacing: 5,
    boundarySpacingIndependent: true,
    slots: [
      createCustomCircleSlot("slot-1", 20, 40, 25),
      createCustomCircleSlot("slot-2", 55, 40, 25),
    ],
  };
  const compactThreeSlot = {
    ...compactTwoSlot,
    slots: [
      ...compactTwoSlot.slots,
      createCustomCircleSlot("slot-3", 37.5, 40, 25),
    ],
  };
  const wideTwoSlot = {
    ...compactTwoSlot,
    slots: [
      createCustomCircleSlot("slot-1", 20, 40, 25),
      createCustomCircleSlot("slot-2", 90, 40, 25),
    ],
  };

  expect(calculateCustomPrice(compactThreeSlot, 1)).toBeCloseTo(
    calculateCustomPrice(compactTwoSlot, 1) + 0.2,
    5,
  );
  expect(calculateCustomPrice(wideTwoSlot, 1)).toBeGreaterThan(
    calculateCustomPrice(compactTwoSlot, 1),
  );
});

it("matches the agreed representative quotes for 2x5 infantry layouts", () => {
  const infantry25 = createCustomGridLayout(25, 2, 5);
  const infantry32 = createCustomGridLayout(32, 2, 5);

  expect(calculateCustomPrice(infantry25, 1)).toBeCloseTo(8.021875, 5);
  expect(calculateCustomPrice(infantry32, 1)).toBeCloseTo(10, 5);
});
```

- [ ] **Step 2: Run the pricing test file and confirm it fails for the old custom formula**

Run:

```bash
pnpm exec vitest run src/lib/pricing.test.ts
```

Expected: FAIL because `calculateCustomPrice` still uses `weight * 0.4`, so the new custom-price expectations do not match.

- [ ] **Step 3: Implement the custom pricing baseline**

Update `src/lib/pricing.ts` to import the shared footprint helper, define explicit custom pricing constants, and replace the old formula:

```ts
import { calculateCustomEffectiveBaseplate } from "@/lib/custom-tray-model";

const CUSTOM_PRICING_CONFIG = {
  baseFee: 2,
  pricePerSlot: 0.2,
  footprintDivisor: 2560,
} as const;

export function calculateCustomPrice(
  params: CustomLayoutParams,
  volume: number,
): number {
  if (volume <= 0 || params.slots.length === 0) return 0;

  const effective = calculateCustomEffectiveBaseplate(params);
  if (effective.width <= 0 || effective.depth <= 0) return 0;

  return (
    CUSTOM_PRICING_CONFIG.baseFee +
    params.slots.length * CUSTOM_PRICING_CONFIG.pricePerSlot +
    (effective.width * effective.depth) /
      CUSTOM_PRICING_CONFIG.footprintDivisor
  );
}
```

- [ ] **Step 4: Re-run pricing tests and confirm the new baseline passes**

Run:

```bash
pnpm exec vitest run src/lib/pricing.test.ts
```

Expected: PASS, including the representative `2x5` custom-layout quote checks.

- [ ] **Step 5: Commit the custom pricing behavior**

Run:

```bash
git add src/lib/pricing.ts src/lib/pricing.test.ts
git commit -m "feat: reprice custom trays from footprint area"
```

Expected: a clean commit containing only the custom pricing logic and test updates.

### Task 3: Verify the unchanged panel integration and calibration anchors

**Files:**
- Read: `src/components/CustomPanel.tsx`
- Test: `src/lib/custom-tray-model.test.ts`
- Test: `src/lib/pricing.test.ts`

- [ ] **Step 1: Confirm the custom panel call site does not need a code change**

Inspect `src/components/CustomPanel.tsx` and confirm the existing quote display remains:

```tsx
<span className="text-sm font-mono font-bold text-[#eab308]">
  ¥{calculateCustomPrice(params, volume).toFixed(1)}
</span>
{volume > 0 ? (
  <span className="text-[9px] text-muted-foreground">
    估重: {calculateWeight(volume).toFixed(1)}g
  </span>
) : (
  <span className="text-[9px] text-muted-foreground">
    {isGenerating ? "图纸生成中..." : ""}
  </span>
)}
```

Expected: no code edit is needed because the function signature stays `(params, volume)` and the panel already renders quote and estimated weight separately.

- [ ] **Step 2: Run the focused regression suite**

Run:

```bash
pnpm exec vitest run src/lib/custom-tray-model.test.ts src/lib/pricing.test.ts
```

Expected: PASS for the helper export, custom pricing baseline, and existing stepped/grid pricing coverage.

- [ ] **Step 3: Run lint and typecheck on the touched area**

Run:

```bash
pnpm exec eslint src/lib/custom-tray-model.ts src/lib/custom-tray-model.test.ts src/lib/pricing.ts src/lib/pricing.test.ts --max-warnings=0
pnpm typecheck
```

Expected: both commands PASS with no new lint or TypeScript errors in the touched files.

- [ ] **Step 4: Record the representative quote anchors for later recalibration**

Use the passing representative test expectations as the initial calibration anchors:

```text
2x5 25mm custom layout -> 8.021875 -> UI displays 8.0
2x5 32mm custom layout -> 10 -> UI displays 10.0
```

Expected: these anchors are available for the next pricing-tuning pass without adding another temporary script.

- [ ] **Step 5: Commit the verification pass**

If Step 3 required source edits, run:

```bash
git add src/lib/custom-tray-model.ts src/lib/custom-tray-model.test.ts src/lib/pricing.ts src/lib/pricing.test.ts
git commit -m "chore: verify custom pricing baseline"
```

Expected: no commit is needed when verification passes without code changes; otherwise create one small tidy-up commit only for the fixes discovered during verification.
