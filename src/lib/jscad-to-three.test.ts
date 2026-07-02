import { describe, expect, it } from "vitest";
import { primitives } from "@jscad/modeling";
import * as THREE from "three";
import steppedSplitFragmentFixture from "@/lib/fixtures/tray-stepped-split-fragments.json";
import { jscadToThreeGeometry } from "@/lib/jscad-to-three";
import { createSteppedCadSplitParts } from "@/lib/stepped-cad-tray-model";
import type { SteppedLayoutParams } from "@/types/custom-tray";

const { cuboid } = primitives;

describe("jscad to three geometry", () => {
  it("converts a cuboid into non-indexed buffer geometry with positions and normals", () => {
    const geometry = jscadToThreeGeometry(cuboid({ size: [2, 4, 6] }));

    const positions = geometry.getAttribute("position");
    const normals = geometry.getAttribute("normal");

    expect(geometry).toBeInstanceOf(THREE.BufferGeometry);
    expect(geometry.index).toBeNull();
    expect(positions).toBeInstanceOf(THREE.BufferAttribute);
    expect(normals).toBeInstanceOf(THREE.BufferAttribute);
    expect(positions.count).toBe(36);
    expect(normals.count).toBe(36);

    geometry.computeBoundingBox();
    expect(geometry.boundingBox?.min.toArray()).toEqual([-1, -2, -3]);
    expect(geometry.boundingBox?.max.toArray()).toEqual([1, 2, 3]);
  });

  it("emits normalized face normals for every generated vertex", () => {
    const geometry = jscadToThreeGeometry(cuboid({ size: [2, 4, 6] }));
    const normals = geometry.getAttribute("normal");

    for (let index = 0; index < normals.count; index++) {
      const normal = new THREE.Vector3(
        normals.getX(index),
        normals.getY(index),
        normals.getZ(index),
      );

      expect(normal.length()).toBeCloseTo(1, 5);
    }
  });

  it("converts cad split parts from stepped fixture without null polygon vertices", { timeout: 30000 }, () => {
    const parts = createSteppedCadSplitParts(
      steppedSplitFragmentFixture.params as SteppedLayoutParams,
    );

    expect(parts.length).toBeGreaterThan(0);
    for (const part of parts) {
      expect(() => jscadToThreeGeometry(part.geometry)).not.toThrow();
    }
  });
});
