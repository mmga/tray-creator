# Graph Report - .  (2026-04-13)

## Corpus Check
- 152 files · ~0 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 529 nodes · 985 edges · 28 communities detected
- Extraction: 83% EXTRACTED · 17% INFERRED · 0% AMBIGUOUS · INFERRED: 166 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## God Nodes (most connected - your core abstractions)
1. `TrayWorkerService` - 11 edges
2. `generateOutlineGeom2()` - 9 edges
3. `createDraft()` - 8 edges
4. `readIndex()` - 7 edges
5. `updateDraft()` - 7 edges
6. `deriveSimpleSteppedLayout()` - 7 edges
7. `generateRequestId()` - 7 edges
8. `draftRecordKey()` - 6 edges
9. `writeIndex()` - 6 edges
10. `getDraft()` - 6 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Communities

### Community 0 - "Community 0"
Cohesion: 0.04
Nodes (6): calculateCustomEffectiveDimensions(), resolveCustomBoundarySpacing(), FailingFileReader, exportSteppedModelFiles(), getSteppedSTLFilename(), FakeWorker

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (5): calculateCanvasDragSnap(), roundToStep(), getSvgPointFromClient(), handlePointerDown(), handleRotateMouseDown()

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (0): 

### Community 3 - "Community 3"
Cohesion: 0.09
Nodes (8): calculateEffectiveBaseplate(), getEllipseBoundingBox(), getSlotLabelRotation(), normalizeDisplayAngle(), getEllipsePolygon(), getPolygonBuffer(), buildCollisionPolygon(), hasSpacingCollision()

### Community 4 - "Community 4"
Cohesion: 0.15
Nodes (17): buildParamFile(), clampField(), createParamBlob(), downloadParamFile(), exportParams(), getRawSteppedDisconnectDistance(), getRawSteppedSmoothingRadius(), parseParamFileObject() (+9 more)

### Community 5 - "Community 5"
Cohesion: 0.2
Nodes (15): buildSummary(), createDraft(), defaultDraftTitle(), deleteDraft(), draftRecordKey(), exportDraft(), getDraft(), listDrafts() (+7 more)

### Community 6 - "Community 6"
Cohesion: 0.11
Nodes (7): getFiniteOr(), normalizeGridParams(), replaceGridParams(), resetGridParams(), updateGridParam(), createWorkerSelf(), loadWorkerModule()

### Community 7 - "Community 7"
Cohesion: 0.12
Nodes (8): buildCustomParamsBlob(), exportCustomModelFiles(), getCustomSTLFilename(), buildGridParamsBlob(), exportGridModelFiles(), getGridSTLFilename(), jscadToThreeGeometry(), projectTo2D()

### Community 8 - "Community 8"
Cohesion: 0.17
Nodes (18): arrangeRowSymmetrically(), buildAlternatingOrder(), buildCompactCandidates(), buildGroupCompactCandidates(), calculateDisplacement(), composeGroupPlacements(), createCompactSeed(), evaluateCompactCandidate() (+10 more)

### Community 9 - "Community 9"
Cohesion: 0.12
Nodes (7): buildMirrorInsertSlots(), buildMirrorMoveUpdates(), getSelectionBounds(), mirrorSlot(), normalizeRotation(), resolveMirrorAxis(), roundToStep()

### Community 10 - "Community 10"
Cohesion: 0.17
Nodes (13): buildActiveRowSeeds(), buildSimpleSteppedRowBands(), calculateSimpleSteppedDimensions(), calculateSimpleSteppedMinimumTraySize(), clampSimpleSteppedSlotUpdates(), deriveSimpleSteppedLayout(), getEffectiveOuterMargin(), getStoredTrayDepth() (+5 more)

### Community 11 - "Community 11"
Cohesion: 0.19
Nodes (17): calculateCustomPrice(), calculateGridPrice(), calculateSimpleSteppedPrice(), calculateSteppedMaterialDensity(), calculateSteppedPrice(), calculateWeight(), clamp(), getSlotPrice() (+9 more)

