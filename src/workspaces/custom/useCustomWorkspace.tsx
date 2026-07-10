"use client";

import { useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
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

export function useCustomWorkspace({
  model,
}: UseCustomWorkspaceOptions): ModeWorkspace {
  const { draftActions, draftDialogProps, clearDraftBinding } =
    useWorkspaceDraftSupport({
      mode: "custom",
      params: model.params,
      setParams: model.setParams,
    });

  const resetWorkspace = useCallback(() => {
    model.setParams(CUSTOM_LAYOUT_DEFAULTS);
    clearDraftBinding();
  }, [clearDraftBinding, model]);

  const importIntoWorkspace = useCallback((params: unknown) => {
    model.setParams(params as CustomLayoutParams);
    clearDraftBinding();
  }, [clearDraftBinding, model]);

  const panel = useMemo(
    () => (
      <CustomPanel
        params={model.params}
        effectiveDimensions={model.effectiveDimensions}
        setParams={model.setParams}
        onResetParams={resetWorkspace}
        onImportParams={importIntoWorkspace}
        updateParam={model.updateParam}
        onAddSlot={model.addSlot}
        onRandomizeSlots={model.randomizeSlots}
        onGenerate={model.handleGenerate}
        onExportSTL={model.handleExportSTL}
        isGenerating={model.isGenerating}
        volume={model.volume}
        draftActions={draftActions}
      />
    ),
    [
      draftActions,
      importIntoWorkspace,
      model.addSlot,
      model.effectiveDimensions,
      model.handleExportSTL,
      model.handleGenerate,
      model.isGenerating,
      model.params,
      model.randomizeSlots,
      model.setParams,
      model.updateParam,
      model.volume,
      resetWorkspace,
    ],
  );

  return {
    mode: "custom",
    panel,
    draftDialogProps,
    commands: {
      resetWorkspace,
      importIntoWorkspace,
    },
  };
}
