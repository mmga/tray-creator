import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as THREE from "three";
import { STEPPED_LAYOUT_DEFAULTS } from "@/lib/stepped-config";
import type { SteppedLayoutParams } from "@/types/custom-tray";

const {
  toastMock,
  generateSplitPreviewMock,
  exportSplitPartsMock,
  trayWorkerServiceMock,
  browserDownloadPortMock,
} = vi.hoisted(() => ({
  toastMock: vi.fn(),
  generateSplitPreviewMock: vi.fn(),
  exportSplitPartsMock: vi.fn(),
  trayWorkerServiceMock: {
    generateSteppedSplitParts: vi.fn(),
    generateSteppedOutlinePreview: vi.fn(),
    exportSTL: vi.fn(),
  },
  browserDownloadPortMock: {
    downloadBlob: vi.fn(),
  },
}));

vi.mock("@/hooks/useToast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/lib/worker/worker-service", () => ({
  trayWorkerService: trayWorkerServiceMock,
}));

vi.mock("@/lib/download-port", () => ({
  browserDownloadPort: browserDownloadPortMock,
}));

import { useSteppedCadSplitOrchestration } from "@/hooks/useSteppedCadSplitOrchestration";

const editMock = vi.fn();
const previewEditMock = vi.fn();
const editPorts = { edit: editMock, previewEdit: previewEditMock };

function createParams(): SteppedLayoutParams {
  return {
    ...STEPPED_LAYOUT_DEFAULTS,
    enableSplitAssembly: true,
    groups: [
      { ...STEPPED_LAYOUT_DEFAULTS.groups[0], id: "group-1" },
      {
        ...STEPPED_LAYOUT_DEFAULTS.groups[0],
        id: "group-2",
        name: "组 2",
        bottomHeight: 10,
      },
    ],
  };
}

function createPart(dispose: ReturnType<typeof vi.fn>) {
  return {
    index: 0,
    filenameLabel: "part-1",
    label: "分件 1",
    fromHeight: 0,
    toHeight: 10,
    threeGeometry: { dispose } as unknown as THREE.BufferGeometry,
  };
}

