"use client";

import { useCallback, useMemo, type SetStateAction } from "react";
import dynamic from "next/dynamic";
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

  const panel = useMemo(
    () => (
      <ParameterPanel
        params={model.params}
        updateParam={model.updateParam}
        replaceParams={importIntoWorkspace}
        resetParams={resetWorkspace}
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
      model.handleExportSTL,
      model.handleGenerate,
      model.isGenerating,
      model.params,
      model.updateParam,
      model.volume,
      resetWorkspace,
    ],
  );

  return {
    panel,
    overlays,
  };
}