### Community 12 - "Community 12"
Cohesion: 0.21
Nodes (13): computeAdaptiveSegments(), computeCircleIntersections(), computeTangencyEpsilon(), correctJunctionVertices(), generateOutline(), generateOutlineGeom2(), insetPolygon(), lineIntersection() (+5 more)

### Community 13 - "Community 13"
Cohesion: 0.22
Nodes (7): calculateCustomTrayDimensions(), calculateEffectiveBaseplate(), createCustomTrayModel(), calculateTrayDimensions(), createTrayModel(), getGridBoundarySpacingAxes(), getGridSpacingAxes()

### Community 14 - "Community 14"
Cohesion: 0.26
Nodes (9): emitPerfListeners(), getPerfMetricsSnapshot(), isPerfEnabled(), measurePerf(), recordPerfSample(), resetPerfMetrics(), resolvePerfEnabled(), schedulePerfListeners() (+1 more)

### Community 15 - "Community 15"
Cohesion: 0.14
Nodes (0): 

### Community 16 - "Community 16"
Cohesion: 0.15
Nodes (0): 

### Community 17 - "Community 17"
Cohesion: 0.24
Nodes (7): analyzeBridgeWarning(), clusterConnectivityCircles(), getCircleGap(), getEffectiveBridgeGap(), calculateEffectiveBaseplate(), calculateSteppedTrayDimensions(), createSteppedTrayModel()

### Community 18 - "Community 18"
Cohesion: 0.26
Nodes (2): generateRequestId(), TrayWorkerService

### Community 19 - "Community 19"
Cohesion: 0.2
Nodes (0): 

### Community 20 - "Community 20"
Cohesion: 0.29
Nodes (2): getSelectionBounds(), getSelectionCenter()

### Community 21 - "Community 21"
Cohesion: 0.29
Nodes (0): 

### Community 22 - "Community 22"
Cohesion: 0.4
Nodes (3): MockIntersectionObserver, MockResizeObserver, MockWorker

### Community 23 - "Community 23"
Cohesion: 0.5
Nodes (0): 

### Community 24 - "Community 24"
Cohesion: 1.0
Nodes (2): collect_code_files(), main()

### Community 25 - "Community 25"
Cohesion: 1.0
Nodes (0): 

### Community 26 - "Community 26"
Cohesion: 1.0
Nodes (0): 

### Community 27 - "Community 27"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **3 isolated node(s):** `MockWorker`, `MockResizeObserver`, `MockIntersectionObserver`
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 25`** (1 nodes): `next-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 26`** (1 nodes): `next.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 27`** (1 nodes): `jscad.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `TrayWorkerService` connect `Community 18` to `Community 0`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Why does `generateRequestId()` connect `Community 18` to `Community 0`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **Are the 8 inferred relationships involving `generateOutlineGeom2()` (e.g. with `computeTangencyEpsilon()` and `computeAdaptiveSegments()`) actually correct?**
  _`generateOutlineGeom2()` has 8 INFERRED edges - model-reasoned connections that need verification._
- **Are the 7 inferred relationships involving `createDraft()` (e.g. with `readIndex()` and `defaultDraftTitle()`) actually correct?**
  _`createDraft()` has 7 INFERRED edges - model-reasoned connections that need verification._
- **Are the 6 inferred relationships involving `readIndex()` (e.g. with `safeGetItem()` and `listDrafts()`) actually correct?**
  _`readIndex()` has 6 INFERRED edges - model-reasoned connections that need verification._
- **Are the 6 inferred relationships involving `updateDraft()` (e.g. with `getDraft()` and `buildSummary()`) actually correct?**
  _`updateDraft()` has 6 INFERRED edges - model-reasoned connections that need verification._
- **What connects `MockWorker`, `MockResizeObserver`, `MockIntersectionObserver` to the rest of the system?**
  _3 weakly-connected nodes found - possible documentation gaps or missing edges._