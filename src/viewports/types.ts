"use client";

import type { ReactNode } from "react";
import type { AppMode } from "@/types/custom-tray";

export interface ModeViewportWorkspace {
  mode: AppMode;
  viewport: ReactNode;
  resetTransientState: () => void;
}