describe("useSteppedCadSplitOrchestration", () => {
  beforeEach(() => {
    toastMock.mockReset();
    generateSplitPreviewMock.mockReset();
    exportSplitPartsMock.mockReset();
    editMock.mockReset();
    previewEditMock.mockReset();
  });

  it("总开关关闭时阻断分件预览和导出", async () => {
    const params = { ...createParams(), enableSplitAssembly: false };
    const { result } = renderHook(() =>
      useSteppedCadSplitOrchestration({
        ...editPorts,
        params,
        generateSplitPreview: generateSplitPreviewMock,
        exportSplitParts: exportSplitPartsMock,
      }),
    );

    await act(async () => {
      await result.current.handleGenerateSplitPreview();
      await result.current.handleExportSplitParts();
    });

    expect(generateSplitPreviewMock).not.toHaveBeenCalled();
    expect(exportSplitPartsMock).not.toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith("error", "请先启用分件与装配");
  });

  it("通过共享事务 Interface 提交拆分编辑意图", () => {
    const { result } = renderHook(() =>
      useSteppedCadSplitOrchestration({
        ...editPorts,
        params: createParams(),
        generateSplitPreview: generateSplitPreviewMock,
        exportSplitParts: exportSplitPartsMock,
      }),
    );

    act(() => {
      result.current.updateSplitParam("enableSplitLocators", true);
      result.current.previewSplitParam("splitGrooveDepth", 2.4);
      result.current.setSplitGrooveType("inset");
      result.current.updateGroupSplitPartTarget("group-1", "group-2");
    });

    expect(editMock).toHaveBeenNthCalledWith(1, {
      type: "param.update",
      key: "enableSplitLocators",
      value: true,
    });
    expect(previewEditMock).toHaveBeenCalledWith({
      type: "param.update",
      key: "splitGrooveDepth",
      value: 2.4,
    });
    expect(editMock).toHaveBeenNthCalledWith(2, {
      type: "params.patch",
      patch: { enableSplitRecess: true, splitGrooveType: "inset" },
    });
    expect(editMock).toHaveBeenNthCalledWith(3, {
      type: "group.split-target",
      groupId: "group-1",
      targetGroupId: "group-2",
    });
  });

  it("生成拆件预览并在 params 失效时释放旧资源", async () => {
    const dispose = vi.fn();
    const params = createParams();
    generateSplitPreviewMock.mockResolvedValue([createPart(dispose)]);

    const { result, rerender } = renderHook(
      ({ currentParams, transactionRevision }) =>
        useSteppedCadSplitOrchestration({
          ...editPorts,
          params: currentParams,
          transactionRevision,
          generateSplitPreview: generateSplitPreviewMock,
          exportSplitParts: exportSplitPartsMock,
        }),
      { initialProps: { currentParams: params, transactionRevision: 0 } },
    );

    await act(async () => {
      await result.current.handleGenerateSplitPreview();
    });

    expect(generateSplitPreviewMock).toHaveBeenCalledWith(
      params,
      trayWorkerServiceMock,
    );
    expect(result.current.splitPreviewParts).toHaveLength(1);
    expect(result.current.isGeneratingSplitPreview).toBe(false);

    rerender({
      currentParams: { ...params, trayWidth: params.trayWidth + 1 },
      transactionRevision: 1,
    });

    await waitFor(() => {
      expect(result.current.splitPreviewParts).toBeNull();
    });
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it("替换、clear 和 unmount 时各自释放当前 preview parts", async () => {
    const firstDispose = vi.fn();
    const secondDispose = vi.fn();
    generateSplitPreviewMock
      .mockResolvedValueOnce([createPart(firstDispose)])
      .mockResolvedValueOnce([createPart(secondDispose)]);
    const params = createParams();

    const { result, unmount } = renderHook(() =>
      useSteppedCadSplitOrchestration({
        ...editPorts,
        params,
        generateSplitPreview: generateSplitPreviewMock,
        exportSplitParts: exportSplitPartsMock,
      }),
    );

    await act(async () => {
      await result.current.handleGenerateSplitPreview();
    });
    await act(async () => {
      await result.current.handleGenerateSplitPreview();
    });
    expect(firstDispose).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.clearSplitPreview();
    });
    expect(secondDispose).toHaveBeenCalledTimes(1);

    generateSplitPreviewMock.mockResolvedValueOnce([createPart(secondDispose)]);
    await act(async () => {
      await result.current.handleGenerateSplitPreview();
    });
    unmount();
    expect(secondDispose).toHaveBeenCalledTimes(2);
  });

  it("拒绝少于两个分组，并报告生成失败", async () => {
    const validParams = createParams();
    const oneGroupParams = {
      ...validParams,
      groups: [validParams.groups[0]],
    };
    const { result, rerender } = renderHook(
      ({ params }) =>
        useSteppedCadSplitOrchestration({
          ...editPorts,
          params,
          generateSplitPreview: generateSplitPreviewMock,
          exportSplitParts: exportSplitPartsMock,
        }),
      { initialProps: { params: oneGroupParams } },
    );

    await act(async () => {
      await result.current.handleGenerateSplitPreview();
    });
    expect(generateSplitPreviewMock).not.toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith(
      "error",
      "至少需要两个分组才能预览拆件",
    );

    generateSplitPreviewMock.mockRejectedValue(new Error("worker failed"));
    rerender({ params: validParams });
    await act(async () => {
      await result.current.handleGenerateSplitPreview();
    });
    expect(toastMock).toHaveBeenLastCalledWith(
      "error",
      "拆件预览失败：worker failed",
    );
    expect(result.current.isGeneratingSplitPreview).toBe(false);
  });

  it("使用统一阶梯 Mode Snapshot 导出分件并保留成功提示", async () => {
    const params = createParams();
    exportSplitPartsMock.mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useSteppedCadSplitOrchestration({
        ...editPorts,
        params,
        generateSplitPreview: generateSplitPreviewMock,
        exportSplitParts: exportSplitPartsMock,
      }),
    );

    await act(async () => {
      await result.current.handleExportSplitParts();
    });

    const [snapshot, workerPort, downloadPort] = exportSplitPartsMock.mock.calls[0];
    expect(snapshot).toMatchObject({ mode: "stepped" });
    expect(snapshot.params).toMatchObject({
      groups: params.groups,
      enableSplitAssembly: true,
    });
    expect(snapshot.params).not.toHaveProperty("activeGroupId");
    expect(workerPort).toBe(trayWorkerServiceMock);
    expect(downloadPort).toBe(browserDownloadPortMock);
    expect(toastMock).toHaveBeenCalledWith(
      "success",
      "阶梯分件文件已导出",
    );
  });

  it("拒绝在少于两个分组时导出分件", async () => {
    const params = createParams();
    params.groups = [params.groups[0]];
    const { result } = renderHook(() =>
      useSteppedCadSplitOrchestration({
        ...editPorts,
        params,
        generateSplitPreview: generateSplitPreviewMock,
        exportSplitParts: exportSplitPartsMock,
      }),
    );

    await act(async () => {
      await result.current.handleExportSplitParts();
    });

    expect(exportSplitPartsMock).not.toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith(
      "error",
      "至少需要两个分组才能导出分件",
    );
  });

  it("底板孔位不适配时阻断拆件预览和导出", async () => {
    const params: SteppedLayoutParams = {
      ...createParams(),
      baseHoleStructure: "magnet-post-hole",
      magnetPostHoleDiameter: 15,
      slots: [{
        id: "small-slot",
        groupId: "group-1",
        x: 30,
        y: 30,
        shape: "circle",
        width: 10,
        height: 10,
        slotWidth: 10.4,
        slotHeight: 10.4,
        rotation: 0,
      }],
    };
    const { result } = renderHook(() =>
      useSteppedCadSplitOrchestration({
        ...editPorts,
        params,
        generateSplitPreview: generateSplitPreviewMock,
        exportSplitParts: exportSplitPartsMock,
      }),
    );

    await act(async () => {
      await result.current.handleGenerateSplitPreview();
      await result.current.handleExportSplitParts();
    });

    expect(generateSplitPreviewMock).not.toHaveBeenCalled();
    expect(exportSplitPartsMock).not.toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith(
      "error",
      expect.stringContaining("底板孔位不适配"),
    );
  });

  it("报告分件导出失败", async () => {
    exportSplitPartsMock.mockRejectedValue(new Error("export failed"));
    const { result } = renderHook(() =>
      useSteppedCadSplitOrchestration({
        ...editPorts,
        params: createParams(),
        generateSplitPreview: generateSplitPreviewMock,
        exportSplitParts: exportSplitPartsMock,
      }),
    );

    await act(async () => {
      await result.current.handleExportSplitParts();
    });

    expect(toastMock).toHaveBeenCalledWith(
      "error",
      "分件导出失败：export failed",
    );
  });
});
