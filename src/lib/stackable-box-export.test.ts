import { describe, expect, it } from "vitest";
import stlSerializer from "@jscad/stl-serializer";
import { measurements } from "@jscad/modeling";
import { DEFAULT_TRAY_PARAMS } from "@/lib/grid-config";
import { createDefaultStackableBoxParams } from "@/lib/stackable-box";
import { createStackableBoxBody } from "@/lib/stackable-box-model";
import { createTrayModel } from "@/lib/tray-model";

const { measureBoundingBox } = measurements;

async function measureBinaryStlZBounds(model: Parameters<typeof stlSerializer.serialize>[1]) {
  const rawData = stlSerializer.serialize({ binary: true }, model) as BlobPart[];
  const bytes = new Uint8Array(await new Blob(rawData).arrayBuffer());
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const triangleCount = view.getUint32(80, true);
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  let degenerateTriangleCount = 0;
  const degenerateTriangles: Array<{ triangle: number; vertices: readonly (readonly [number, number, number])[] }> = [];

  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const triangleOffset = 84 + triangle * 50;
    const vertices = [12, 24, 36].map((vertexOffset) => [
      view.getFloat32(triangleOffset + vertexOffset, true),
      view.getFloat32(triangleOffset + vertexOffset + 4, true),
      view.getFloat32(triangleOffset + vertexOffset + 8, true),
    ] as const);
    const [a, b, c] = vertices;
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const cross = [
      ab[1] * ac[2] - ab[2] * ac[1],
      ab[2] * ac[0] - ab[0] * ac[2],
      ab[0] * ac[1] - ab[1] * ac[0],
    ];
    if (cross[0] ** 2 + cross[1] ** 2 + cross[2] ** 2 < 1e-16) {
      degenerateTriangleCount += 1;
      degenerateTriangles.push({ triangle, vertices });
    }
    for (const [, , z] of vertices) {
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
    }
  }

  return { minZ, maxZ, triangleCount, degenerateTriangleCount, degenerateTriangles };
}

describe("stackable box body export bounds", () => {
  it("does not add an invisible height above the requested outer height", async () => {
    const outerHeight = 50;
    const body = createStackableBoxBody({
      outerWidth: 100,
      outerDepth: 80,
      outerHeight,
      trayTopZ: 6,
      xyFitClearance: 0.4,
    });

    const [[, , modelMinZ], [, , modelMaxZ]] = measureBoundingBox(body);
    const stlBounds = await measureBinaryStlZBounds(body);

    expect(modelMinZ).toBeCloseTo(0, 4);
    expect(modelMaxZ).toBeCloseTo(outerHeight, 4);
    expect(stlBounds.minZ).toBeCloseTo(0, 3);
    expect(stlBounds.maxZ).toBeCloseTo(outerHeight, 3);
    expect(stlBounds.triangleCount).toBeGreaterThan(0);
    expect(stlBounds.degenerateTriangles).toEqual([]);
  });

  it("keeps the complete grid box body STL within the configured height", async () => {
    const params = {
      ...DEFAULT_TRAY_PARAMS,
      rows: 2,
      columns: 2,
      stackableBox: {
        ...createDefaultStackableBoxParams(),
        enabled: true,
        outerWidth: 100,
        outerDepth: 80,
        outerHeight: 50,
      },
    };
    const body = createTrayModel(params);
    const [[, , modelMinZ], [, , modelMaxZ]] = measureBoundingBox(body);
    const stlBounds = await measureBinaryStlZBounds(body);

    expect(modelMinZ).toBeCloseTo(0, 4);
    expect(modelMaxZ).toBeCloseTo(params.stackableBox.outerHeight, 4);
    expect(stlBounds.minZ).toBeCloseTo(0, 3);
    expect(stlBounds.maxZ).toBeCloseTo(params.stackableBox.outerHeight, 3);
    expect(stlBounds.degenerateTriangles).toEqual([]);
  });
});
