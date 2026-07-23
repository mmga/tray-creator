"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { APP_MODE_LABELS } from "@/lib/historical-param-artifact-reader";
import type { AppMode } from "@/types/custom-tray";

interface ModeReplacementConfirmDialogProps {
  mode: AppMode | null;
  kind: "reset" | "draft" | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ModeReplacementConfirmDialog({
  mode,
  kind,
  onCancel,
  onConfirm,
}: ModeReplacementConfirmDialogProps) {
  return (
    <Dialog open={mode !== null} onOpenChange={(open) => {
      if (!open) onCancel();
    }}>
      <DialogContent className="max-w-md border-[#713737] bg-[#0e0d0b]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#e28b82]">
            <AlertTriangle className="size-5" />
            确认替换当前编辑会话
          </DialogTitle>
          <DialogDescription>
            「{mode ? APP_MODE_LABELS[mode] : ""}」存在未保存的 Draft 修改。
            {kind === "reset" ? "重置" : "加载 Draft"}会覆盖这些修改。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>取消</Button>
          <Button type="button" onClick={onConfirm}>确认替换</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
