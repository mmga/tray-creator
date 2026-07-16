"use client";

import { GROUP_COLORS } from "@/lib/stepped-config";
import { createGroupStructureOverrides } from "@/lib/stepped-group-params";
import type {
  SlotGroup,
  SteppedLayoutParams,
  SteppedSlot,
} from "@/types/custom-tray";

export const STEPPED_PERF_FIXTURE_SIZES = [20, 50, 100] as const;

export type SteppedPerfFixtureSize =
  (typeof STEPPED_PERF_FIXTURE_SIZES)[number];

interface SteppedPerfFixtureConfig {
  trayWidth: number;
  trayDepth: number;
  columns: number;
  xInset: number;
  yInset: number;
  widthCycle: number[];
  spacing: number;
  holeDepth: number;
  smoothingRadius: number;
  disconnectDistance: number;
  heights: number[];
}

const PERF_FIXTURE_CONFIG: Record<
  SteppedPerfFixtureSize,
  SteppedPerfFixtureConfig
> = {
  20: {
    trayWidth: 240,
    trayDepth: 196,
    columns: 5,
    xInset: 22,
    yInset: 28,
    widthCycle: [25, 28.5, 32, 25],
    spacing: 5,
    holeDepth: 3,
    smoothingRadius: 64,
    disconnectDistance: 0,
    heights: [8, 12, 16, 20],
  },
  50: {
    trayWidth: 248,
    trayDepth: 168,
    columns: 10,
    xInset: 18,
    yInset: 20,
    widthCycle: [25, 28.5, 25, 32],
    spacing: 4,
    holeDepth: 3,
    smoothingRadius: 56,
    disconnectDistance: 0,
    heights: [8, 12, 16, 20],
  },
  100: {
    trayWidth: 250,
    trayDepth: 250,
    columns: 10,
    xInset: 18,
    yInset: 18,
    widthCycle: [25, 25, 28.5, 25],
    spacing: 3,
    holeDepth: 3,
    smoothingRadius: 48,
    disconnectDistance: 0,
    heights: [8, 12, 16, 20],
  },
};

function roundToTenth(value: number) {
  return Math.round(value * 10) / 10;
}

function buildPerfGroups(
  heights: number[],
  defaults: Pick<SteppedLayoutParams, "smoothingRadius" | "disconnectDistance">,
): SlotGroup[] {
  return heights.map((bottomHeight, index) => ({
    id: `perf-group-${index + 1}`,
    name: `压力组 ${index + 1}`,
    color: GROUP_COLORS[index % GROUP_COLORS.length],
    bottomHeight,
    ...createGroupStructureOverrides(defaults),
  }));
}

export function buildSteppedPerfFixture(
  slotCount: SteppedPerfFixtureSize,
): SteppedLayoutParams {
  const config = PERF_FIXTURE_CONFIG[slotCount];
  const groups = buildPerfGroups(config.heights, {
    smoothingRadius: config.smoothingRadius,
    disconnectDistance: config.disconnectDistance,
  });
  const rows = Math.ceil(slotCount / config.columns);
  const xStep =
    config.columns > 1
      ? (config.trayWidth - config.xInset * 2) / (config.columns - 1)
      : 0;
  const yStep =
    rows > 1 ? (config.trayDepth - config.yInset * 2) / (rows - 1) : 0;
  const slots: SteppedSlot[] = [];

  for (let index = 0; index < slotCount; index += 1) {
    const row = Math.floor(index / config.columns);
    const column = index % config.columns;
    const width = config.widthCycle[(index + row) % config.widthCycle.length];
    const group = groups[(row + column) % groups.length];
    const xBase =
      config.columns === 1
        ? config.trayWidth / 2
        : config.xInset + column * xStep;
    const yBase =
      rows === 1 ? config.trayDepth / 2 : config.yInset + row * yStep;
    const waveX =
      config.columns > 1
        ? ((column / (config.columns - 1)) - 0.5) * xStep * 0.22
        : 0;
    const waveY = rows > 1 ? (((row + column) % 3) - 1) * yStep * 0.035 : 0;
    const rowOffset = row % 2 === 1 ? xStep * 0.12 : -xStep * 0.04;

    slots.push({
      id: `perf-slot-${slotCount}-${index + 1}`,
      x: roundToTenth(xBase + rowOffset + waveX),
      y: roundToTenth(yBase + waveY),
      shape: "circle",
      width,
      height: width,
      rotation: 0,
      groupId: group.id,
    });
  }

  return {
    trayWidth: config.trayWidth,
    trayDepth: config.trayDepth,
    slots,
    groups,
    activeGroupId: groups[0]?.id ?? "",
    spacing: config.spacing,
    holeDepth: config.holeDepth,
    splitGrooveDepth: 2,
    smoothingRadius: config.smoothingRadius,
    disconnectDistance: config.disconnectDistance,
    baseHoleStructure: "none",
    magnetPostHoleDiameter: 5,
    magnetPostHoleDepth: 2,
    baseHoleSize: "25",
  };
}
