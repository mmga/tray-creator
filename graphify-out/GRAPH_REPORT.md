# Graph Report - .  (2026-04-13)

## Corpus Check
- 99 files · ~0 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 395 nodes · 771 edges · 21 communities detected
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

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (13): calculateEffectiveBaseplate(), getEllipseBoundingBox(), getSlotLabelRotation(), normalizeDisplayAngle(), calculateCanvasDragSnap(), roundToStep(), calculateCustomEffectiveDimensions(), resolveCustomBoundarySpacing() (+5 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (8): buildCustomParamsBlob(), exportCustomModelFiles(), getCustomSTLFilename(), buildGridParamsBlob(), exportGridModelFiles(), getGridSTLFilename(), jscadToThreeGeometry(), projectTo2D()

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (0): 

### Community 3 - "Community 3"
Cohesion: 0.08
Nodes (10): analyzeBridgeWarning(), clusterConnectivityCircles(), getCircleGap(), getEffectiveBridgeGap(), buildPerfGroups(), buildSteppedPerfFixture(), roundToTenth(), calculateEffectiveBaseplate() (+2 more)

### Community 4 - "Community 4"
Cohesion: 0.1
Nodes (10): calculateCustomTrayDimensions(), calculateEffectiveBaseplate(), createCustomTrayModel(), calculateSimpleSteppedTrayVolume(), createEmptyGeom(), createSimpleSteppedTrayModel(), calculateTrayDimensions(), createTrayModel() (+2 more)

### Community 5 - "Community 5"
Cohesion: 0.17
Nodes (18): arrangeRowSymmetrically(), buildAlternatingOrder(), buildCompactCandidates(), buildGroupCompactCandidates(), calculateDisplacement(), composeGroupPlacements(), createCompactSeed(), evaluateCompactCandidate() (+10 more)

### Community 6 - "Community 6"
Cohesion: 0.13
Nodes (7): buildMirrorInsertSlots(), buildMirrorMoveUpdates(), getSelectionBounds(), mirrorSlot(), normalizeRotation(), resolveMirrorAxis(), roundToStep()

### Community 7 - "Community 7"
Cohesion: 0.32
Nodes (15): buildSummary(), createDraft(), defaultDraftTitle(), deleteDraft(), draftRecordKey(), exportDraft(), getDraft(), listDrafts() (+7 more)

### Community 8 - "Community 8"
Cohesion: 0.25
Nodes (14): buildParamFile(), clampField(), createParamBlob(), downloadParamFile(), exportParams(), getRawSteppedDisconnectDistance(), getRawSteppedSmoothingRadius(), parseParamFileObject() (+6 more)

### Community 9 - "Community 9"
Cohesion: 0.28
Nodes (13): computeAdaptiveSegments(), computeCircleIntersections(), computeTangencyEpsilon(), correctJunctionVertices(), generateOutline(), generateOutlineGeom2(), insetPolygon(), lineIntersection() (+5 more)

### Community 10 - "Community 10"
Cohesion: 0.26
Nodes (9): emitPerfListeners(), getPerfMetricsSnapshot(), isPerfEnabled(), measurePerf(), recordPerfSample(), resetPerfMetrics(), resolvePerfEnabled(), schedulePerfListeners() (+1 more)

### Community 11 - "Community 11"
Cohesion: 0.29
Nodes (10): buildActiveRowSeeds(), buildSimpleSteppedRowBands(), calculateSimpleSteppedDimensions(), calculateSimpleSteppedMinimumTraySize(), clampSimpleSteppedSlotUpdates(), deriveSimpleSteppedLayout(), getEffectiveOuterMargin(), getStoredTrayDepth() (+2 more)

### Community 12 - "Community 12"
Cohesion: 0.27
Nodes (12): calculateCustomPrice(), calculateGridPrice(), calculateSimpleSteppedPrice(), calculateSteppedMaterialDensity(), calculateSteppedPrice(), calculateWeight(), clamp(), getSlotPrice() (+4 more)

### Community 13 - "Community 13"
Cohesion: 0.26
Nodes (2): generateRequestId(), TrayWorkerService

### Community 14 - "Community 14"
Cohesion: 0.22
Nodes (4): getEllipsePolygon(), getPolygonBuffer(), buildCollisionPolygon(), hasSpacingCollision()

### Community 15 - "Community 15"
Cohesion: 0.52
Nodes (5): getFiniteOr(), normalizeGridParams(), replaceGridParams(), resetGridParams(), updateGridParam()

### Community 16 - "Community 16"
Cohesion: 0.4
Nodes (2): getSelectionBounds(), getSelectionCenter()

### Community 17 - "Community 17"
Cohesion: 0.83
Nodes (3): collect_code_files(), is_test_path(), main()

### Community 18 - "Community 18"
Cohesion: 1.0
Nodes (0): 

### Community 19 - "Community 19"
Cohesion: 1.0
Nodes (0): 

### Community 20 - "Community 20"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **Thin community `Community 18`** (1 nodes): `next-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 19`** (1 nodes): `next.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 20`** (1 nodes): `jscad.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `TrayWorkerService` connect `Community 13` to `Community 1`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Why does `generateRequestId()` connect `Community 13` to `Community 1`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._
- **Should `Community 4` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._