import { describe, expect, it } from "vitest";
import { measurements } from "@jscad/modeling";
import mixedRowsArtifact from "@/lib/fixtures/historical-simple-stepped-mixed-rows.json";
import baseHolesArtifact from "@/lib/fixtures/historical-simple-stepped-base-holes.json";
import { prepareParamFileObject } from "@/lib/historical-param-artifact-reader";
import { createSteppedCadTrayModel } from "@/lib/stepped-cad-construction";
import { buildSteppedCadFeatureGraph } from "@/lib/stepped-cad-feature-graph";
import type { SteppedLayoutParams } from "@/types/custom-tray";

const { measureBoundingBox, measureVolume } = measurements;

const historicalArtifacts = [
  ["不等宽行与空行", mixedRowsArtifact, [150, 127.6, 16], 187161.1476323115],
  ["底板磁吸孔", baseHolesArtifact, [180, 110, 15], 191461.78925491695],
] as const;

describe("历史 simple-stepped 模型等价性", () => {
  it.each(historicalArtifacts)("%s：转换后关键几何满足旧后端黄金值", (_, artifact, expectedDimensions, expectedVolume) => {
    const preparation = prepareParamFileObject(structuredClone(artifact), {
      selectedMode: "stepped",
    });
    expect(preparation.status).toBe("ready");
    if (preparation.status !== "ready") {
      throw new Error("历史简易阶梯样本未能转换为 stepped");
    }
    const steppedParams = preparation.candidate.snapshot.params as SteppedLayoutParams;
    const newGeometry = createSteppedCadTrayModel(steppedParams);
    const [newMin, newMax] = measureBoundingBox(newGeometry);
    const newDimensions = newMax.map((value, index) => value - newMin[index]);

    expectedDimensions.forEach((dimension, index) => {
      expect(Math.abs(newDimensions[index] - dimension)).toBeLessThanOrEqual(0.1);
    });

    const newVolume = measureVolume(newGeometry);
    expect(newVolume).toBeGreaterThan(0);
    expect(Math.abs(newVolume - expectedVolume) / expectedVolume).toBeLessThanOrEqual(0.01);

    const graph = buildSteppedCadFeatureGraph(steppedParams);
    expect(graph.groups.map((group) => group.columnHeight)).toEqual(
      artifact.params.rows
        .filter((row) => row.slotIds.length > 0)
        .map((_, index) => artifact.params.firstRowHeight + index * artifact.params.stepHeight),
    );
    expect(graph.layers.length).toBeGreaterThan(0);
  });
});
