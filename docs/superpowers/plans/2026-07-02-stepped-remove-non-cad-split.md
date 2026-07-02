# Remove Non-CAD Stepped Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove split preview/export from non-CAD `stepped`, normalize away retired split params, and keep CAD split behavior untouched.

**Architecture:** Delete the non-CAD split seam end to end instead of hiding it behind stubs. Keep `SteppedLayoutParams` compatibility fields for import/export stability, but scrub their values during non-CAD normalization so runtime state becomes whole-model-only.

**Tech Stack:** Next.js, React hooks, TypeScript, Vitest, JSCAD worker pipeline

---

### Task 1: Normalize away retired non-CAD split params

**Files:**
- Modify: `src/lib/param-normalization.ts`
- Test: `src/lib/param-normalization.test.ts`

- [ ] Update stepped normalization so `splitGrooveDepth` resets to `STEPPED_LAYOUT_DEFAULTS.splitGrooveDepth` and every `groups[].splitPartGroupId` is deleted for non-CAD `stepped`.
- [ ] Rewrite the stepped normalization tests to assert retired split fields are cleared instead of preserved.
- [ ] Run: `./node_modules/.bin/vitest run src/lib/param-normalization.test.ts`

### Task 2: Remove non-CAD split seam from hooks and workspace wiring

**Files:**
- Modify: `src/hooks/useSteppedLayout.ts`
- Modify: `src/hooks/useSteppedLayoutController.ts`
- Modify: `src/workspaces/stepped/useSteppedWorkspace.tsx`
- Modify: `src/viewports/stepped/useSteppedViewportWorkspace.tsx`
- Test: `src/app/page.test.tsx`

- [ ] Delete non-CAD split preview/export state, commands, and injected adapters from the stepped hook/controller surface.
- [ ] Remove non-CAD split workspace wiring so stepped viewports only pass whole-model preview data.
- [ ] Update tests and mocks that still expect `splitPreviewParts`, `handleGenerateSplitPreview`, `handleExportSplitParts`, or `updateGroupSplitPartTarget`.
- [ ] Run: `./node_modules/.bin/vitest run src/app/page.test.tsx`

### Task 3: Remove non-CAD split UI controls

**Files:**
- Modify: `src/components/SteppedPanel.tsx`
- Test: `src/components/panels.test.tsx`

- [ ] Delete non-CAD split grouping UI, split export button usage, and non-CAD split groove controls from the stepped panel while leaving CAD controls intact.
- [ ] Update panel tests to stop expecting non-CAD split controls and add assertions that the removed controls are absent in stepped mode.
- [ ] Run: `./node_modules/.bin/vitest run src/components/panels.test.tsx`

### Task 4: Remove non-CAD split service and worker APIs

**Files:**
- Modify: `src/lib/model-ports.ts`
- Modify: `src/lib/stepped-model-service.ts`
- Modify: `src/lib/worker/worker-service.ts`
- Modify: `src/lib/worker/tray.worker.ts`
- Test: `src/lib/stepped-model-service.test.ts`
- Test: `src/lib/worker/worker-service.test.ts`
- Test: `src/lib/worker/tray.worker.test.ts`

- [ ] Delete `generateSteppedSplitPreview`, `exportSteppedSplitPartFiles`, `generateSteppedSplitParts`, and `GENERATE_STEPPED_SPLIT_PARTS` from the non-CAD pipeline.
- [ ] Keep the CAD split worker/service seam unchanged.
- [ ] Rewrite tests so they only cover whole-model stepped service behavior and the remaining CAD split behavior.
- [ ] Run: `./node_modules/.bin/vitest run src/lib/stepped-model-service.test.ts src/lib/worker/worker-service.test.ts src/lib/worker/tray.worker.test.ts`

### Task 5: Delete non-CAD split geometry implementation and tests

**Files:**
- Modify: `src/lib/stepped-tray-model.ts`
- Test: `src/lib/stepped-tray-model.test.ts`

- [ ] Remove `createSteppedSplitParts` and any helper only used by non-CAD split generation.
- [ ] Trim the stepped geometry tests down to whole-model behavior only.
- [ ] Run: `./node_modules/.bin/vitest run src/lib/stepped-tray-model.test.ts`

### Task 6: Full verification and cleanup

**Files:**
- Review: `git diff --stat`

- [ ] Run: `./node_modules/.bin/tsc --noEmit`
- [ ] Run: `./node_modules/.bin/vitest run`
- [ ] Review remaining worktree changes and confirm only intended files changed.
- [ ] Commit with a focused message for non-CAD split retirement.
