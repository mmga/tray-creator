import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STEPPED_LAYOUT_DEFAULTS } from "@/lib/stepped-config";
import { browserDownloadPort } from "@/lib/download-port";
import type {
  GroupOutlinePreview,
} from "@/types/custom-tray";

const {
  generateSteppedPreviewMock,
  exportSteppedModelFilesMock,
  useSteppedOutlinePreviewMock,
  buildSteppedBridgeWarningMock,
  toastMock,
  trayWorkerServiceMock,
  randomIdFactoryMock,
  pauseOutlinePreviewMock,
  resumeOutlinePreviewMock,
} = vi.hoisted(() => ({
  generateSteppedPreviewMock: vi.fn(),
  exportSteppedModelFilesMock: vi.fn(),
  useSteppedOutlinePreviewMock: vi.fn(),
  buildSteppedBridgeWarningMock: vi.fn(),
  toastMock: vi.fn(),
  trayWorkerServiceMock: {
    generateStepped: vi.fn(),
    exportSTL: vi.fn(),
    generateSteppedOutlinePreview: vi.fn(),
  },
  randomIdFactoryMock: {
    createId: vi.fn(),
  },
  pauseOutlinePreviewMock: vi.fn(),
  resumeOutlinePreviewMock: vi.fn(),
}));

vi.mock("@/lib/stepped-model-service", () => ({
  generateSteppedPreview: generateSteppedPreviewMock,
  exportSteppedModelFiles: exportSteppedModelFilesMock,
}));

vi.mock("@/hooks/useSteppedOutlinePreview", () => ({
  useSteppedOutlinePreview: useSteppedOutlinePreviewMock,
}));

vi.mock("@/lib/stepped-bridge-warning", () => ({
  buildSteppedBridgeWarning: buildSteppedBridgeWarningMock,
}));

vi.mock("@/hooks/useToast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/lib/worker/worker-service", () => ({
  trayWorkerService: trayWorkerServiceMock,
}));

vi.mock("@/lib/id-factory", () => ({
  randomIdFactory: randomIdFactoryMock,
}));

import { useSteppedLayout } from "@/hooks/useSteppedLayout";

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const outlinePreviewValue: GroupOutlinePreview[] = [
  {
    key: "group-1-preview",
    groupId: STEPPED_LAYOUT_DEFAULTS.groups[0].id,
    color: STEPPED_LAYOUT_DEFAULTS.groups[0].color,
    bottomHeight: STEPPED_LAYOUT_DEFAULTS.groups[0].bottomHeight,
    points: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ],
  },
];

