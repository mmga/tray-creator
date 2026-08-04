import { describe, expect, it } from "vitest";
import type {
  SteppedViewportModel,
  SteppedWorkspaceModel,
} from "@/hooks/useSteppedLayout";

type Assert<T extends true> = T;

type WorkspaceDoesNotOwnViewportGeometry = Assert<
  "threeGeometry" extends keyof SteppedWorkspaceModel ? false : true
>;

type WorkspaceDoesNotOwnViewportEditing = Assert<
  "updateSlotPosition" extends keyof SteppedWorkspaceModel ? false : true
>;

type ViewportDoesNotOwnOptimization = Assert<
  "generateOptimizationProposals" extends keyof SteppedViewportModel ? false : true
>;

type ViewportDoesNotOwnSplitExport = Assert<
  "handleExportSplitParts" extends keyof SteppedViewportModel ? false : true
>;

type ViewportOwnsCanvasGeometry = Assert<
  "threeGeometry" extends keyof SteppedViewportModel ? true : false
>;

const interfaceAssertions: [
  WorkspaceDoesNotOwnViewportGeometry,
  WorkspaceDoesNotOwnViewportEditing,
  ViewportDoesNotOwnOptimization,
  ViewportDoesNotOwnSplitExport,
  ViewportOwnsCanvasGeometry,
] = [true, true, true, true, true];

describe("Stepped Layout Core 调用 Interface", () => {
  it("按 Workspace 与 Viewport 的真实消费范围收窄", () => {
    expect(interfaceAssertions).toEqual([true, true, true, true, true]);
  });
});
