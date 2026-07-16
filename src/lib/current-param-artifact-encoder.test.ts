import { describe, expect, it } from "vitest";
import { STEPPED_LAYOUT_DEFAULTS } from "@/lib/stepped-config";
import {
  buildCurrentParamArtifact,
  createCurrentParamArtifactBlob,
  serializeCurrentParamArtifact,
} from "@/lib/current-param-artifact-encoder";
import { captureModeParamSnapshot } from "@/lib/mode-param-snapshot";

describe("Current Param Artifact Encoder", () => {
  it("保留 Mode Param Snapshot 的实际 CAD Mode", () => {
    const snapshot = captureModeParamSnapshot(
      "stepped-cad",
      STEPPED_LAYOUT_DEFAULTS,
    );

    expect(buildCurrentParamArtifact(snapshot)).toEqual({
      version: 1,
      mode: "stepped-cad",
      params: STEPPED_LAYOUT_DEFAULTS,
    });
  });

  it("捕获后不受编辑器参数继续变化影响", () => {
    const params = structuredClone(STEPPED_LAYOUT_DEFAULTS);
    const snapshot = captureModeParamSnapshot("stepped-cad", params);

    params.trayWidth += 10;
    params.groups.push({ ...params.groups[0], id: "later-group" });

    expect(snapshot.params.trayWidth).toBe(STEPPED_LAYOUT_DEFAULTS.trayWidth);
    expect(snapshot.params.groups).toHaveLength(
      STEPPED_LAYOUT_DEFAULTS.groups.length,
    );
  });

  it("序列化当前格式并保留三位小数精度", async () => {
    const params = structuredClone(STEPPED_LAYOUT_DEFAULTS);
    params.trayWidth = 12.34567;
    const snapshot = captureModeParamSnapshot("stepped-cad", params);

    const serialized = serializeCurrentParamArtifact(snapshot);
    expect(JSON.parse(serialized)).toMatchObject({
      version: 1,
      mode: "stepped-cad",
      params: { trayWidth: 12.346 },
    });

    const blob = createCurrentParamArtifactBlob(snapshot);
    expect(blob.type).toBe("application/json");
    expect(await blob.text()).toBe(serialized);
  });

  it("不把旧磁吸孔布尔字段写入当前产物", () => {
    const params = {
      ...STEPPED_LAYOUT_DEFAULTS,
      enableBaseHole: true,
    };
    const artifact = buildCurrentParamArtifact(
      captureModeParamSnapshot("stepped", params),
    );

    expect(artifact.params).not.toHaveProperty("enableBaseHole");
    expect(artifact.params.baseHoleStructure).toBe("none");
  });
});
