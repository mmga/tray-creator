"use client";

import { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  PanelActionSection,
  type PanelDraftActions,
} from "@/components/PanelActionSection";
import { useAutoPreview } from "@/hooks/useAutoPreview";
import { useWorkspaceDraftSupport } from "@/workspaces/shared";
import type { ModeWorkspace } from "@/workspaces/types";
import { CUSTOM_LAYOUT_DEFAULTS } from "@/lib/custom-config";
import type { CustomLayoutParams } from "@/types/custom-tray";
import type { useCustomLayout } from "@/hooks/useCustomLayout";

const CustomPanel = dynamic(() => import("@/components/CustomPanel"), {
  ssr: false,
});

interface UseCustomWorkspaceOptions {
  model: ReturnType<typeof useCustomLayout>;
}

interface CustomDraftActionAreaProps {
  params: CustomLayoutParams;
  isGenerating: boolean;
  onGenerate: () => void;
  onExportSTL: () => void;
  onReset: () => void;
  onImport: (params: CustomLayoutParams) => void;
  draftActions: PanelDraftActions;
}

function CustomDraftActionArea({
  params,
  isGenerating,
  onGenerate,
  onExportSTL,
  onReset,
  onImport,
  draftActions,
}: CustomDraftActionAreaProps) {
  const [autoPreview, setAutoPreview] = useState(false);

  useAutoPreview(params, {
    enabled: autoPreview,
    isGenerating,
    isBlocked: false,
    onGenerate,
  });

  return (
    <PanelActionSection
      autoPreviewId="custom-auto-preview"
      autoPreview={autoPreview}
      onAutoPreviewChange={setAutoPreview}
      onGenerate={onGenerate}
      onExportSTL={onExportSTL}
      onReset={onReset}
      isGenerating={isGenerating}
      mode="custom"
      params={params}
      onImport={onImport}
      draftActions={draftActions}
    />
  );
}

export function useCustomWorkspace({
  model,
}: UseCustomWorkspaceOptions): ModeWorkspace {
  const { draftActions, overlays, clearDraftBinding } =
    useWorkspaceDraftSupport({
      mode: "custom",
      params: model.params,
      setParams: model.setParams,
    });

  const resetWorkspace = useCallback(() => {
    model.setParams(CUSTOM_LAYOUT_DEFAULTS);
    clearDraftBinding();
  }, [clearDraftBinding, model]);

  const importIntoWorkspace = useCallback((params: CustomLayoutParams) => {
    model.setParams(params);
    clearDraftBinding();
  }, [clearDraftBinding, model]);

  const actions = useMemo(
    () => (
      <CustomDraftActionArea
        params={model.params}
        isGenerating={model.isGenerating}
        onGenerate={model.handleGenerate}
        onExportSTL={model.handleExportSTL}
        onReset={resetWorkspace}
        onImport={importIntoWorkspace}
        draftActions={draftActions}
      />
    ),
    [
      draftActions,
      importIntoWorkspace,
      model.handleExportSTL,
      model.handleGenerate,
      model.isGenerating,
      model.params,
      resetWorkspace,
    ],
  );

  const panel = useMemo(
    () => (
      <CustomPanel
        params={model.params}
        effectiveDimensions={model.effectiveDimensions}
        actions={actions}
        updateParam={model.updateParam}
        onAddSlot={model.addSlot}
        onRandomizeSlots={model.randomizeSlots}
        isGenerating={model.isGenerating}
        volume={model.volume}
      />
    ),
    [
      actions,
      model.addSlot,
      model.effectiveDimensions,
      model.isGenerating,
      model.params,
      model.randomizeSlots,
      model.updateParam,
      model.volume,
    ],
  );

  return {
    panel,
    overlays,
  };
}
