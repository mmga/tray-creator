# Remove Non-CAD Stepped Split Design

## Goal

Remove split preview and split export from the non-CAD `stepped` route so the product has one clear rule:

- `stepped` only supports whole-model preview and whole-model export
- `stepped-cad` owns all split-part assembly behavior

At the same time, old non-CAD saved params that still contain split fields must remain importable and be normalized into the new whole-model-only shape without user-visible errors.

## Problem

The current codebase keeps two separate split-part implementations:

- non-CAD split generation in `src/lib/stepped-tray-model.ts`
- CAD split generation in `src/lib/stepped-cad-tray-model.ts`

That creates architectural friction:

1. The `stepped` route exposes split controls, split preview state, split export, worker requests, and model-service APIs even though split assembly is now primarily a CAD concern.
2. Callers of `useSteppedLayout` have to understand both whole-model and split-part preview/export flows.
3. The worker and service layer maintain two near-related but divergent split seams.
4. Historical non-CAD split parameters (`splitGrooveDepth`, `groups[].splitPartGroupId`) remain live in runtime state, which keeps old product semantics active instead of explicitly retiring them.

This is low leverage. The interface cost of carrying non-CAD split support is spread across UI, hooks, workers, service adapters, and tests.

## Decision

Retire non-CAD split functionality completely for new behavior, while keeping import compatibility for old saved params.

The target product rule is:

- `stepped`:
  - whole-model preview only
  - whole-model STL export only
  - no split preview
  - no split export
  - no split configuration UI
- `stepped-cad`:
  - keeps split preview and split export
  - keeps split assembly controls

Historical non-CAD split fields are accepted at import time, but normalized away immediately.

## Scope

In scope:

- non-CAD `stepped` panel controls
- non-CAD `useSteppedLayout` split preview/export state and commands
- non-CAD stepped model service split APIs
- non-CAD worker request/response path for split generation
- non-CAD split model tests
- param normalization for old split fields in `stepped`

Out of scope:

- CAD split semantics and CAD split UI
- redesigning `stepped-cad` split terminology
- changing whole-model stepped geometry generation
- changing integration tests unrelated to non-CAD split retirement

## Existing Seams

Today the non-CAD split behavior leaks across several seams:

1. `src/lib/stepped-tray-model.ts`
   - owns `createSteppedSplitParts`
   - owns groove-depth-driven split assembly geometry

2. `src/lib/stepped-model-service.ts`
   - exposes `generateSteppedSplitPreview`
   - exposes `exportSteppedSplitPartFiles`

3. `src/lib/worker/worker-service.ts`
   - exposes `generateSteppedSplitParts`

4. `src/lib/worker/tray.worker.ts`
   - handles `GENERATE_STEPPED_SPLIT_PARTS`

5. `src/hooks/useSteppedLayout.ts`
   - injects split preview/export adapters into the controller

6. `src/hooks/useSteppedLayoutController.ts`
   - stores split preview state
   - exposes split preview/export commands

7. `src/components/SteppedPanel.tsx`
   - exposes non-CAD split controls

8. viewer/viewport code
   - supports non-CAD split preview rendering

This is exactly the kind of shallow spread that should be deleted instead of abstracted.

## Target Module Boundaries

After this change:

### Non-CAD `stepped`

Allowed responsibilities:

- manage stepped groups and slots
- generate whole-model geometry
- preview whole-model geometry
- export whole-model STL + params
- generate outline preview

Removed responsibilities:

- split preview
- split export
- split assembly groove ownership
- split grouping UI

### CAD `stepped-cad`

Unchanged responsibilities:

- split-part generation
- split preview
- split export
- split assembly controls

This concentrates split assembly leverage in one route instead of two.

## Parameter Strategy

Do not remove the TypeScript fields in this pass.

Keep these fields in `SteppedLayoutParams` / `SlotGroup` for compatibility:

- `splitGrooveDepth`
- `splitPartGroupId`

But change runtime semantics:

- when normalizing `mode === "stepped"` data:
  - reset `splitGrooveDepth` to the non-split default value
  - delete every `groups[].splitPartGroupId`

This means:

- old JSON still parses
- old split configuration does not survive into live non-CAD behavior
- future saved non-CAD params stop carrying retired split state

