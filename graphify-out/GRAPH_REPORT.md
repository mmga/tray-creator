# Graph Report - .  (2026-04-09)

## Corpus Check
- 112 files · ~186,331 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 414 nodes · 729 edges · 26 communities detected
- Extraction: 84% EXTRACTED · 16% INFERRED · 0% AMBIGUOUS · INFERRED: 117 edges (avg confidence: 0.52)
- Token cost: 28,000 input · 5,200 output

## God Nodes (most connected - your core abstractions)
1. `CLAUDE` - 17 edges
2. `Requirements` - 11 edges
3. `TrayWorkerService` - 10 edges
4. `generateOutlineGeom2()` - 9 edges
5. `createDraft()` - 8 edges
6. `Grid Maintainability Design` - 8 edges
7. `readIndex()` - 7 edges
8. `updateDraft()` - 7 edges
9. `Stepped Tray` - 7 edges
10. `validateSteppedParams()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `Stepped Tray` --conceptually_related_to--> `Bottom-height columnar model`  [INFERRED]
  doc/stepped-tray.md → claude-progress.txt
- `Layout Customizer` --conceptually_related_to--> `Custom mode`  [INFERRED]
  doc/layout-customizer.md → CLAUDE.md
- `Requirements` --references--> `Next.js App Router`  [EXTRACTED]
  doc/requirements.md → requirements.md
- `Requirements` --references--> `shadcn/ui`  [EXTRACTED]
  doc/requirements.md → requirements.md
- `Requirements` --references--> `Tailwind CSS v4`  [EXTRACTED]
  doc/requirements.md → requirements.md

## Hyperedges (group relationships)
- **Right panel reorganization** — src/components/AlignmentToolbar.tsx, src/components/canvas/EditSidebar.tsx, src/components/canvas/AlignPanel.tsx, src/components/canvas/MirrorPanel.tsx, concept/alignment-toolbar, concept/tab-accordion, concept/mirror-symmetry [EXTRACTED 1.00]
- **Stepped performance hot path** — src/hooks/useSteppedLayout.ts, src/components/LayoutCanvas.tsx, src/lib/worker/worker-service.ts, concept/outline-preview-worker, concept/performance-metrics, concept/manual-generate-only [EXTRACTED 1.00]
- **Grid maintainability loop** — src/hooks/useTrayModel.ts, src/components/ParameterPanel.tsx, src/hooks/useAutoPreview.ts, src/components/PanelActionSection.tsx, concept/useTrayModel-guard, concept/controlled-preset-select, concept/shared-panel-actions, concept/export-guard-stale-preview [EXTRACTED 1.00]

## Communities

### Community 0 - "Custom Tray Modeling"
Cohesion: 0.06
Nodes (8): calculateCustomTrayDimensions(), calculateEffectiveBaseplate(), createCustomTrayModel(), calculateCustomPrice(), calculateGridPrice(), calculateSteppedPrice(), calculateWeight(), getSlotPrice()

### Community 1 - "App Shell & Modes"
Cohesion: 0.06
Nodes (5): exportSteppedModelFiles(), getSteppedSTLFilename(), buildPerfGroups(), buildSteppedPerfFixture(), roundToTenth()

### Community 2 - "Project Documentation"
Cohesion: 0.05
Nodes (55): CLAUDE, README, Claude Progress, 3D pipeline, Alignment toolbar, Bottom-height columnar model, Collision detection, Custom mode (+47 more)

### Community 3 - "Canvas Geometry Engine"
Cohesion: 0.07
Nodes (9): calculateEffectiveBaseplate(), getEllipseBoundingBox(), getSlotLabelRotation(), normalizeDisplayAngle(), calculateCanvasDragSnap(), roundToStep(), getSvgPointFromClient(), handlePointerDown() (+1 more)

### Community 4 - "Alignment UI"
Cohesion: 0.09
Nodes (13): getSelectionBounds(), getSelectionCenter(), getEllipsePolygon(), getPolygonBuffer(), buildMirrorInsertSlots(), buildMirrorMoveUpdates(), getSelectionBounds(), mirrorSlot() (+5 more)

### Community 5 - "Draft Dialog System"
Cohesion: 0.18
Nodes (15): buildSummary(), createDraft(), defaultDraftTitle(), deleteDraft(), draftRecordKey(), exportDraft(), getDraft(), listDrafts() (+7 more)

### Community 6 - "Model Export Services"
Cohesion: 0.16
Nodes (8): buildCustomParamsBlob(), exportCustomModelFiles(), getCustomSTLFilename(), buildGridParamsBlob(), exportGridModelFiles(), getGridSTLFilename(), jscadToThreeGeometry(), projectTo2D()

### Community 7 - "Parameter Import Export"
Cohesion: 0.25
Nodes (13): buildParamFile(), clampField(), createParamBlob(), downloadParamFile(), exportParams(), getRawSteppedDisconnectDistance(), getRawSteppedSmoothingRadius(), parseParamFileObject() (+5 more)

### Community 8 - "Outline Geometry"
Cohesion: 0.28
Nodes (13): computeAdaptiveSegments(), computeCircleIntersections(), computeTangencyEpsilon(), correctJunctionVertices(), generateOutline(), generateOutlineGeom2(), insetPolygon(), lineIntersection() (+5 more)

### Community 9 - "Custom Layout Actions"
Cohesion: 0.15
Nodes (2): calculateCustomEffectiveDimensions(), resolveCustomBoundarySpacing()

### Community 10 - "Performance Instrumentation"
Cohesion: 0.26
Nodes (9): emitPerfListeners(), getPerfMetricsSnapshot(), isPerfEnabled(), measurePerf(), recordPerfSample(), resetPerfMetrics(), resolvePerfEnabled(), schedulePerfListeners() (+1 more)

### Community 11 - "Grid Maintainability"
Cohesion: 0.24
Nodes (13): Auto preview debounce, Controlled preset select, Grid maintainability, Lint warnings in generated bundle, Shared panel actions, useTrayModel write guard, Grid Maintainability Plan, Grid Maintainability Design (+5 more)

### Community 12 - "Stepped Connectivity"
Cohesion: 0.27
Nodes (7): analyzeBridgeWarning(), clusterConnectivityCircles(), getCircleGap(), getEffectiveBridgeGap(), calculateEffectiveBaseplate(), calculateSteppedTrayDimensions(), createSteppedTrayModel()

### Community 13 - "Worker Service"
Cohesion: 0.27
Nodes (2): generateRequestId(), TrayWorkerService

### Community 14 - "Select UI Primitive"
Cohesion: 0.2
Nodes (0): 

### Community 15 - "Stepped Layout Actions"
Cohesion: 0.2
Nodes (0): 

### Community 16 - "Local Drafts"
Cohesion: 0.4
Nodes (6): Export param file format, Local drafts, LocalStorage-first, Stepped Local Draft Plan, Keep drafts local because data is small and the app is static, param-io.ts

### Community 17 - "Grid State Store"
Cohesion: 0.7
Nodes (4): normalizeGridParams(), replaceGridParams(), resetGridParams(), updateGridParam()

### Community 18 - "Next Env Declarations"
Cohesion: 1.0
Nodes (0): 

### Community 19 - "Next Config"
Cohesion: 1.0
Nodes (0): 

### Community 20 - "JSCAD Type Declarations"
Cohesion: 1.0
Nodes (0): 

### Community 21 - "File Icon"
Cohesion: 1.0
Nodes (1): Generic file icon

### Community 22 - "Globe Icon"
Cohesion: 1.0
Nodes (1): Globe / World Icon

### Community 23 - "Next.js Branding"
Cohesion: 1.0
Nodes (1): Next.js Logo

### Community 24 - "Vercel Branding"
Cohesion: 1.0
Nodes (1): Vercel Logo Mark

### Community 25 - "Window Icon"
Cohesion: 1.0
Nodes (1): Window Icon

## Knowledge Gaps
- **23 isolated node(s):** `Lint Output`, `outline-geometry.ts`, `AlignPanel.tsx`, `Tailwind CSS v4`, `@jscad/modeling` (+18 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Next Env Declarations`** (1 nodes): `next-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Next Config`** (1 nodes): `next.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `JSCAD Type Declarations`** (1 nodes): `jscad.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `File Icon`** (1 nodes): `Generic file icon`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Globe Icon`** (1 nodes): `Globe / World Icon`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Next.js Branding`** (1 nodes): `Next.js Logo`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Vercel Branding`** (1 nodes): `Vercel Logo Mark`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Window Icon`** (1 nodes): `Window Icon`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `TrayWorkerService` connect `Worker Service` to `App Shell & Modes`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Why does `CLAUDE` connect `Project Documentation` to `Local Drafts`, `Grid Maintainability`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Why does `generateRequestId()` connect `Worker Service` to `App Shell & Modes`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Are the 8 inferred relationships involving `generateOutlineGeom2()` (e.g. with `computeTangencyEpsilon()` and `computeAdaptiveSegments()`) actually correct?**
  _`generateOutlineGeom2()` has 8 INFERRED edges - model-reasoned connections that need verification._
- **Are the 7 inferred relationships involving `createDraft()` (e.g. with `readIndex()` and `defaultDraftTitle()`) actually correct?**
  _`createDraft()` has 7 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Lint Output`, `outline-geometry.ts`, `AlignPanel.tsx` to the rest of the system?**
  _23 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Custom Tray Modeling` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._