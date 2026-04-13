import { describe, expect, it } from "vitest";
import type { SteppedLayoutParams } from "@/types/custom-tray";
import { STEPPED_LAYOUT_DEFAULTS } from "@/lib/stepped-config";
import { buildSteppedOutlinePreview } from "@/lib/stepped-outline-preview";

function polygonArea(points: { x: number; y: number }[]) {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const next = points[(i + 1) % points.length];
    area += points[i].x * next.y - next.x * points[i].y;
  }
  return Math.abs(area) / 2;
}

function createParams(): SteppedLayoutParams {
  return {
    ...STEPPED_LAYOUT_DEFAULTS,
    smoothingRadius: 12,
    disconnectDistance: 0,
    groups: [
      {
        ...STEPPED_LAYOUT_DEFAULTS.groups[0],
        id: "high",
        name: "高组",
        color: "#3b82f6",
        bottomHeight: 20,
      },
      {
        ...STEPPED_LAYOUT_DEFAULTS.groups[0],
        id: "low",
        name: "低组",
        color: "#ef4444",
        bottomHeight: 10,
      },
    ],
    activeGroupId: "low",
    slots: [
      {
        id: "low-slot",
        groupId: "low",
        x: 0,
        y: 0,
        width: 25,
        height: 25,
        rotation: 0,
        shape: "circle",
      },
      {
        id: "high-slot",
        groupId: "high",
        x: 20,
        y: 0,
        width: 25,
        height: 25,
        rotation: 0,
        shape: "circle",
      },
    ],
  };
}

describe("stepped outline preview", () => {
  it("returns null when slots or groups are missing", () => {
    expect(
      buildSteppedOutlinePreview({
        ...STEPPED_LAYOUT_DEFAULTS,
        slots: [],
      }),
    ).toBeNull();

    expect(
      buildSteppedOutlinePreview({
        ...STEPPED_LAYOUT_DEFAULTS,
        slots: [
          {
            id: "slot-1",
            groupId: "missing",
            x: 0,
            y: 0,
            width: 25,
            height: 25,
            rotation: 0,
            shape: "circle",
          },
        ],
        groups: [],
      }),
    ).toBeNull();
  });

  it("sorts previews by bottom height and includes higher slots in lower group envelopes", () => {
    const outlinePreview = buildSteppedOutlinePreview(createParams());

    expect(outlinePreview).not.toBeNull();
    expect(outlinePreview).toHaveLength(2);
    expect(outlinePreview!.map((preview) => preview.groupId)).toEqual([
      "low",
      "high",
    ]);

    const lowGroup = outlinePreview![0];
    const highGroup = outlinePreview![1];

    expect(lowGroup.color).toBe("#ef4444");
    expect(highGroup.color).toBe("#3b82f6");
    expect(lowGroup.points.length).toBeGreaterThanOrEqual(3);
    expect(highGroup.points.length).toBeGreaterThanOrEqual(3);
    expect(polygonArea(lowGroup.points)).toBeGreaterThan(
      polygonArea(highGroup.points),
    );
  });
});
