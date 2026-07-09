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
    generateSteppedCadSplitParts: vi.fn(),
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

function createParams(): SteppedLayoutParams {
  return {
    ...STEPPED_LAYOUT_DEFAULTS,
    groups: [
      { ...STEPPED_LAYOUT_DEFAULTS.groups[0], id: "group-1" },
      {
        ...STEPPED_LAYOUT_DEFAULTS.groups[0],
        id: "group-2",
        name: "组 2",
        bottomHeight: 10,
      },
    ],
    activeGroupId: "group-1",
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
  });

  it("生成拆件预览并在 params 失效时释放旧资源", async () => {
    const dispose = vi.fn();
    const params = createParams();
    generateSplitPreviewMock.mockResolvedValue([createPart(dispose)]);

    const { result, rerender } = renderHook(
      ({ currentParams }) =>
        useSteppedCadSplitOrchestration({
          params: currentParams,
          generateSplitPreview: generateSplitPreviewMock,
          exportSplitParts: exportSplitPartsMock,
        }),
      { initialProps: { currentParams: params } },
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

    rerender({ currentParams: { ...params, trayWidth: params.trayWidth + 1 } });

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

  it("使用有效尺寸导出分件并保留成功提示", async () => {
    const params = createParams();
    exportSplitPartsMock.mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useSteppedCadSplitOrchestration({
        params,
        generateSplitPreview: generateSplitPreviewMock,
        exportSplitParts: exportSplitPartsMock,
      }),
    );

    await act(async () => {
      await result.current.handleExportSplitParts();
    });

    expect(exportSplitPartsMock).toHaveBeenCalledWith(
      params,
      expect.objectContaining({
        width: expect.any(Number),
        depth: expect.any(Number),
      }),
      trayWorkerServiceMock,
      browserDownloadPortMock,
    );
    expect(toastMock).toHaveBeenCalledWith(
      "success",
      "分件 STL、定位孔清单和参数文件已导出",
    );
  });
});
