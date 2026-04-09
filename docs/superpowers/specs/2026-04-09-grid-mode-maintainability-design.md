# Grid Mode Maintainability Design

## Context

Grid mode currently has four maintainability problems:

1. State transitions are split between the hook and UI, so reset/import can bypass stale-preview bookkeeping.
2. STL export can pair old geometry with new params.
3. The preset selector is uncontrolled and can drift from the real params.
4. Grid and custom panels duplicate auto-preview and action-area logic.

## Goals

- Centralize grid param mutations inside the hook.
- Keep preview/cache/export behavior consistent after every param change.
- Make the grid preset selector reflect the current params at all times.
- Reduce duplication between grid and custom panels without pulling stepped mode into this refactor.

## Non-Goals

- No behavior redesign for stepped mode.
- No large UI rewrite.
- No broad refactor of pricing, worker, or model-generation internals.

## Design

### 1. Harden the grid hook API

`useTrayModel` will stop exposing the raw React setter. Instead it will expose focused actions:

- `updateParam`
- `replaceParams`
- `resetParams`

These actions will be the only write entry points for grid params. They will maintain:

- `isPreviewStale`
- geometry cache invalidation when params are replaced
- spacing/boundary-spacing invariants

`handleExportSTL` will reject export when the preview is stale or when no generated model exists.

### 2. Make preset selection controlled

`ParameterPanel` will derive the selected preset from `params.holeDiameter` and pass it to the select as `value`. If the diameter does not exactly match a preset, the select will show its placeholder instead of a stale default.

### 3. Extract shared panel logic

Two shared pieces will be introduced for grid/custom panels:

- a small hook for auto-preview debounce behavior
- a shared action section component for generate/export/reset/import controls

The extracted layer will be mode-agnostic and driven by props. Grid/custom will still own their mode-specific summaries and statistics.

## Task Breakdown

1. Add spec/plan docs and commit.
2. Refactor `useTrayModel` to centralize param replacement, keep invariants, and guard export.
3. Convert the grid preset select to controlled state.
4. Extract shared panel action logic used by both grid/custom panels.

## Verification

- Lint the touched files after each code task.
- Manually inspect the reset/import/export paths for grid mode.
- Confirm grid/custom still compile after the shared extraction.
