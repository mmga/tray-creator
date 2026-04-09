# Grid Mode Maintainability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve grid mode structure and consistency by centralizing state writes, fixing export correctness, controlling preset UI, and extracting shared panel logic.

**Architecture:** Keep mode-specific behavior in each hook/panel, but move shared state invariants and shared action UI behind small explicit APIs. Avoid large file moves and limit refactors to grid/custom surfaces already involved in these findings.

**Tech Stack:** Next.js, React, TypeScript, ESLint

---

### Task 1: Document the refactor scope

**Files:**
- Create: `docs/superpowers/specs/2026-04-09-grid-mode-maintainability-design.md`
- Create: `docs/superpowers/plans/2026-04-09-grid-mode-maintainability.md`

- [ ] **Step 1: Write the design and plan docs**

Document the approved scope:

- grid hook write-entry refactor
- export guard
- controlled preset select
- shared grid/custom panel extraction

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-04-09-grid-mode-maintainability-design.md docs/superpowers/plans/2026-04-09-grid-mode-maintainability.md
git commit -m "docs: add grid maintainability design and plan"
```

### Task 2: Centralize grid param writes and export checks

**Files:**
- Modify: `src/hooks/useTrayModel.ts`
- Modify: `src/components/ParameterPanel.tsx`

- [ ] **Step 1: Replace raw grid setter exposure with explicit actions**

Add focused APIs in `useTrayModel`:

- `replaceParams(next: TrayParams)`
- `resetParams()`

Keep all stale-preview invalidation inside the hook.

- [ ] **Step 2: Encode grid spacing invariants**

Match custom-mode behavior for:

- syncing `boundarySpacing` when `spacing` changes while independence is off
- restoring `boundarySpacing` when independence toggles off

- [ ] **Step 3: Guard export against stale preview**

Block export when:

- no generated geometry exists
- preview is stale

- [ ] **Step 4: Update the panel to use the new actions**

Remove direct `setParams` usage for reset/import.

- [ ] **Step 5: Run lint**

Run: `pnpm exec eslint src/hooks/useTrayModel.ts src/components/ParameterPanel.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useTrayModel.ts src/components/ParameterPanel.tsx
git commit -m "refactor: centralize grid state updates"
```

### Task 3: Make the grid preset selector controlled

**Files:**
- Modify: `src/components/ParameterPanel.tsx`

- [ ] **Step 1: Derive preset selection from params**

Drive the preset select via `params.holeDiameter`.

- [ ] **Step 2: Keep non-preset diameters safe**

If the diameter does not match a preset exactly, show the placeholder rather than a fake selected preset.

- [ ] **Step 3: Run lint**

Run: `pnpm exec eslint src/components/ParameterPanel.tsx`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/ParameterPanel.tsx
git commit -m "fix: control grid preset selection"
```

### Task 4: Extract shared grid/custom panel action logic

**Files:**
- Create: `src/hooks/useAutoPreview.ts`
- Create: `src/components/PanelActionSection.tsx`
- Modify: `src/components/ParameterPanel.tsx`
- Modify: `src/components/CustomPanel.tsx`

- [ ] **Step 1: Extract auto-preview debounce hook**

Move the repeated debounce logic into `useAutoPreview`.

- [ ] **Step 2: Extract shared action section**

Move generate/export/reset/import controls into `PanelActionSection`.

- [ ] **Step 3: Wire grid/custom panels to the shared pieces**

Keep mode-specific labels and props outside the shared internals unless they are already identical.

- [ ] **Step 4: Run lint**

Run: `pnpm exec eslint src/hooks/useAutoPreview.ts src/components/PanelActionSection.tsx src/components/ParameterPanel.tsx src/components/CustomPanel.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useAutoPreview.ts src/components/PanelActionSection.tsx src/components/ParameterPanel.tsx src/components/CustomPanel.tsx
git commit -m "refactor: share panel action logic"
```
