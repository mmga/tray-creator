"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { TrayViewerSplitPart } from "@/components/TrayViewer";
import { useToast } from "@/hooks/useToast";
import { MANUAL_SPLIT_DEFAULTS, type FlatTraySnapshot, type ManualSplitSettings } from "@/lib/manual-split-plan";
import { browserDownloadPort } from "@/lib/download-port";
import { captureModeParamSnapshot, createModelGeometryFingerprint } from "@/lib/mode-param-snapshot";
import { loadThreeGeometry } from "@/lib/three-geometry-loader";
import { trayWorkerService } from "@/lib/worker/worker-service";

const ManualSplitEditor = dynamic(() => import("@/components/ManualSplitEditor"), {
  ssr: false,
  loading: () => <p role="status" className="p-5 pt-16">正在打开拆件编辑…</p>,
});

export function useManualSplitViewport({ snapshot, onChange, onUndo, canUndo, blockingReason, onOpen, onOpenPreview }: {
  snapshot: FlatTraySnapshot;
  onChange: (settings: ManualSplitSettings) => void;
  onUndo: () => void;
  canUndo: boolean;
  blockingReason?: string | null;
  onOpen: () => void;
  onOpenPreview: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<{ key: string; parts: TrayViewerSplitPart[] } | null>(null);
  const [previewRequest, setPreviewRequest] = useState<{ key: string; id: number }>();
  const [requestedSplitKey, setRequestedSplitKey] = useState<string>();
  const [exporting, setExporting] = useState(false);
  const exportBusy = useRef(false);
  const previewId = useRef(0);
  const { toast } = useToast();
  const settings = snapshot.params.manualSplit ?? MANUAL_SPLIT_DEFAULTS;
  const locked = Boolean(snapshot.params.stackableBox?.enabled);
  const editing = open && settings.enabled && !locked;
  const ready = settings.enabled && !locked && !blockingReason;
  const key = useMemo(() => createModelGeometryFingerprint(snapshot) + "|" + JSON.stringify(settings), [snapshot, settings]);
  const preferSplit = requestedSplitKey === key;
  const current = useRef<string | null>(null);
  const epoch = useRef(0);
  const close = useCallback(() => setOpen(false), []);
  const reset = useCallback(() => {
    epoch.current += 1;
    previewId.current += 1;
    setPreviewRequest(undefined);
    setPreview(null);
    setRequestedSplitKey(undefined);
    close();
  }, [close]);
  useLayoutEffect(() => {
    current.current = ready ? key : null;
    return () => { current.current = null; };
  }, [key, ready]);
  useEffect(() => () => preview?.parts.forEach((part) => part.threeGeometry.dispose()), [preview]);

  const parts = ready && preview?.key === key ? preview.parts : null;

  function stableSnapshot() {
    return snapshot.mode === "grid"
      ? captureModeParamSnapshot("grid", snapshot.params)
      : captureModeParamSnapshot("custom", snapshot.params);
  }

  async function generatePreview() {
    if (!trayWorkerService || !ready || parts || previewRequest?.key === key) return;
    const id = ++previewId.current;
    const isCurrent = () => id === previewId.current && current.current === key;
    setPreviewRequest({ key, id });
    setPreview(null);
    try {
      const result = await trayWorkerService.generateManualSplitParts(stableSnapshot());
      if (!isCurrent()) return;
      const geometries = await Promise.allSettled(result.map((part) => loadThreeGeometry(part.geometry)));
      if (!isCurrent() || geometries.some((item) => item.status === "rejected")) {
        geometries.forEach((item) => { if (item.status === "fulfilled") item.value.dispose(); });
        if (isCurrent()) throw new Error("无法读取分件预览网格");
        return;
      }
      setPreview({
        key,
        parts: geometries.flatMap((item, index) => item.status === "fulfilled" ? [{
          index,
          label: `零件 ${result[index].id}`,
          toHeight: Number(result[index].size[2].toFixed(1)),
          threeGeometry: item.value,
        }] : []),
      });
    } catch (error) {
      if (isCurrent()) toast("error", error instanceof Error ? error.message : "拆件预览失败");
    } finally {
      setPreviewRequest((previous) => previous?.id === id ? undefined : previous);
    }
  }

  async function exportParts() {
    if (!trayWorkerService || !ready || exportBusy.current) return;
    const captured = stableSnapshot();
    const revision = epoch.current;
    exportBusy.current = true;
    setExporting(true);
    try {
      const { exportManualSplitFiles } = await import("@/lib/manual-split-model-service");
      await exportManualSplitFiles(captured, trayWorkerService, browserDownloadPort,
        () => epoch.current === revision && current.current === key);
      toast("success", "分件 STL 和参数文件已导出");
    } catch (error) {
      toast("error", error instanceof Error ? error.message : "拆件导出失败");
    } finally {
      exportBusy.current = false;
      setExporting(false);
    }
  }

  const action = <Button size="sm" variant="outline" aria-pressed={editing} aria-disabled={locked}
    title={locked ? "堆叠盒体暂不支持拆件打印" : undefined} onClick={() => {
      if (locked) return;
      if (editing) { close(); return; }
      onOpen();
      if (!settings.enabled) onChange({ ...settings, enabled: true });
      setOpen(true);
    }}>{locked ? "盒体暂不支持拆件" : "拆件打印"}</Button>;

  return {
    reset, action, editing, parts,
    preferSplit,
    isGeneratingPreview: previewRequest?.key === key,
    generatePreview: ready && (settings.cuts.length > 0 || preferSplit) ? generatePreview : undefined,
    canvas: editing ? <ManualSplitEditor snapshot={snapshot} settings={settings} onChange={onChange}
      onExit={close} onUndo={onUndo} canUndo={canUndo} blockingReason={blockingReason}
      onPreview={() => { setRequestedSplitKey(key); onOpenPreview(); void generatePreview(); }}
      onExport={() => void exportParts()} exporting={exporting} /> : null,
  };
}
