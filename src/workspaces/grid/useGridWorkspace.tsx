"use client";

import { useCallback, useMemo, useState, type SetStateAction } from "react";
import dynamic from "next/dynamic";
import {
  PanelActionSection,
  type PanelDraftActions,
} from "@/components/PanelActionSection";
import { useAutoPreview } from "@/hooks/useAutoPreview";
import { useWorkspaceDraftSupport } from "@/workspaces/shared";
import type { ModeWorkspace } from "@/workspaces/types";
import type { TrayParams } from "@/types/tray";
import type { useTrayModel } from "@/hooks/useTrayModel";

const ParameterPanel = dynamic(() => import("@/components/ParameterPanel"), {
  ssr: false,
});

interface UseGridWorkspaceOptions {
  model: ReturnType<typeof useTrayModel>;
}

interface GridDraftActionAreaProps {
  params: TrayParams;
  isGenerating: boolean;
  onGenerate: () => void;
  onExportSTL: () => void;
  onReset: () => void;
  onImport: (params: TrayParams) => void;
  draftActions: PanelDraftActions;
}

function GridDraftActionArea({
  params,
  isGenerating,
  onGenerate,
  onExportSTL,
  onReset,
  onImport,
  draftActions,
}: GridDraftActionAreaProps) {
  const [autoPreview, setAutoPreview] = useState(false);

  useAutoPreview(params, {
    enabled: autoPreview,
    isGenerating,
    isBlocked: false,
    onGenerate,
  });

  return (
    <PanelActionSection
      autoPreviewId="auto-preview"
      autoPreview={autoPreview}
      onAutoPreviewChange={setAutoPreview}
      onGenerate={onGenerate}
      onExportSTL={onExportSTL}
      onReset={onReset}
      isGenerating={isGenerating}
      mode="grid"
      params={params}
      onImport={onImport}
      draftActions={draftActions}
    />
  );
}

export function useGridWorkspace({
  model,
}: UseGridWorkspaceOptions): ModeWorkspace {
  const setGridParams = useCallback((value: SetStateAction<TrayParams>) => {
    const nextParams = typeof value === "function" ? value(model.params) : value;
    model.replaceParams(nextParams);
  }, [model]);

  const { draftActions, overlays, clearDraftBinding } =
    useWorkspaceDraftSupport({
      mode: "grid",
      params: model.params,
      setParams: setGridParams,
    });

  const resetWorkspace = useCallback(() => {
    model.resetParams();
    clearDraftBinding();
  }, [clearDraftBinding, model]);

  const importIntoWorkspace = useCallback((params: TrayParams) => {
    model.replaceParams(params);
    clearDraftBinding();
  }, [clearDraftBinding, model]);

  const actions = useMemo(
    () => (
      <GridDraftActionArea
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
      <ParameterPanel
        params={model.params}
        updateParam={model.updateParam}
        actions={actions}
        isGenerating={model.isGenerating}
        isPreviewStale={model.isPreviewStale}
        volume={model.volume}
      />
    ),
    [
      actions,
      model.isGenerating,
      model.isPreviewStale,
      model.params,
      model.updateParam,
      model.volume,
    ],
  );

  return {
    panel,
    overlays,
  };
}
