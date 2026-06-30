import { describe, expect, it } from "vitest";
import steppedMergedSplitFragmentFixture from "@/lib/fixtures/tray-stepped-merged-split-fragments.json";
import steppedSplitFragmentFixture from "@/lib/fixtures/tray-stepped-split-fragments.json";
import type { SteppedLayoutParams } from "@/types/custom-tray";
import { createSteppedSplitParts } from "@/lib/stepped-tray-model";

function sub(a: number[], b: number[]) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross(a: number[], b: number[]) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function polygonArea3d(vertices: number[][]) {
  if (vertices.length < 3) return 0;
  const origin = vertices[0];
  let area = 0;
  for (let index = 1; index < vertices.length - 1; index += 1) {
    const normal = cross(sub(vertices[index], origin), sub(vertices[index + 1], origin));
    area += Math.hypot(normal[0], normal[1], normal[2]) / 2;
  }
  return area;
}

function classify(vertices: number[][]) {
  const zValues = vertices.map((vertex) => vertex[2] ?? 0);
  const zMin = Math.min(...zValues);
  const zMax = Math.max(...zValues);
  if (Math.abs(zMax - zMin) < 0.001) return `horizontal@${zMin.toFixed(2)}`;
  const xValues = vertices.map((vertex) => vertex[0] ?? 0);
  const yValues = vertices.map((vertex) => vertex[1] ?? 0);
  const xSpan = Math.max(...xValues) - Math.min(...xValues);
  const ySpan = Math.max(...yValues) - Math.min(...yValues);
  return xSpan < 0.001 || ySpan < 0.001 ? "axis-vertical" : "slanted/curved-side";
}

function summarize(
  label: string,
  params: SteppedLayoutParams,
  options?: Parameters<typeof createSteppedSplitParts>[1],
) {
  const parts = createSteppedSplitParts(params, options);
  const metrics: {
    part: string;
    polygons: number;
    smallFacesUnder1mm2: number;
    tinyFacesUnder005mm2: number;
    byKind: Record<string, number>;
  }[] = [];
  console.log(`\n[split-diagnostics] ${label}`);
  for (const part of parts) {
    const polygons = (part.geometry as unknown as { polygons: { vertices: number[][] }[] }).polygons;
    const small = polygons
      .map((polygon) => ({
        area: polygonArea3d(polygon.vertices),
        kind: classify(polygon.vertices),
      }))
      .filter((item) => item.area > 0 && item.area < 1);
    const byKind = small.reduce<Record<string, number>>((acc, item) => {
      acc[item.kind] = (acc[item.kind] ?? 0) + 1;
      return acc;
    }, {});
    const tiny = small.filter((item) => item.area < 0.05).length;
    const partMetrics = {
      part: part.label,
      polygons: polygons.length,
      smallFacesUnder1mm2: small.length,
      tinyFacesUnder005mm2: tiny,
      byKind,
    };
    metrics.push(partMetrics);
    console.log(partMetrics);
  }
  return metrics;
}

describe("stepped split mesh diagnostics", { timeout: 15000 }, () => {
  it("prints small-face distribution for split fixtures", () => {
    const splitMetrics = summarize(
      "split-fragments",
      (steppedSplitFragmentFixture as unknown as { params: SteppedLayoutParams }).params,
    );
    const mergedMetrics = summarize(
      "merged-split-fragments",
      (steppedMergedSplitFragmentFixture as unknown as { params: SteppedLayoutParams }).params,
    );
    const mergedNoGrooveMetrics = summarize(
      "merged-split-fragments-no-groove",
      (steppedMergedSplitFragmentFixture as unknown as { params: SteppedLayoutParams }).params,
      { interfaceGrooveDepth: 0 },
    );

    const splitSmallFaces = splitMetrics.map((item) => item.smallFacesUnder1mm2);
    expect(splitSmallFaces[0]).toBeLessThanOrEqual(135);
    expect(splitSmallFaces[1]).toBeLessThanOrEqual(114);
    expect(splitSmallFaces[2]).toBeLessThanOrEqual(42);

    const mergedSmallFaces = mergedMetrics.map((item) => item.smallFacesUnder1mm2);
    expect(mergedSmallFaces[0]).toBeLessThanOrEqual(557);
    expect(mergedSmallFaces[1]).toBeLessThanOrEqual(979);
    expect(mergedSmallFaces[2]).toBeLessThanOrEqual(42);

    const mergedNoGrooveSmallFaces = mergedNoGrooveMetrics.map(
      (item) => item.smallFacesUnder1mm2,
    );
    expect(mergedNoGrooveSmallFaces[0]).toBeLessThanOrEqual(57);
    expect(mergedNoGrooveSmallFaces[1]).toBeLessThanOrEqual(441);
    expect(mergedNoGrooveSmallFaces[2]).toBeLessThanOrEqual(42);
    expect(mergedMetrics[1].tinyFacesUnder005mm2).toBeLessThanOrEqual(268);
  });
});
