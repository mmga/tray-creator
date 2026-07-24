import { describe, expect, it } from "vitest";
import { CUSTOM_LAYOUT_DEFAULTS } from "@/lib/custom-config";
import { constructCustomContouredFootprint } from "@/lib/custom-contoured-footprint";
import {
  calculateCustomContouredFootprint,
  calculateCustomEffectiveDimensions,
  calculateCustomTrayFootprint,
  calculateFixedCustomTrayUsableArea,
  isCustomSlotWithinFixedTrayUsableArea,
  resolveCustomBoundarySpacing,
  resolveCustomFootprintStyle,
  resolveCustomTraySizingMode,
} from "@/lib/custom-layout-math";

describe("custom layout math", () => {
  it("resolves boundary spacing from either the shared spacing or the override", () => {
    expect(
      resolveCustomBoundarySpacing({
        ...CUSTOM_LAYOUT_DEFAULTS,
        spacing: 6,
        boundarySpacing: 12,
        boundarySpacingIndependent: false,
      }),
    ).toBe(6);

    expect(
      resolveCustomBoundarySpacing({
        ...CUSTOM_LAYOUT_DEFAULTS,
        spacing: 6,
        boundarySpacing: 12,
        boundarySpacingIndependent: true,
      }),
    ).toBe(12);
  });

  it("returns zero extents for empty layouts", () => {
    expect(
      calculateCustomEffectiveDimensions(CUSTOM_LAYOUT_DEFAULTS),
    ).toEqual({
      width: 0,
      depth: 0,
      minX: 0,
      maxX: 0,
      minY: 0,
      maxY: 0,
    });
  });

  it("calculates effective dimensions from slot bounds and boundary spacing", () => {
    const params = {
      ...CUSTOM_LAYOUT_DEFAULTS,
      spacing: 5,
      boundarySpacing: 7,
      boundarySpacingIndependent: true,
      slots: [
        {
          id: "slot-1",
          x: 30,
          y: 40,
          shape: "circle" as const,
          width: 20,
          height: 20,
          rotation: 0,
        },
        {
          id: "slot-2",
          x: 80,
          y: 100,
          shape: "circle" as const,
          width: 20,
          height: 20,
          rotation: 0,
        },
      ],
    };

    expect(calculateCustomEffectiveDimensions(params)).toEqual({
      width: 84.4,
      depth: 94.4,
      minX: 19.8,
      maxX: 90.2,
      minY: 29.8,
      maxY: 110.2,
    });
  });

  it("reports the upper edge footprint without adding side bevel width", () => {
    const params = {
      ...CUSTOM_LAYOUT_DEFAULTS,
      boundarySpacing: 3,
      boundarySpacingIndependent: true,
      sideBevelWidth: 2,
      slots: [
        {
          id: "slot-1",
          x: 109.6,
          y: 112.8,
          shape: "circle" as const,
          width: 11,
          height: 11,
          slotWidth: 11.4,
          slotHeight: 11.4,
          rotation: 0,
        },
        {
          id: "slot-2",
          x: 89,
          y: 112.6,
          shape: "circle" as const,
          width: 11,
          height: 11,
          slotWidth: 11.4,
          slotHeight: 11.4,
          rotation: 0,
        },
        {
          id: "slot-3",
          x: 98.2,
          y: 103.1,
          shape: "circle" as const,
          width: 11,
          height: 11,
          slotWidth: 11.4,
          slotHeight: 11.4,
          rotation: 0,
        },
        {
          id: "slot-4",
          x: 81,
          y: 102.2,
          shape: "circle" as const,
          width: 11,
          height: 11,
          slotWidth: 11.4,
          slotHeight: 11.4,
          rotation: 0,
        },
      ],
    };

    expect(calculateCustomEffectiveDimensions(params)).toMatchObject({
      width: 46,
      depth: 28,
    });
  });

  it("treats missing sizing mode as automatic and preserves the derived footprint", () => {
    const params = {
      ...CUSTOM_LAYOUT_DEFAULTS,
      traySizingMode: undefined,
      sideBevelWidth: 2,
      slots: [
        {
          id: "slot-1",
          x: 40,
          y: 30,
          shape: "circle" as const,
          width: 20,
          height: 20,
          rotation: 0,
        },
      ],
    };

    expect(resolveCustomTraySizingMode(params)).toBe("auto");
    expect(calculateCustomTrayFootprint(params)).toMatchObject({
      sizingMode: "auto",
      width: 34.4,
      depth: 34.4,
    });
  });

  it("uses configured outer dimensions and an inset rounded usable area in fixed mode", () => {
    const params = {
      ...CUSTOM_LAYOUT_DEFAULTS,
      traySizingMode: "fixed" as const,
      trayWidth: 100,
      trayDepth: 80,
      boundarySpacingIndependent: true,
      boundarySpacing: 5,
      cornerRadius: 12,
      sideBevelWidth: 3,
    };

    expect(calculateCustomTrayFootprint(params)).toMatchObject({
      sizingMode: "fixed",
      width: 100,
      depth: 80,
    });
    expect(calculateFixedCustomTrayUsableArea(params)).toEqual({
      x: 8,
      y: 8,
      width: 84,
      depth: 64,
      cornerRadius: 4,
    });

    expect(
      isCustomSlotWithinFixedTrayUsableArea(
        {
          id: "safe-slot",
          x: 25,
          y: 25,
          shape: "circle",
          width: 20,
          height: 20,
          rotation: 0,
        },
        calculateFixedCustomTrayUsableArea(params),
      ),
    ).toBe(true);
    expect(
      isCustomSlotWithinFixedTrayUsableArea(
        {
          id: "corner-slot",
          x: 9,
          y: 9,
          shape: "circle",
          width: 1,
          height: 1,
          rotation: 0,
        },
        calculateFixedCustomTrayUsableArea(params),
      ),
    ).toBe(false);
  });

  it("缺失 footprintStyle 时默认 rectangular", () => {
    expect(resolveCustomFootprintStyle({})).toBe("rectangular");
    expect(resolveCustomFootprintStyle({ footprintStyle: "contoured" })).toBe("contoured");
  });

  it("contoured footprint 由槽位外接框派生尺寸并返回实体数", () => {
    const params = {
      ...CUSTOM_LAYOUT_DEFAULTS,
      footprintStyle: "contoured" as const,
      slots: [
        {
          id: "s1",
          x: 20,
          y: 20,
          shape: "circle" as const,
          width: 25,
          height: 25,
          rotation: 0,
          slotWidth: 25.4,
          slotHeight: 25.4,
        },
      ],
      spacing: 5,
      boundarySpacing: 5,
      boundarySpacingIndependent: true,
    };

    const footprint = calculateCustomTrayFootprint(
      params,
      constructCustomContouredFootprint(params),
    );
    expect(footprint.footprintStyle).toBe("contoured");
    expect(footprint.contourBodyCount).toBe(1);
    expect(footprint.width).toBeGreaterThan(25);
    expect(footprint.depth).toBeGreaterThan(25);

    const contoured = calculateCustomContouredFootprint(params);
    expect(contoured.bodyCount).toBe(1);
    expect(contoured.bodies.length).toBe(1);
  });

  it("contoured footprint 远距离多槽可产生多实体", () => {
    const params = {
      ...CUSTOM_LAYOUT_DEFAULTS,
      footprintStyle: "contoured" as const,
      slots: [
        {
          id: "a",
          x: 0,
          y: 0,
          shape: "circle" as const,
          width: 25,
          height: 25,
          rotation: 0,
          slotWidth: 25.4,
          slotHeight: 25.4,
        },
        {
          id: "b",
          x: 200,
          y: 200,
          shape: "circle" as const,
          width: 25,
          height: 25,
          rotation: 0,
          slotWidth: 25.4,
          slotHeight: 25.4,
        },
      ],
      spacing: 5,
      boundarySpacing: 5,
      boundarySpacingIndependent: true,
    };
    const footprint = calculateCustomTrayFootprint(
      params,
      constructCustomContouredFootprint(params),
    );
    expect(footprint.contourBodyCount).toBe(2);
  });

  it("contoured footprint 使用自定义平滑与断连参数", () => {
    const slots = [
      {
        id: "a",
        x: 0,
        y: 0,
        shape: "circle" as const,
        width: 25,
        height: 25,
        rotation: 0,
      },
      {
        id: "b",
        x: 80,
        y: 0,
        shape: "circle" as const,
        width: 25,
        height: 25,
        rotation: 0,
      },
    ];
    const separated = calculateCustomContouredFootprint({
      ...CUSTOM_LAYOUT_DEFAULTS,
      footprintStyle: "contoured",
      smoothingRadius: 1,
      disconnectDistance: 1,
      slots,
    });
    const bridged = calculateCustomContouredFootprint({
      ...CUSTOM_LAYOUT_DEFAULTS,
      footprintStyle: "contoured",
      smoothingRadius: 60,
      disconnectDistance: 0,
      slots,
    });

    expect(separated.bodyCount).toBe(2);
    expect(bridged.bodyCount).toBe(1);
  });
});
