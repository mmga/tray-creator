import { describe, expect, it } from "vitest";
import type { SteppedLayoutParams } from "@/types/custom-tray";
import { STEPPED_LAYOUT_DEFAULTS } from "@/lib/stepped-config";
import { buildSteppedOutlinePreview } from "@/test/contoured-state";

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
        color: "#c8a84e",
        bottomHeight: 10,
      },
    ],
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

    expect(lowGroup.color).toBe("#c8a84e");
    expect(highGroup.color).toBe("#3b82f6");
    expect(lowGroup.points.length).toBeGreaterThanOrEqual(3);
    expect(highGroup.points.length).toBeGreaterThanOrEqual(3);
    expect(polygonArea(lowGroup.points)).toBeGreaterThan(
      polygonArea(highGroup.points),
    );
  });

  it("keeps a CAD ellipse outline preview elliptical and rotated", () => {
    const params = createParams();
    params.groups = [params.groups[0]];
    params.slots = [
      {
        id: "ellipse-slot",
        groupId: "high",
        x: 100,
        y: 100,
        width: 60,
        height: 35.5,
        rotation: 0,
        shape: "ellipse",
        outerOffset: 0.4,
        profileExponent: 2.05,
        slotDefinitionId: "ellipse-60x35.5",
      },
    ];

    const preview = buildSteppedOutlinePreview(params)![0];
    const width = Math.max(...preview.points.map((point) => point.x))
      - Math.min(...preview.points.map((point) => point.x));
    const depth = Math.max(...preview.points.map((point) => point.y))
      - Math.min(...preview.points.map((point) => point.y));

    expect(width).toBeCloseTo(70.8, 0);
    expect(depth).toBeCloseTo(46.3, 0);

    params.slots[0].rotation = 90;
    const rotatedPreview = buildSteppedOutlinePreview(params)![0];
    const rotatedWidth = Math.max(...rotatedPreview.points.map((point) => point.x))
      - Math.min(...rotatedPreview.points.map((point) => point.x));
    const rotatedDepth = Math.max(...rotatedPreview.points.map((point) => point.y))
      - Math.min(...rotatedPreview.points.map((point) => point.y));

    expect(rotatedWidth).toBeCloseTo(46.3, 0);
    expect(rotatedDepth).toBeCloseTo(70.8, 0);
  });

  it("Rectangular Stepped Footprint 为每个分组派生矩形高度带 outline", () => {
    const params: SteppedLayoutParams = {
      ...createParams(),
      footprintStyle: "rectangular",
      traySizingMode: "auto",
      cornerRadius: 6,
      boundarySpacing: 5,
      boundarySpacingIndependent: true,
    };
    const preview = buildSteppedOutlinePreview(params);
    expect(preview).not.toBeNull();
    expect(preview!.length).toBeGreaterThanOrEqual(2);

    // 最低 bottomHeight=10 的 outline 应是整体包络（覆盖两个槽位）
    const lowOutline = preview!.find((item) => item.bottomHeight === 10)!;
    const lowWidth = Math.max(...lowOutline.points.map((p) => p.x))
      - Math.min(...lowOutline.points.map((p) => p.x));
    expect(lowWidth).toBeGreaterThan(50);

    // 高层 outline 仅覆盖高层槽位
    const highOutline = preview!.find((item) => item.bottomHeight === 20)!;
    const highWidth = Math.max(...highOutline.points.map((p) => p.x))
      - Math.min(...highOutline.points.map((p) => p.x));
    expect(highWidth).toBeLessThan(lowWidth);
    expect(highWidth).toBeGreaterThan(25);
  });
});
