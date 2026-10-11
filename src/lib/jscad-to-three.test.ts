import { describe, expect, it } from "vitest";
import { primitives, measurements } from "@jscad/modeling";
import * as THREE from "three";
import steppedSplitFragmentFixture from "@/lib/fixtures/tray-stepped-split-fragments.json";
import { jscadToThreeGeometry } from "@/lib/jscad-to-three";
import { createSteppedCadSplitParts } from "@/test/contoured-state";
import { CUSTOM_LAYOUT_DEFAULTS } from "@/lib/custom-config";
import { createCircleSlotSnapshot, getFreeSlotProfileGeometry } from "@/lib/slot-definitions";
import { createCustomTrayModel } from "@/lib/custom-tray-model";
import { constructCustomContouredFootprintOutcome, projectCustomContouredFootprintInput } from "@/lib/custom-contoured-footprint";
import type { SteppedLayoutParams } from "@/types/custom-tray";

const { cuboid } = primitives;

describe("jscad to three geometry", () => {
  it("相切底板的三维描边只沿真实边界，不显示顶面内部接缝", () => {
    const params = { ...CUSTOM_LAYOUT_DEFAULTS, footprintStyle: "polygonal" as const, polygonCornerStyle: "tangent" as const,
      slots: [[0, 50], [44, 25], [74, 25]].map(([x, diameter], i) => ({ id: String(i), x, y: 0, width: diameter, height: diameter, rotation: 0, shape: "circle" as const, ...createCircleSlotSnapshot(diameter) })) };
    const outcome = constructCustomContouredFootprintOutcome(projectCustomContouredFootprintInput(params));
    if (!outcome.ok) throw new Error(outcome.error.message);
    const footprint = outcome.value;
    const model = createCustomTrayModel(params, { status: "ready", value: footprint });
    const geometry = jscadToThreeGeometry(model);
    geometry.computeBoundingBox();
    const bounds = measurements.measureBoundingBox(model);
    geometry.boundingBox!.min.toArray().forEach((value, axis) => expect(Math.abs(value - bounds[0][axis])).toBeLessThan(0.001));
    geometry.boundingBox!.max.toArray().forEach((value, axis) => expect(Math.abs(value - bounds[1][axis])).toBeLessThan(0.001));
    const edges = new THREE.EdgesGeometry(geometry, 45);
    const positions = edges.getAttribute("position");
    const centerX = (footprint.bounds!.minX + footprint.bounds!.maxX) / 2;
    const centerY = (footprint.bounds!.minY + footprint.bounds!.maxY) / 2;
    const outline = footprint.bodies[0].outerOutline;
    const boundary = outline.map((a, i) => {
      const b = outline[(i + 1) % outline.length];
      return new THREE.Line3(new THREE.Vector3(a.x, a.y), new THREE.Vector3(b.x, b.y));
    });
    let topEdges = 0;
    for (let i = 0; i < positions.count; i += 2) {
      if (Math.abs(positions.getZ(i) - 6) > 1e-5 || Math.abs(positions.getZ(i + 1) - 6) > 1e-5) continue;
      topEdges++;
      const midpoint = new THREE.Vector3((positions.getX(i) + positions.getX(i + 1)) / 2 + centerX,
        (positions.getY(i) + positions.getY(i + 1)) / 2 + centerY, 0);
      const distances = boundary.map(line => line.closestPointToPoint(midpoint, true, new THREE.Vector3()).distanceTo(midpoint));
      for (const slot of params.slots) {
        const profile = getFreeSlotProfileGeometry(slot);
        distances.push(Math.abs(Math.hypot(midpoint.x - slot.x, midpoint.y - slot.y) - profile.width / 2 - profile.outerOffset));
      }
      // 圆槽为 64 段，弦中点与解析圆的偏差不超过 0.04mm。
      expect(Math.min(...distances)).toBeLessThan(0.04);
    }
    expect(topEdges).toBeGreaterThan(0);
    for (const value of geometry.getAttribute("normal").array) expect(Number.isFinite(value)).toBe(true);
    geometry.dispose();
    edges.dispose();
  });

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
      steppedSplitFragmentFixture.params as unknown as SteppedLayoutParams,
    );

    expect(parts.length).toBeGreaterThan(0);
    for (const part of parts) {
      expect(() => jscadToThreeGeometry(part.geometry)).not.toThrow();
    }
  });
});