describe("useSteppedLayout", () => {
  beforeEach(() => {
    generateSteppedPreviewMock.mockReset();
    exportSteppedModelFilesMock.mockReset();
    useSteppedOutlinePreviewMock.mockReset();
    buildSteppedBridgeWarningMock.mockReset();
    toastMock.mockReset();
    trayWorkerServiceMock.generateStepped.mockReset();
    trayWorkerServiceMock.exportSTL.mockReset();
    trayWorkerServiceMock.generateSteppedOutlinePreview.mockReset();
    randomIdFactoryMock.createId.mockReset();
    pauseOutlinePreviewMock.mockReset();
    resumeOutlinePreviewMock.mockReset();

    useSteppedOutlinePreviewMock.mockReturnValue({
      outlinePreview: outlinePreviewValue,
      pauseOutlinePreview: pauseOutlinePreviewMock,
      resumeOutlinePreview: resumeOutlinePreviewMock,
    });
    buildSteppedBridgeWarningMock.mockImplementation((params) =>
      params.slots.length > 0
        ? {
            groupId: params.activeGroupId,
            groupName: "预警组",
            separatedClusterCount: 2,
            mergedClusterCount: 1,
            effectiveBridgeGap: 6,
          }
        : null,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("wires outline preview state and manages groups", () => {
    randomIdFactoryMock.createId.mockReturnValue("group-2");
    const { result } = renderHook(() => useSteppedLayout());

    expect(result.current.outlinePreview).toEqual(outlinePreviewValue);
    expect(useSteppedOutlinePreviewMock).toHaveBeenCalledWith(
      STEPPED_LAYOUT_DEFAULTS,
      trayWorkerServiceMock,
    );
    expect(result.current.bridgeWarning).toBeNull();

    act(() => {
      result.current.addGroup();
    });
    expect(result.current.params.groups.at(-1)).toMatchObject({
      id: "group-2",
      name: "组 2",
    });
    expect(result.current.params.activeGroupId).toBe("group-2");

    act(() => {
      result.current.updateGroupHeight("group-2", 24);
      result.current.updateGroupSmoothingOverride("group-2", true);
      result.current.updateGroupSmoothingRadius("group-2", 90);
      result.current.updateGroupDisconnectOverride("group-2", true);
      result.current.updateGroupDisconnectDistance("group-2", 8);
      result.current.setActiveGroup(STEPPED_LAYOUT_DEFAULTS.groups[0].id);
    });

    expect(result.current.params.groups.at(-1)).toMatchObject({
      bottomHeight: 24,
      useGroupSmoothingRadius: true,
      groupSmoothingRadius: 90,
      useGroupDisconnectDistance: true,
      groupDisconnectDistance: 8,
    });
    expect(result.current.params.activeGroupId).toBe(
      STEPPED_LAYOUT_DEFAULTS.groups[0].id,
    );

    act(() => {
      result.current.pauseOutlinePreview();
      result.current.resumeOutlinePreview();
    });
    expect(pauseOutlinePreviewMock).toHaveBeenCalledTimes(1);
    expect(resumeOutlinePreviewMock).toHaveBeenCalledTimes(1);
  });

  it("adds, inserts, duplicates, moves, trims, and removes stepped slots", () => {
    randomIdFactoryMock.createId
      .mockReturnValueOnce("group-2")
      .mockReturnValueOnce("slot-1")
      .mockReturnValueOnce("slot-2")
      .mockReturnValueOnce("copy-1");

    const { result } = renderHook(() => useSteppedLayout());

    act(() => {
      result.current.addGroup();
      result.current.addSlot(25);
    });
    expect(result.current.params.slots[0]).toMatchObject({
      id: "slot-1",
      groupId: "group-2",
    });
    expect(result.current.bridgeWarning).not.toBeNull();

    act(() => {
      result.current.insertSlots([
        {
          x: 60,
          y: 70,
          shape: "circle",
          width: 32,
          height: 32,
          rotation: 0,
        },
      ]);
    });
    expect(result.current.params.slots[1]).toMatchObject({
      id: "slot-2",
      groupId: "group-2",
    });

    let duplicatedIds: string[] = [];
    act(() => {
      duplicatedIds = result.current.duplicateSlots(["slot-1"]);
    });
    expect(duplicatedIds).toEqual(["copy-1"]);
    expect(result.current.params.slots.at(-1)).toMatchObject({
      id: "copy-1",
      x: 140,
      y: 120,
    });

    act(() => {
      result.current.moveSelectedSlotsToGroup(
        ["slot-1", "slot-2"],
        STEPPED_LAYOUT_DEFAULTS.groups[0].id,
      );
    });
    expect(result.current.params.slots.slice(0, 2).map((slot) => slot.groupId)).toEqual([
      STEPPED_LAYOUT_DEFAULTS.groups[0].id,
      STEPPED_LAYOUT_DEFAULTS.groups[0].id,
    ]);

    act(() => {
      result.current.trimBaseplate();
    });
    expect(result.current.params.trayWidth).toBeGreaterThan(0);
    expect(result.current.params.trayDepth).toBeGreaterThan(0);

    act(() => {
      result.current.removeSlot("slot-2");
      result.current.removeGroup("group-2");
    });
    expect(result.current.params.slots.map((slot) => slot.id)).not.toContain(
      "slot-2",
    );
    expect(result.current.params.groups.map((group) => group.id)).not.toContain(
      "group-2",
    );
  });

  it("supports snapshots, undo, batch updates, and group reordering", () => {
    vi.useFakeTimers();
    randomIdFactoryMock.createId
      .mockReturnValueOnce("group-2")
      .mockReturnValueOnce("slot-1");

    const { result } = renderHook(() => useSteppedLayout());

    act(() => {
      result.current.addGroup();
      result.current.addSlot(25);
    });

    act(() => {
      vi.advanceTimersByTime(600);
      result.current.saveSnapshot();
      result.current.updateSlotPosition("slot-1", 50, 60);
    });
    expect(result.current.params.slots[0]).toMatchObject({ x: 50, y: 60 });

    act(() => {
      result.current.undo();
    });
    expect(result.current.params.slots[0]).toMatchObject({ x: 130, y: 130 });

    act(() => {
      result.current.updateMultipleSlots([
        { id: "slot-1", x: 80, y: 90, rotation: 45 },
      ]);
    });
    expect(result.current.params.slots[0]).toMatchObject({
      x: 80,
      y: 90,
      rotation: 45,
    });

    act(() => {
      result.current.undo();
    });
    expect(result.current.params.slots[0]).toMatchObject({
      x: 130,
      y: 130,
      rotation: 0,
    });

    act(() => {
      result.current.updateMultipleSlotsLive([
        { id: "slot-1", x: 95, y: 105, rotation: 30 },
      ]);
      result.current.reorderGroups(1, 0);
    });
    expect(result.current.params.slots[0]).toMatchObject({
      x: 95,
      y: 105,
      rotation: 30,
    });
    expect(result.current.params.groups.map((group) => group.id)).toEqual([
      "group-2",
      STEPPED_LAYOUT_DEFAULTS.groups[0].id,
    ]);
  });

  it("generates optimization proposals, applies them, and clears stale results", async () => {
    randomIdFactoryMock.createId
      .mockReturnValueOnce("group-2")
      .mockReturnValueOnce("slot-1")
      .mockReturnValueOnce("slot-2");

    const { result } = renderHook(() => useSteppedLayout());

    act(() => {
      result.current.addGroup();
      result.current.addSlot(40);
      result.current.setActiveGroup(STEPPED_LAYOUT_DEFAULTS.groups[0].id);
      result.current.addSlot(25);
    });

    const beforeApply = result.current.params;

    act(() => {
      result.current.generateOptimizationProposals();
    });
    expect(result.current.isOptimizingLayout).toBe(true);
    await waitFor(() => {
      expect(result.current.isOptimizingLayout).toBe(false);
      expect(result.current.optimizationProposals).toHaveLength(3);
    });

    const proposalToApply = result.current.optimizationProposals[0];
    act(() => {
      result.current.applyOptimizationProposal(proposalToApply.id);
    });
    expect(result.current.optimizationProposals).toEqual([]);
    expect(result.current.params).toEqual(proposalToApply.params);
    expect(result.current.isPreviewStale).toBe(true);

    act(() => {
      result.current.undo();
    });
    expect(result.current.params).toEqual(beforeApply);

    act(() => {
      result.current.generateOptimizationProposals();
    });
    expect(result.current.isOptimizingLayout).toBe(true);
    await waitFor(() => {
      expect(result.current.optimizationProposals).toHaveLength(3);
    });

    act(() => {
      result.current.updateParam("spacing", 7);
    });
    expect(result.current.optimizationProposals).toEqual([]);

    act(() => {
      result.current.generateOptimizationProposals();
      result.current.reorderGroups(1, 0);
    });
    await waitFor(() => {
      expect(result.current.isOptimizingLayout).toBe(false);
      expect(result.current.optimizationProposals).toEqual([]);
    });
  });

  it("ignores stale generation results and exports the latest generated model", async () => {
    randomIdFactoryMock.createId.mockReturnValue("slot-1");
    const staleGeometry = { id: "stale-geom" } as never;
    const freshGeometry = { id: "fresh-geom" } as never;
    const staleThreeGeometry = { dispose: vi.fn() };
    const freshThreeGeometry = { dispose: vi.fn() };
    const staleDeferred = createDeferred<{
      geometry: never;
      threeGeometry: never;
      volume: number;
    }>();

    generateSteppedPreviewMock
      .mockReturnValueOnce(staleDeferred.promise)
      .mockResolvedValueOnce({
        geometry: freshGeometry,
        threeGeometry: freshThreeGeometry as never,
        volume: 80,
      });
    exportSteppedModelFilesMock.mockResolvedValue(undefined);

    const { result } = renderHook(() => useSteppedLayout());

    act(() => {
      result.current.addSlot(25);
    });

    act(() => {
      void result.current.handleGenerate();
    });

    act(() => {
      result.current.updateParam("spacing", 9);
    });

    staleDeferred.resolve({
      geometry: staleGeometry,
      threeGeometry: staleThreeGeometry as never,
      volume: 50,
    });

    await waitFor(() => {
      expect(result.current.isGenerating).toBe(false);
    });
    expect(result.current.threeGeometry).toBeNull();
    expect(result.current.volume).toBe(0);
    expect(result.current.isPreviewStale).toBe(true);

    await act(async () => {
      await result.current.handleGenerate();
    });
    expect(result.current.threeGeometry).toBe(freshThreeGeometry as never);
    expect(result.current.volume).toBe(80);
    expect(result.current.isPreviewStale).toBe(false);

    await act(async () => {
      await result.current.handleExportSTL();
    });
    expect(exportSteppedModelFilesMock).toHaveBeenCalledWith(
      result.current.params,
      result.current.effectiveDimensions,
      freshGeometry,
      trayWorkerServiceMock,
      browserDownloadPort,
    );
  });

  it("surfaces export and generation errors through toast messages", async () => {
    randomIdFactoryMock.createId.mockReturnValue("slot-1");
    generateSteppedPreviewMock.mockRejectedValueOnce(new Error("boom"));

    const { result } = renderHook(() => useSteppedLayout());

    act(() => {
      result.current.addSlot(25);
    });

    await act(async () => {
      await result.current.handleGenerate();
    });
    expect(toastMock).toHaveBeenCalledWith("error", "模型生成失败：boom");

    const fresh = renderHook(() => useSteppedLayout());
    await act(async () => {
      await fresh.result.current.handleExportSTL();
    });
    expect(toastMock).toHaveBeenCalledWith(
      "error",
      "当前没有可导出的模型，请先点击开始锻造",
    );

    generateSteppedPreviewMock.mockResolvedValueOnce({
      geometry: { id: "geom" } as never,
      threeGeometry: { dispose: vi.fn() } as never,
      volume: 20,
    });
    exportSteppedModelFilesMock.mockRejectedValueOnce(new Error("export failed"));

    await act(async () => {
      await result.current.handleGenerate();
    });

    act(() => {
      result.current.updateParam("spacing", 10);
    });
    await act(async () => {
      await result.current.handleExportSTL();
    });
    expect(toastMock).toHaveBeenCalledWith(
      "error",
      "参数已变更，请先点击开始锻造生成最新模型",
    );

    generateSteppedPreviewMock.mockResolvedValueOnce({
      geometry: { id: "geom-2" } as never,
      threeGeometry: { dispose: vi.fn() } as never,
      volume: 24,
    });
    await act(async () => {
      await result.current.handleGenerate();
    });
    await act(async () => {
      await result.current.handleExportSTL();
    });
    expect(toastMock).toHaveBeenCalledWith("error", "STL 导出失败：export failed");
  });
});
