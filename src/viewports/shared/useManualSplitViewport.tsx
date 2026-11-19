"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import type { FlatTraySnapshot } from "@/components/ManualSplitEditor";
import { MANUAL_SPLIT_DEFAULTS, type ManualSplitSettings } from "@/lib/manual-split-plan";

const ManualSplitEditor = dynamic(() => import("@/components/ManualSplitEditor"), {
  ssr: false,
  loading: () => <p role="status" className="p-5 pt-16">正在打开拆件编辑…</p>,
});

export function useManualSplitViewport({ snapshot, onChange, onUndo, canUndo, blockingReason, onOpen }: {
  snapshot: FlatTraySnapshot;
  onChange: (settings: ManualSplitSettings) => void;
  onUndo: () => void;
  canUndo: boolean;
  blockingReason?: string | null;
  onOpen: () => void;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const settings = snapshot.params.manualSplit ?? MANUAL_SPLIT_DEFAULTS;
  const locked = Boolean(snapshot.params.stackableBox?.enabled);
  const editing = open && settings.enabled && !locked;

  const action = <Button size="sm" variant="outline" aria-pressed={editing} aria-disabled={locked}
    title={locked ? "堆叠盒体暂不支持拆件打印" : undefined} onClick={() => {
      if (locked) return;
      if (editing) { close(); return; }
      onOpen();
      if (!settings.enabled) onChange({ ...settings, enabled: true });
      setOpen(true);
    }}>{locked ? "盒体暂不支持拆件" : "拆件打印"}</Button>;

  return {
    close, action, editing,
    canvas: editing ? <ManualSplitEditor snapshot={snapshot} settings={settings} onChange={onChange}
      onExit={close} onUndo={onUndo} canUndo={canUndo} blockingReason={blockingReason} /> : null,
  };
}
