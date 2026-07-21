import { describe, expect, it } from "vitest";
import { measurements } from "@jscad/modeling";
import mixedRowsArtifact from "@/lib/fixtures/historical-simple-stepped-mixed-rows.json";
import baseHolesArtifact from "@/lib/fixtures/historical-simple-stepped-base-holes.json";
import { prepareParamFileObject } from "@/lib/historical-param-artifact-reader";
import { normalizeParamsForMode } from "@/lib/param-normalization";
import { createSimpleSteppedTrayModel } from "@/lib/simple-stepped-tray-model";
import { createSteppedCadTrayModel } from "@/lib/stepped-cad-tray-model";
import { buildSteppedCadFeatureGraph } from "@/lib/stepped-cad-feature-graph";
import type {
  SimpleSteppedLayoutParams,
  SteppedLayoutParams,
} from "@/types/custom-tray";

const { measureBoundingBox, measureVolume } = measurements;

const historicalArtifacts = [
  ["不等宽行与空行", mixedRowsArtifact],
  ["底板磁吸孔", baseHolesArtifact],
] as const;

describe("历史 simple-stepped 模型等价性", () => {
  it.each(historicalArtifacts)("%s：转换前后关键几何满足 ADR-0002 门槛", (_, artifact) => {
    const oldParams = normalizeParamsForMode(
      "simple-stepped",
      structuredClone(artifact.params) as unknown as SimpleSteppedLayoutParams,
    ) as SimpleSteppedLayoutParams;
    const preparation = prepareParamFileObject(structuredClone(artifact), {
      selectedMode: "stepped",
    });
    expect(preparation.status).toBe("ready");
    if (preparation.status !== "ready") {
      throw new Error("历史简易阶梯样本未能转换为 stepped");
    }
    const steppedParams = preparation.candidate.params as SteppedLayoutParams;
    const oldGeometry = createSimpleSteppedTrayModel(oldParams);
    const newGeometry = createSteppedCadTrayModel(steppedParams);
    const [oldMin, oldMax] = measureBoundingBox(oldGeometry);
    const [newMin, newMax] = measureBoundingBox(newGeometry);
    const oldDimensions = oldMax.map((value, index) => value - oldMin[index]);
    const newDimensions = newMax.map((value, index) => value - newMin[index]);

    oldDimensions.forEach((dimension, index) => {
      expect(Math.abs(newDimensions[index] - dimension)).toBeLessThanOrEqual(0.1);
    });

    const oldVolume = measureVolume(oldGeometry);
    const newVolume = measureVolume(newGeometry);
    expect(oldVolume).toBeGreaterThan(0);
    expect(newVolume).toBeGreaterThan(0);
    expect(Math.abs(newVolume - oldVolume) / oldVolume).toBeLessThanOrEqual(0.01);

    const graph = buildSteppedCadFeatureGraph(steppedParams);
    expect(graph.groups.map((group) => group.columnHeight)).toEqual(
      oldParams.rows
        .filter((row) => row.slotIds.length > 0)
        .map((_, index) => oldParams.firstRowHeight + index * oldParams.stepHeight),
    );
    expect(graph.layers.length).toBeGreaterThan(0);
  });
});
