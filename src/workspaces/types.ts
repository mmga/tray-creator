"use client";

import type { ReactNode } from "react";

/**
 * Mode Workspace：每个 Mode 的左侧工作区编排层对外只暴露两块渲染内容。
 * - panel：左侧操作面板
 * - overlays：该 Mode 需要在页面层挂载的弹层（如 Draft Manager Dialog）
 *
 * 页面只负责渲染 `{overlays}` 与 `<aside>{panel}</aside>`，不感知 Mode 特有规则。
 */
export interface ModeWorkspace {
  panel: ReactNode;
  overlays: ReactNode;
}
