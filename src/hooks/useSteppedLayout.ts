"use client";

import {
  useSteppedCadSplitOrchestration,
  type UseSteppedCadSplitOrchestrationReturn,
} from "@/hooks/useSteppedCadSplitOrchestration";
import { useSteppedLayoutController } from "@/hooks/useSteppedLayoutController";
import type { UseSteppedLayoutControllerReturn } from "@/hooks/useSteppedLayoutController";
import {
  exportSteppedModelFiles,
  exportSteppedSplitPartFiles,
  generateSteppedPreview,
  generateSteppedSplitPreview,
} from "@/lib/stepped-model-service";

export type UseSteppedLayoutReturn = UseSteppedLayoutControllerReturn &
  UseSteppedCadSplitOrchestrationReturn;

/**
 * Stepped Workspace 只消费面板编排和 Session replacement 所需的能力。
 * 不把 Viewport 专属的编辑命令扩散到 Workspace Adapter。
 */
export type SteppedWorkspaceModel = Pick<
  UseSteppedLayoutReturn,
  | "params"
  | "persistedParams"
  | "transactionRevision"
  | "setParams"
  | "updateParam"
  | "previewParam"
  | "addSlot"
  | "effectiveDimensions"
  | "volume"
  | "isGenerating"
  | "isPreviewStale"
  | "baseHoleFitViolations"
  | "baseHoleFitBlockingReason"
  | "contouredFootprintState"
  | "bridgeWarning"
  | "optimizationProposals"
  | "isOptimizingLayout"
  | "generateOptimizationProposals"
  | "applyOptimizationProposal"
  | "clearOptimizationProposals"
  | "beginContinuousEdit"
  | "commitContinuousEdit"
  | "cancelContinuousEdit"
  | "previewGroupHeight"
  | "previewGroupSmoothingRadius"
  | "previewGroupDisconnectDistance"
  | "addGroup"
  | "removeGroup"
  | "updateGroupHeight"
  | "updateGroupSmoothingOverride"
  | "updateGroupSmoothingRadius"
  | "updateGroupDisconnectOverride"
  | "updateGroupDisconnectDistance"
  | "moveSelectedSlotsToGroup"
  | "reorderGroups"
  | "updateSplitParam"
  | "previewSplitParam"
  | "setSplitGrooveType"
  | "updateGroupSplitPartTarget"
  | "handleGenerate"
  | "handleExportSTL"
  | "handleExportSplitParts"
>;

/**
 * Stepped Viewport 只消费画布、预览和连续编辑能力。
 * Workspace 面板与 Split Orchestration 的能力不进入该 Interface。
 */
export type SteppedViewportModel = Pick<
  UseSteppedLayoutReturn,
  | "params"
  | "persistedParams"
  | "setContouredWorkingPreviewEnabled"
  | "cancelContinuousEdit"
  | "outlinePreview"
  | "workingContouredFootprintState"
  | "contouredFootprintState"
  | "updateSlotPosition"
  | "removeSlot"
  | "removeSlots"
  | "updateSlotRotation"
  | "updateMultipleSlots"
  | "updateMultipleSlotsLive"
  | "insertSlots"
  | "duplicateSlots"
  | "undo"
  | "beginContinuousEdit"
  | "commitContinuousEdit"
  | "pauseOutlinePreview"
  | "resumeOutlinePreview"
  | "threeGeometry"
  | "isPreviewStale"
  | "isGenerating"
  | "handleGenerate"
>;

export function useSteppedLayout(): UseSteppedLayoutReturn {
  const steppedModel = useSteppedLayoutController({
    mode: "stepped",
    generatePreview: generateSteppedPreview,
    exportModel: exportSteppedModelFiles,
  });
  const splitModel = useSteppedCadSplitOrchestration({
    params: steppedModel.persistedParams,
    contouredFootprintState: steppedModel.contouredFootprintState,
    transactionRevision: steppedModel.transactionRevision,
    edit: steppedModel.edit,
    previewEdit: steppedModel.previewEdit,
    generateSplitPreview: generateSteppedSplitPreview,
    exportSplitParts: exportSteppedSplitPartFiles,
  });

  return { ...steppedModel, ...splitModel };
}
