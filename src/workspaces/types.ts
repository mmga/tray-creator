"use client";

import type { ReactNode } from "react";
import type { DraftManagerDialogProps } from "@/components/DraftManagerDialog";
import type { AnyDraftListItem } from "@/lib/local-drafts";
import type { AppMode } from "@/types/custom-tray";

export interface ModeWorkspace {
  mode: AppMode;
  panel: ReactNode;
  draftDialogProps: DraftManagerDialogProps<AnyDraftListItem>;
  commands: {
    resetWorkspace: () => void;
    importIntoWorkspace: (params: unknown) => void;
  };
}
