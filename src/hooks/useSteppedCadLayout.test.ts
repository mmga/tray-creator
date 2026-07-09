import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as THREE from "three";
import { STEPPED_LAYOUT_DEFAULTS } from "@/lib/stepped-config";

const {
  generateSteppedCadPreviewMock,
  exportSteppedCadModelFilesMock,
  generateSteppedCadSplitPreviewMock,
  exportSteppedCadSplitPartFilesMock,
  useSteppedOutlinePreviewMock,
  toastMock,
  trayWorkerServiceMock,
} = vi.hoisted(() => ({
  generateSteppedCadPreviewMock: vi.fn(),
  exportSteppedCadModelFilesMock: vi.fn(),
  generateSteppedCadSplitPreviewMock: vi.fn(),
  exportSteppedCadSplitPartFilesMock: vi.fn(),
  useSteppedOutlinePreviewMock: vi.fn(),
  toastMock: vi.fn(),
  trayWorkerServiceMock: {
    generateSteppedCad: vi.fn(),
    generateSteppedCadSplitParts: vi.fn(),
    generateSteppedOutlinePreview: vi.fn(),
    exportSTL: vi.fn(),
  },
}));

vi.mock("@/lib/stepped-cad-model-service", () => ({
  generateSteppedCadPreview: generateSteppedCadPreviewMock,
  exportSteppedCadModelFiles: exportSteppedCadModelFilesMock,
  generateSteppedCadSplitPreview: generateSteppedCadSplitPreviewMock,
  exportSteppedCadSplitPartFiles: exportSteppedCadSplitPartFilesMock,
}));

vi.mock("@/hooks/useSteppedOutlinePreview", () => ({
  useSteppedOutlinePreview: useSteppedOutlinePreviewMock,
}));

vi.mock("@/hooks/useToast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/lib/worker/worker-service", () => ({
  trayWorkerService: trayWorkerServiceMock,
}));

import { useSteppedCadLayout } from "@/hooks/useSteppedCadLayout";

describe("useSteppedCadLayout", () => {
  beforeEach(() => {
    generateSteppedCadSplitPreviewMock.mockReset();
    useSteppedOutlinePreviewMock.mockReturnValue({
      outlinePreview: null,
      pauseOutlinePreview: vi.fn(),
      resumeOutlinePreview: vi.fn(),
    });
    toastMock.mockReset();
  });

  it("组合共享 stepped 编辑与 CAD split preview", async () => {
    const dispose = vi.fn();
    generateSteppedCadSplitPreviewMock.mockResolvedValue([
      {
        index: 0,
        filenameLabel: "part-1",
        label: "分件 1",
        fromHeight: 0,
        toHeight: 10,
        threeGeometry: { dispose } as unknown as THREE.BufferGeometry,
      },
    ]);
    const { result } = renderHook(() => useSteppedCadLayout());

    act(() => {
      result.current.setParams({
        ...STEPPED_LAYOUT_DEFAULTS,
        groups: [
          { ...STEPPED_LAYOUT_DEFAULTS.groups[0], id: "group-1" },
          {
            ...STEPPED_LAYOUT_DEFAULTS.groups[0],
            id: "group-2",
            bottomHeight: 10,
          },
        ],
        activeGroupId: "group-1",
      });
    });
    await act(async () => {
      await result.current.handleGenerateSplitPreview();
    });

    expect(result.current.params.groups).toHaveLength(2);
    expect(result.current.splitPreviewParts).toHaveLength(1);
    expect(generateSteppedCadSplitPreviewMock).toHaveBeenCalledWith(
      result.current.params,
      trayWorkerServiceMock,
    );
  });
});
