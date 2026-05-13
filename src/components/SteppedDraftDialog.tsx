"use client";

import type { DraftListItem } from "@/lib/local-drafts";
import { DraftManagerDialog } from "@/components/DraftManagerDialog";

interface SteppedDraftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  drafts: DraftListItem[];
  currentDraftId: string | null;
  draftNameInput: string;
  onDraftNameInputChange: (v: string) => void;
  onSaveAsNew: () => void;
  onSaveCurrent: () => void;
  onLoad: (id: string) => void;
  onRename: (id: string, newTitle: string) => void;
  onDelete: (id: string) => void;
  onExport: (id: string) => void;
  hasUnsavedChanges?: boolean;
}

export function SteppedDraftDialog(props: SteppedDraftDialogProps) {
  return (
    <DraftManagerDialog
      mode="stepped"
      open={props.open}
      onOpenChange={props.onOpenChange}
      drafts={props.drafts}
      currentDraftId={props.currentDraftId}
      hasUnsavedChanges={props.hasUnsavedChanges ?? false}
      draftNameInput={props.draftNameInput}
      onDraftNameInputChange={props.onDraftNameInputChange}
      onSaveAsNew={props.onSaveAsNew}
      onSaveCurrent={props.onSaveCurrent}
      onLoad={props.onLoad}
      onRename={props.onRename}
      onDelete={props.onDelete}
      onExport={props.onExport}
      renderSummary={(item) => (
        <>
          <span>{item.slotCount} 槽</span>
          <span>{item.groupCount} 组</span>
          <span className="font-mono">
            {item.trayWidth}×{item.trayDepth}mm
          </span>
        </>
      )}
    />
  );
}
