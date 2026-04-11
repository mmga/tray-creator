# Graph Report - src  (2026-04-11)

## Corpus Check
- 129 files · ~59,895 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 480 nodes · 911 edges · 20 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
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

### Community 0 - "Alignment Canvas"
Cohesion: 0.04
Nodes (11): getSelectionBounds(), getSelectionCenter(), calculateEffectiveBaseplate(), getEllipseBoundingBox(), getSlotLabelRotation(), normalizeDisplayAngle(), calculateCanvasDragSnap(), roundToStep() (+3 more)

### Community 1 - "Stepped Slot Actions"
Cohesion: 0.04
Nodes (7): jscadToThreeGeometry(), projectTo2D(), exportSteppedModelFiles(), getSteppedSTLFilename(), buildPerfGroups(), buildSteppedPerfFixture(), roundToTenth()

### Community 2 - "Panel Controls"
Cohesion: 0.08
Nodes (1): FailingFileReader

### Community 3 - "Custom Layout Editing"
Cohesion: 0.05
Nodes (5): calculateCustomEffectiveDimensions(), resolveCustomBoundarySpacing(), buildCustomParamsBlob(), exportCustomModelFiles(), getCustomSTLFilename()

### Community 4 - "Tray Geometry Models"
Cohesion: 0.08
Nodes (18): calculateCustomTrayDimensions(), calculateEffectiveBaseplate(), createCustomTrayModel(), calculateSimpleSteppedTrayVolume(), createEmptyGeom(), createSimpleSteppedTrayModel(), analyzeBridgeWarning(), clusterConnectivityCircles() (+10 more)

### Community 5 - "Draft Persistence"
Cohesion: 0.17
Nodes (15): buildSummary(), createDraft(), defaultDraftTitle(), deleteDraft(), draftRecordKey(), exportDraft(), getDraft(), listDrafts() (+7 more)

### Community 6 - "Grid Model Pipeline"
Cohesion: 0.12
Nodes (8): buildGridParamsBlob(), exportGridModelFiles(), getGridSTLFilename(), getFiniteOr(), normalizeGridParams(), replaceGridParams(), resetGridParams(), updateGridParam()

### Community 7 - "Mirror Collision Tools"
Cohesion: 0.11
Nodes (4): getEllipsePolygon(), getPolygonBuffer(), buildCollisionPolygon(), hasSpacingCollision()

### Community 8 - "Simple Stepped Layout"
Cohesion: 0.16
Nodes (10): buildActiveRowSeeds(), buildSimpleSteppedRowBands(), calculateSimpleSteppedDimensions(), calculateSimpleSteppedMinimumTraySize(), clampSimpleSteppedSlotUpdates(), deriveSimpleSteppedLayout(), getEffectiveOuterMargin(), getStoredTrayDepth() (+2 more)

### Community 9 - "Global Optimization"
Cohesion: 0.19
Nodes (16): calculateDisplacement(), collidesAtPosition(), compactAlongAxis(), compactSlots(), createCompactSeed(), createGroupedSeed(), createMinimalMoveSeed(), createSeeds() (+8 more)

### Community 10 - "Pricing Logic"
Cohesion: 0.19
Nodes (17): calculateCustomPrice(), calculateGridPrice(), calculateSimpleSteppedPrice(), calculateSteppedMaterialDensity(), calculateSteppedPrice(), calculateWeight(), clamp(), getSlotPrice() (+9 more)

### Community 11 - "Parameter IO"
Cohesion: 0.25
Nodes (14): buildParamFile(), clampField(), createParamBlob(), downloadParamFile(), exportParams(), getRawSteppedDisconnectDistance(), getRawSteppedSmoothingRadius(), parseParamFileObject() (+6 more)

### Community 12 - "Outline Geometry"
Cohesion: 0.28
Nodes (13): computeAdaptiveSegments(), computeCircleIntersections(), computeTangencyEpsilon(), correctJunctionVertices(), generateOutline(), generateOutlineGeom2(), insetPolygon(), lineIntersection() (+5 more)

### Community 13 - "Worker Service"
Cohesion: 0.24
Nodes (2): generateRequestId(), TrayWorkerService

### Community 14 - "Performance Metrics"
Cohesion: 0.38
Nodes (9): emitPerfListeners(), getPerfMetricsSnapshot(), isPerfEnabled(), measurePerf(), recordPerfSample(), resetPerfMetrics(), resolvePerfEnabled(), schedulePerfListeners() (+1 more)

### Community 15 - "Layout Symmetry"
Cohesion: 0.27
Nodes (7): buildMirrorInsertSlots(), buildMirrorMoveUpdates(), getSelectionBounds(), mirrorSlot(), normalizeRotation(), resolveMirrorAxis(), roundToStep()

### Community 16 - "3D Tray Viewer"
Cohesion: 0.2
Nodes (0): 

### Community 17 - "Page Tabs"
Cohesion: 0.29
Nodes (0): 

### Community 18 - "Test Setup Mocks"
Cohesion: 0.4
Nodes (3): MockIntersectionObserver, MockResizeObserver, MockWorker

### Community 19 - "JSCAD Types"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **3 isolated node(s):** `MockWorker`, `MockResizeObserver`, `MockIntersectionObserver`
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `JSCAD Types`** (1 nodes): `jscad.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What connects `MockWorker`, `MockResizeObserver`, `MockIntersectionObserver` to the rest of the system?**
  _3 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Alignment Canvas` be split into smaller, more focused modules?**
  _Cohesion score 0.04 - nodes in this community are weakly interconnected._
- **Should `Stepped Slot Actions` be split into smaller, more focused modules?**
  _Cohesion score 0.04 - nodes in this community are weakly interconnected._
- **Should `Panel Controls` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._
- **Should `Custom Layout Editing` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Tray Geometry Models` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._
- **Should `Grid Model Pipeline` be split into smaller, more focused modules?**
  _Cohesion score 0.12 - nodes in this community are weakly interconnected._