This is intentionally narrower than deleting the type fields immediately, which would entangle runtime retirement with stored-data format churn.

## UI and Interaction Design

For non-CAD `stepped`:

- remove split preview action
- remove split export action
- remove split grouping controls
- remove non-CAD split groove controls and related explanatory text

For `stepped-cad`:

- keep current split controls and actions

For shared viewers:

- stop passing non-CAD split parts into `TrayViewer`
- keep CAD split preview rendering unchanged

The user-facing product rule becomes obvious in the interface:

- if you want split parts, switch to CAD stepped mode

## Service and Worker Design

Delete the non-CAD split seam rather than turning it into a stub.

### Delete from non-CAD stepped service layer

- `generateSteppedSplitPreview`
- `exportSteppedSplitPartFiles`

### Delete from worker-service

- `generateSteppedSplitParts`

### Delete from worker protocol

- request type: `GENERATE_STEPPED_SPLIT_PARTS`
- response use for non-CAD split parts
- worker branch calling `createSteppedSplitParts`

### Delete from non-CAD hook/controller surface

- `splitPreviewParts`
- `isGeneratingSplitPreview`
- `handleGenerateSplitPreview`
- `handleExportSplitParts`
- `clearSplitPreview`
- injected `generateSplitPreview`
- injected `exportSplitParts`

This preserves a deep interface: callers of `useSteppedLayout` only deal with whole-model behavior.

## Model Layer Design

Delete `createSteppedSplitParts` from `src/lib/stepped-tray-model.ts`.

The remaining non-CAD model file should only own:

- stepped whole-model geometry generation
- stepped dimensions
- support logic needed by the whole-model geometry path

Any helper that only exists to support non-CAD split generation should be deleted with it.

This is a deletion-test win:

- if the split-specific helpers disappear with the deleted feature, they were not earning their keep as reusable modules
- the remaining module becomes easier to navigate because it matches the actual product surface

## Testing Strategy

### Remove or rewrite

- non-CAD split geometry tests in `src/lib/stepped-tray-model.test.ts`
- non-CAD split service tests in `src/lib/stepped-model-service.test.ts`
- non-CAD split worker tests
- non-CAD split hook/controller tests

### Add or keep

1. `param-normalization`
   - importing old non-CAD split params clears `splitGrooveDepth`
   - importing old non-CAD split params clears `groups[].splitPartGroupId`

2. `useSteppedLayout`
   - whole-model generation still works
   - whole-model export still works
   - split-specific actions/state are no longer exposed

3. `SteppedPanel`
   - non-CAD split controls are absent

4. `stepped-cad`
   - existing CAD split tests stay green to prove split behavior still exists where intended

### Verification sequence

- targeted tests for normalization, panel, hook/controller, service, worker
- `./node_modules/.bin/tsc --noEmit`
- `./node_modules/.bin/vitest run`

## Risks

### Risk 1: Delete only the UI and leave the behavior seam alive

If the worker/service/controller split seam remains, the codebase still communicates a false product capability.

Mitigation:

- remove service, worker, and hook seams together with the UI

### Risk 2: Old saved params continue to silently re-activate retired semantics

If normalization does not clear old split fields, imported data can keep polluting runtime state.

Mitigation:

- normalize non-CAD `splitGrooveDepth`
- delete non-CAD `splitPartGroupId` on import

### Risk 3: CAD split accidentally regresses

The UI and shared view code touch adjacent concepts.

Mitigation:

- keep CAD-specific split code paths unchanged
- retain CAD split tests and run full default unit coverage

## Implementation Outline

1. Normalize away retired non-CAD split params
2. Remove non-CAD split actions from `useSteppedLayout` and its controller
3. Remove non-CAD split APIs from stepped model service and worker-service
4. Remove non-CAD split request handling from the worker
5. Delete `createSteppedSplitParts` and split-only helpers from `stepped-tray-model.ts`
6. Remove non-CAD split UI and shared viewer wiring
7. Delete obsolete non-CAD split tests and add normalization/UI regression coverage
8. Run typecheck and full default unit tests

## Expected Outcome

After the change:

- non-CAD stepped mode has one coherent whole-model interface
- CAD owns all split assembly leverage
- old non-CAD split params remain importable but are retired on normalization
- the codebase has better locality because split complexity is concentrated in one route instead of duplicated across two
