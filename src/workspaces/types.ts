"use client";

import type { ReactNode } from "react";
import type { ExportableParams } from "@/lib/mode-param-snapshot";
import type { PreparedDraftLoad } from "@/hooks/useModeDrafts";
import type { AppMode } from "@/types/custom-tray";

export interface ModeWorkspaceReplacementTarget {
  mode: AppMode;
  currentDraftId: string | null;
  hasUnsavedChanges: boolean;
  paramsRevision: number;
  commitReset: () => void;
  commitImport: (params: ExportableParams) => void;
  commitDraftLoad: (prepared: PreparedDraftLoad<AppMode>) => void;
}

/**
 * Mode Workspace：每个 Mode 的左侧工作区编排层对外暴露渲染内容与统一导入目标。
 * - panel：左侧操作面板
 * - overlays：该 Mode 需要在页面层挂载的弹层（如 Draft Manager Dialog）
 * - importTarget：页面级导入编排用于读取覆盖风险并在确认后提交参数
 *
 * 页面渲染 `{overlays}` 与 `<aside>{panel}</aside>`；导入编排不感知 Mode 特有规则。
 */
export interface ModeWorkspace {
  panel: ReactNode;
  overlays: ReactNode;
  replacementTarget: ModeWorkspaceReplacementTarget;
}
