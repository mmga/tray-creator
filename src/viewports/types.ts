"use client";

import type { ReactNode } from "react";
import type { AppMode } from "@/types/custom-tray";

export interface ModeViewportWorkspace<M extends AppMode = AppMode> {
  mode: M;
  viewport: ReactNode;
  /** 普通离开当前 Mode；不改变该 Mode 的视图选择。 */
  deactivate: () => void;
  /** 替换该 Mode Editing Session；清理瞬态状态并回到 2D。 */
  resetForSessionReplacement: () => void;
}
