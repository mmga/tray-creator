"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState, type PointerEvent } from "react";
import { Button } from "@/components/ui/button";
import { DraftNumberInput } from "@/components/ui/DraftNumberInput";
import { Input } from "@/components/ui/input";
import { useCanvasZoom } from "@/hooks/useCanvasZoom";
import { useRequestSequence } from "@/hooks/useRequestSequence";
import { VIEW_PALETTE } from "@/lib/config";
import {
  cutSplitRegion, nearestSplitBoundary, pointInSplitRing, SPLIT_EPSILON,
  splitBounds, splitDistance, splitSegmentAvoidsRing, splitSegmentClear, type SplitPoint, type SplitRing,
} from "@/lib/manual-split-geometry";
import { appendOrthogonalPoint, orthogonalFixedAxis, projectOrthogonalPoint, type SplitDirection } from "@/lib/manual-split-orthogonal";
import {
  isManualSplitBedValid, MAX_MANUAL_SPLIT_CUTS, replayManualCuts, splitPartSize, splitPrintRotation,
  type FlatTraySnapshot, type ManualSplitCut, type ManualSplitScene, type ManualSplitSettings,
} from "@/lib/manual-split-plan";
import type { ManualSplitRoute } from "@/lib/manual-split-routes";
import {
  buildEndpointSnaps, chooseSplitSnap, gridSplitGuides, nearestSlotGap, splitAxisIntersections,
  slotGapMidpoint, splitRingCenter, type SplitSnap,
} from "@/lib/manual-split-snap";
import { createModelGeometryFingerprint } from "@/lib/mode-param-snapshot";
import { trayWorkerService } from "@/lib/worker/worker-service";
import type { useStepExport } from "@/hooks/useStepExport";

interface EditorProps {
  snapshot: FlatTraySnapshot;
  settings: ManualSplitSettings;
  onChange: (settings: ManualSplitSettings) => void;
  onExit: () => void;
  onUndo: () => void;
  canUndo: boolean;
  onPreview?: () => void;
  onExport?: () => void;
  exporting?: boolean;
  stepExport?: ReturnType<typeof useStepExport>;
  blockingReason?: string | null;
}

type SceneResult = { key: string; scene: ManualSplitScene } | { key: string; error: string };
type Step = "idle" | "start" | "end" | "via" | "orthogonal";
type GuideAnchor = { point: SplitPoint; span?: ReturnType<typeof splitBounds> };
type SplitGuide = { axis: 0 | 1; value: number; from: number; to: number };

export default function ManualSplitEditor(props: EditorProps) {
  const { snapshot, settings, onExit, blockingReason } = props;
  const geometryKey = useMemo(() => createModelGeometryFingerprint(snapshot), [snapshot]);
  const key = geometryKey + "|" + settings.clearance;
  const [result, setResult] = useState<SceneResult>();
  const [retry, setRetry] = useState(0);
  const getScene = useEffectEvent(() => trayWorkerService!.prepareManualSplit(snapshot));
  useEffect(() => {
    if (blockingReason || !trayWorkerService) return;
    let current = true;
    void getScene().then(
      (scene) => { if (current) setResult({ key, scene }); },
      (error: Error) => { if (current) setResult({ key, error: error.message }); },
    );
    return () => { current = false; };
  }, [key, retry, blockingReason]);

  if (blockingReason || !trayWorkerService || result?.key !== key || "error" in result) {
    const error = blockingReason ?? (!trayWorkerService ? "后台建模不可用" : result?.key === key && "error" in result ? result.error : null);
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-[#161411] p-4">
        <p role={error ? "alert" : "status"}>{error || "正在准备拆件轮廓…"}</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onExit}>返回布局</Button>
          {error && !blockingReason && <Button size="sm" onClick={() => setRetry((value) => value + 1)}>重试</Button>}
        </div>
      </div>
    );
  }
  return <SplitEditorCanvas key={key} {...props} scene={result.scene} />;
}

function points(path: SplitRing) {
  return path.map((point) => point.join(",")).join(" ");
}

function regionPath(part: Pick<ManualSplitScene["roots"][number], "outer" | "holes">) {
  return [part.outer, ...part.holes].map((ring) => "M" + points(ring) + "Z").join(" ");
}

function printLabel(size: [number, number, number], settings: ManualSplitSettings) {
  const rotation = splitPrintRotation(size, settings);
  return size.map((number) => number.toFixed(1)).join(" × ") + " mm · " +
    (rotation === null ? "超平台" : rotation === 90 ? "旋转 90° 可打印" : "可打印");
}

function SettingInput({ value, min, max, onCommit }: { value: number; min: number; max: number; onCommit: (value: number) => void }) {
  return <Input key={value} type="number" min={min} max={max} step={0.1} defaultValue={value}
    onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
    onBlur={(event) => {
      const number = event.currentTarget.valueAsNumber;
      const next = Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : value;
      event.currentTarget.value = String(next);
      if (next !== value) onCommit(next);
    }} />;
}

function SplitEditorCanvas({ scene, snapshot, settings, onChange, onExit, onUndo, canUndo, onPreview, onExport, exporting, stepExport }: EditorProps & { scene: ManualSplitScene }) {
  const { parts, invalid } = useMemo(() => replayManualCuts(scene, settings.cuts), [scene, settings.cuts]);
  const [selected, setSelected] = useState<string>();
  const region = parts.find((part) => part.id === selected) ?? parts[0];
  const [step, setStep] = useState<Step>("idle");
  const [start, setStart] = useState<SplitPoint>();
  const [end, setEnd] = useState<SplitPoint>();
  const [via, setVia] = useState<SplitPoint>();
  const [orthogonal, setOrthogonal] = useState<{ path: SplitRing; complete: boolean }>();
  const [direction, setDirection] = useState<SplitDirection>("auto");
  const [showCenter, setShowCenter] = useState(true);
  const [guides, setGuides] = useState<SplitGuide[]>([]);
  const [guideAnchor, setGuideAnchor] = useState<GuideAnchor>();
  const [midpointPick, setMidpointPick] = useState<"first" | SplitPoint>();
  const [routes, setRoutes] = useState<ManualSplitRoute[]>([]);
  const [routeIndex, setRouteIndex] = useState(0);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");
  const [hover, setHover] = useState<SplitSnap>();
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [showProtection, setShowProtection] = useState(false);
  const [symmetry, setSymmetry] = useState<"off" | "root" | "part">("off");
  const [pendingDelete, setPendingDelete] = useState<string>();
  const [panMode, setPanMode] = useState(false);
  const [numericPoint, setNumericPoint] = useState<SplitPoint>([0, 0]);
  const [relativeToCenter, setRelativeToCenter] = useState(false);
  const [gapPick, setGapPick] = useState<"off" | "first" | number>("off");
  const panStart = useRef<{ x: number; y: number; scale: number; pan: { x: number; y: number } } | null>(null);
  const { nextSeq, isStale } = useRequestSequence();

  const allPoints = useMemo(() => scene.roots.flatMap((root) => root.outer), [scene]);
  const bounds = useMemo(() => splitBounds(allPoints), [allPoints]);
  const trayCenter = useMemo(() => splitRingCenter(allPoints), [allPoints]);
  const numericTarget: SplitPoint = relativeToCenter && orthogonal
    ? [numericPoint[0] + trayCenter[0], numericPoint[1] + trayCenter[1]] : numericPoint;
  const center = useMemo(() => splitRingCenter(symmetry === "part" ? region.outer : allPoints), [allPoints, region, symmetry]);
  const width = bounds.max[0] - bounds.min[0];
  const depth = bounds.max[1] - bounds.min[1];
  const padding = Math.max(9, Math.max(width, depth) * 0.07);
  const zoom = useCanvasZoom({ baseW: width + 2 * padding, baseH: depth + 2 * padding, trayWidth: 0, trayDepth: 0 });
  const viewBox = `${zoom.minX + (bounds.min[0] + bounds.max[0]) / 2} ${zoom.minY - (bounds.min[1] + bounds.max[1]) / 2} ${zoom.viewW} ${zoom.viewH}`;
  const endpoints = useMemo(() => buildEndpointSnaps(region.outer, center, step === "end" ? start : undefined, symmetry !== "off"),
    [region, center, step, start, symmetry]);
  const activeGuides = useMemo(() => [...guides, ...(showCenter ? ([0, 1] as const).map((axis) => ({
    axis, value: trayCenter[axis], from: bounds.min[1 - axis], to: bounds.max[1 - axis],
  })) : [])], [guides, showCenter, trayCenter, bounds]);
  const guideEndpoints = useMemo(() => orthogonal && !orthogonal.path.length
    ? activeGuides.flatMap(({ axis, value }) => splitAxisIntersections(region.outer, axis, value)
      .map((point) => ({ point, label: "参考线与边界交点" }))) : [], [activeGuides, orthogonal, region.outer]);
  const cut = routes[routeIndex];
  const orthogonalCut = useMemo(() => orthogonal?.complete
    ? cutSplitRegion(region, orthogonal.path, scene.obstacles) : null, [orthogonal, region, scene.obstacles]);
  const draftChildren = orthogonalCut?.children ?? cut?.children;
  const grooveLayers = useMemo(() => scene.grooves.map((groove, i) => {
    const belongs = draftChildren?.findIndex((child) => pointInSplitRing(groove[0], child.outer));
    return <polygon key={i} points={points(groove)}
      fill={belongs === 0 ? "#293d47" : belongs === 1 ? "#344733" : "#12100d"} fillOpacity={0.8}
      stroke={gapPick === i ? "#f1c56b" : belongs === 0 ? "#7fb0c8" : belongs === 1 ? "#8cb880" : "#8d7e6a"}
      strokeWidth={gapPick === i ? 3 : 1} vectorEffect="non-scaling-stroke" />;
  }), [scene.grooves, draftChildren, gapPick]);
  const regionGrooves = useMemo(() => scene.grooves.map((ring, i) => ({ ring, i }))
    .filter(({ ring }) => pointInSplitRing(splitRingCenter(ring), region.outer)), [scene.grooves, region.outer]);
  const protectionLayers = useMemo(() => showProtection && scene.obstacles.map((ring, i) => {
    const blocked = start && end && !pending && !routes.length &&
      (via ? !splitSegmentAvoidsRing(start, via, ring) || !splitSegmentAvoidsRing(via, end, ring) :
        !splitSegmentAvoidsRing(start, end, ring));
    return <polygon key={i} points={points(ring)} fill="#f27765" fillOpacity={blocked ? 0.28 : 0.11}
      stroke="#f27765" strokeDasharray={blocked ? undefined : "3 3"} vectorEffect="non-scaling-stroke" />;
  }), [showProtection, scene.obstacles, start, end, via, pending, routes.length]);
  const size = (part: typeof region) => splitPartSize(part, scene.height);
  const oversize = parts.some((part) => splitPrintRotation(size(part), settings) === null);
  const ready = parts.length > 1 && invalid.size === 0;

  function discard(next: Step = "idle") {
    nextSeq();
    setPending(false);
    setStep(next);
    setStart(undefined);
    setEnd(undefined);
    setVia(undefined);
    setOrthogonal(next === "orthogonal" ? { path: [], complete: false } : undefined);
    setRoutes([]);
    setHover(undefined);
    setGapPick("off");
    setMidpointPick(undefined);
    setGuideAnchor(undefined);
    setStatus("");
  }

  async function plan(a: SplitPoint, b: SplitPoint, guide?: SplitPoint) {
    const seq = nextSeq();
    const prior = cut && scene.grooves.map((ring) => pointInSplitRing(ring[0], cut.children[0].outer));
    setStart(a);
    setEnd(b);
    setVia(guide);
    setStep("idle");
    setRoutes([]);
    setHover(undefined);
    setGapPick("off");
    setPending(true);
    setStatus("");
    try {
      const options = await trayWorkerService!.planManualSplitRoute({
        region, obstacles: scene.obstacles, start: a, end: b, via: guide,
      });
      if (isStale(seq)) return;
      const preferred = prior ? options.findIndex((option) =>
        scene.grooves.every((ring, index) => pointInSplitRing(ring[0], option.children[0].outer) === prior[index])) : 0;
      setRoutes(options);
      setRouteIndex(preferred);
      if (!options.length) {
        setStatus("未找到安全切线。请换端点，或在槽间空白处添加途经点。");
        setShowProtection(true);
      } else if (preferred < 0) {
        setStatus("原绕行方向已不可用，请选择一条候选。");
      }
    } catch (error) {
      if (!isStale(seq)) setStatus(error instanceof Error ? error.message : "分割线规划失败");
    } finally {
      if (!isStale(seq)) setPending(false);
    }
  }

  function selectGapGroove(index: number) {
    if (gapPick === "first") {
      setGapPick(index);
      setStatus("");
      return;
    }
    if (typeof gapPick !== "number" || index === gapPick) return;
    const midpoint = slotGapMidpoint(scene.grooves[gapPick], scene.grooves[index]);
    if (!midpoint) {
      setStatus("这两个凹槽之间没有可用间隙，请另选第二个凹槽。");
      return;
    }
    if (orthogonal) {
      setGuideAnchor({ point: midpoint, span: splitBounds([...scene.grooves[gapPick], ...scene.grooves[index]]) });
      setGapPick("off");
      setStatus("");
      return;
    }
    selectPoint(midpoint, 0);
  }

  function editPoint(next: Step) {
    setStep(next);
    setGapPick("off");
    setHover(undefined);
    setStatus("");
  }

  function selectPoint(point: SplitPoint, boundaryRadius: number) {
    if (midpointPick) {
      if (midpointPick === "first") setMidpointPick(point);
      else {
        setGuideAnchor({ point: [(midpointPick[0] + point[0]) / 2, (midpointPick[1] + point[1]) / 2] });
        setMidpointPick(undefined);
      }
      return;
    }
    if (orthogonal) {
      if (orthogonal.complete) return;
      const last = orthogonal.path.at(-1);
      if (!last) {
        const boundary = nearestSplitBoundary(point, region.outer);
        if (boundary.distance > boundaryRadius) {
          setStatus("请选择当前零件外边界上的起点。");
          return;
        }
        setOrthogonal({ path: [boundary.point], complete: false });
      } else {
        const next = projectOrthogonalPoint(last, point, region.outer, direction, boundaryRadius);
        const path = appendOrthogonalPoint(orthogonal.path, next.point);
        if (splitDistance(last, next.point) <= SPLIT_EPSILON) {
          setStatus("请将下一点移离当前折点。");
          return;
        }
        if (path.length > 1024) {
          setStatus("切线折点已达上限。");
          return;
        }
        if (next.boundary && !cutSplitRegion(region, path, scene.obstacles)) {
          setStatus("切线未能分开零件，请检查保护区、外边界或交叉线段。");
          return;
        }
        if (!next.boundary && !splitSegmentClear(last, next.point, region, scene.obstacles)) {
          setStatus("线段经过保护区或超出零件边界。");
          return;
        }
        setOrthogonal({ path, complete: next.boundary });
      }
      setStatus("");
      setHover(undefined);
      return;
    }
    if (step === "idle") {
      if (!pending && !start) {
        const part = parts.find(({ outer, holes }) =>
          pointInSplitRing(point, outer) && !holes.some((hole) => pointInSplitRing(point, hole)));
        if (part) setSelected(part.id);
      }
      return;
    }
    if (step === "via" && start && end) {
      if (!pointInSplitRing(point, region.outer) ||
          [...scene.obstacles, ...region.holes].some((ring) => pointInSplitRing(point, ring))) {
        setStatus("途经点需要位于当前零件的安全空白内。");
        return;
      }
      void plan(start, end, point);
      return;
    }
    const location = nearestSplitBoundary(point, region.outer);
    if (location.distance > boundaryRadius) {
      setStatus("请选择当前零件外边界上的点。");
      return;
    }
    if (step === "start" && !end) {
      setStart(location.point);
      setStep("end");
      setStatus("");
    } else {
      const a = step === "start" ? location.point : start!;
      const b = step === "start" ? end! : location.point;
      if (splitDistance(a, b) < 0.01) {
        setStatus("起点和终点不能重合。");
        return;
      }
      void plan(a, b, via);
    }
    setHover(undefined);
  }

  function pointerInfo(event: PointerEvent<SVGSVGElement>) {
    const ctm = event.currentTarget.getScreenCTM();
    if (!ctm) return null;
    const cursor = new DOMPoint(event.clientX, event.clientY).matrixTransform(ctm.inverse());
    return { point: [cursor.x, -cursor.y] as SplitPoint, scale: 1 / Math.hypot(ctm.a, ctm.b) };
  }

  function snapAt(point: SplitPoint, scale: number, temporarilyDisabled: boolean) {
    if (step === "idle") return undefined;
    if (gapPick !== "off") return undefined;
    if (midpointPick) {
      if (!snapEnabled || temporarilyDisabled) return undefined;
      const candidates = [...endpoints, ...guideEndpoints,
        ...(orthogonal?.path ?? []).map((p) => ({ point: p, label: "折点" }))];
      const vertical = activeGuides.filter(({ axis, value }) => axis === 0 && Math.abs(point[0] - value) <= scale * 13);
      const horizontal = activeGuides.filter(({ axis, value }) => axis === 1 && Math.abs(point[1] - value) <= scale * 13);
      for (const x of vertical) for (const y of horizontal) {
        candidates.push({ point: [x.value, y.value], label: "参考线交点" });
      }
      return chooseSplitSnap(point, candidates, scale, hover);
    }
    if (orthogonal?.complete) return undefined;
    const last = orthogonal?.path.at(-1);
    if (last && !orthogonal?.complete) {
      const next = projectOrthogonalPoint(last, point, region.outer, direction, scale * 15);
      if (next.boundary) return { point: next.point, label: "边界终点" };
      if (snapEnabled && !temporarilyDisabled) {
        const fixed = orthogonalFixedAxis(last, point, direction);
        const free = fixed === 0 ? 1 : 0;
        const align = (value: number, label: string): SplitSnap => {
          const aligned: SplitPoint = [...next.point];
          aligned[free] = value;
          return { point: aligned, label };
        };
        const candidates = activeGuides.filter(({ axis }) => axis === free)
          .map(({ value }) => align(value, "参考线对齐"));
        candidates.push(...(orthogonal?.path ?? []).slice(0, -1).map((p) => align(p[free], "已有折点对齐")));
        const gap = nearestSlotGap(next.point, scene.grooves, scene.obstacles);
        if (gap) candidates.push(align(gap.point[free], "槽间中点对齐"));
        if (guideAnchor) candidates.push(align(guideAnchor.point[free], "参考点对齐"));
        const snap = chooseSplitSnap(next.point, candidates, scale, hover);
        if (snap && (snap.point[free] - last[free]) * (next.point[free] - last[free]) > 0) {
          const adjusted = projectOrthogonalPoint(last, snap.point, region.outer, direction, scale * 15);
          return { point: adjusted.point, label: adjusted.boundary ? "边界终点" : snap.label };
        }
      }
      return { point: next.point, label: "正交折点" };
    }
    if (step === "via") {
      const gap = snapEnabled && !temporarilyDisabled ? nearestSlotGap(point, scene.grooves, scene.obstacles) : null;
      return gap ? chooseSplitSnap(point, [gap], scale, hover) : undefined;
    }
    const snap = snapEnabled && !temporarilyDisabled
      ? chooseSplitSnap(point, [...guideEndpoints, ...endpoints.filter((item) => item.label !== "镜像参考")], scale, hover) : undefined;
    if (snap) return snap;
    const boundary = nearestSplitBoundary(point, region.outer);
    return boundary.distance < scale * 15 ? { point: boundary.point, label: "边界" } : undefined;
  }

  const gridGuide = useMemo(() => {
    if (snapshot.mode !== "grid") return [];
    return ([0, 1] as const).flatMap((axis) => gridSplitGuides(scene.obstacles, axis).flatMap((value) => {
      const intersections = splitAxisIntersections(region.outer, axis, value);
      return intersections.length === 2 ? [{ axis, value, path: intersections }] : [];
    }));
  }, [snapshot.mode, scene.obstacles, region]);

  function confirm() {
    const result = orthogonal ? orthogonalCut : cut;
    if (!result || settings.cuts.length >= MAX_MANUAL_SPLIT_CUTS || invalid.has(region.id)) return;
    const confirmed: ManualSplitCut = { target: region.id, path: result.path, ...(via ? { via } : {}) };
    onChange({ ...settings, cuts: [...settings.cuts, confirmed] });
    const larger = result.children.map((part) => splitPartSize(part, scene.height)).map(([w, d]) => w * d);
    setSelected(confirmed.target + (larger[0] >= larger[1] ? ".1" : ".2"));
    discard();
  }

  function removeBranch(target: string, redo = false) {
    onChange({ ...settings, cuts: settings.cuts.filter((cut) => cut.target !== target && !cut.target.startsWith(target + ".")) });
    setSelected(target);
    setPendingDelete(undefined);
    discard(redo ? "start" : "idle");
  }

  function changeSize(index: number, value: number) {
    const bed = [...settings.bed] as ManualSplitSettings["bed"];
    bed[index] = value;
    onChange({ ...settings, bed, bedMargin: Math.min(settings.bedMargin, Math.min(bed[0], bed[1]) / 2 - 0.05) });
  }

  function removeLastPoint() {
    if (!orthogonal?.path.length) return;
    setOrthogonal({ path: orthogonal.path.slice(0, -1), complete: false });
    setStatus("");
    setHover(undefined);
  }

  function addGuide(axis: 0 | 1) {
    const span = guideAnchor?.span ?? bounds;
    const value = (guideAnchor?.point ?? numericTarget)[axis];
    const guide = { axis, value, from: span.min[1 - axis], to: span.max[1 - axis] };
    if (!guides.some((item) => item.axis === axis && item.value === value && item.from === guide.from && item.to === guide.to)) {
      setGuides([...guides, guide]);
    }
  }

  const lastPoint = orthogonal?.path.at(-1);
  const nextSegment = orthogonal && !orthogonal.complete && !midpointPick && lastPoint && hover ? [lastPoint, hover.point] : undefined;
  const nextSegmentClear = nextSegment && splitSegmentClear(nextSegment[0], nextSegment[1], region, scene.obstacles);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#161411] pt-14 text-sm" onKeyDown={(event) => {
      if (event.key === "Escape") { event.stopPropagation(); discard(); }
      if ((event.ctrlKey || event.metaKey) && event.key === "z" && !(event.target instanceof HTMLInputElement)) {
        event.preventDefault(); event.stopPropagation();
        if (orthogonal) removeLastPoint();
        else { discard(); onUndo(); }
      }
    }}>
      <div className="flex flex-wrap items-center gap-2 border-y border-[#383127] px-3 py-2">
        <Button size="sm" onClick={() => discard("start")} disabled={settings.cuts.length >= MAX_MANUAL_SPLIT_CUTS || invalid.has(region.id)}>添加分割线</Button>
        <Button size="sm" variant="outline" onClick={() => discard("orthogonal")} disabled={settings.cuts.length >= MAX_MANUAL_SPLIT_CUTS || invalid.has(region.id)}>正交折线</Button>
        <Button size="sm" variant="ghost" disabled={!canUndo} onClick={() => { discard(); onUndo(); }}>撤销</Button>
        <Button size="sm" variant="ghost" aria-pressed={showProtection} onClick={() => setShowProtection(!showProtection)}>保护区</Button>
        <Button size="sm" variant="ghost" onClick={onExit}>返回布局</Button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="relative min-h-44 flex-1 overflow-hidden bg-[#1c1a16]">
          <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex justify-between gap-2 text-xs">
            <p className="rounded bg-[#12100d]/90 px-2 py-1" role="status">
              {midpointPick ? (midpointPick === "first" ? "选择第一个参考点" : "选择第二个参考点")
                : pending ? "正在计算候选…" : gapPick === "first" ? "选择第一个凹槽" : typeof gapPick === "number" ? "选择第二个凹槽" : orthogonal ? (orthogonal.complete ? "检查折线并确认" : lastPoint ? "选择内部折点或边界终点" : "选择边界起点") : step === "start" ? "选择边界起点" : step === "end" ? "选择边界终点" : step === "via" ? "选择空白处的途经点" : cut ? "查看候选并确认" : "选择零件或添加分割线"}
            </p>
          </div>
          <svg tabIndex={0} aria-label="托盘拆件画布" viewBox={viewBox}
            className={`h-full min-h-44 w-full touch-none outline-offset-[-3px] ${panMode ? "cursor-grab" : "cursor-crosshair"}`}
            onWheel={zoom.handleWheel} onTouchStart={zoom.handleTouchStart}
            onTouchMove={zoom.handleTouchMove} onTouchEnd={zoom.handleTouchEnd}
            onPointerLeave={() => setHover(undefined)}
            onPointerDown={(event) => {
              const info = pointerInfo(event);
              if (!info || !event.isPrimary || (event.button !== 0 && event.button !== 1)) return;
              if (panMode || event.button === 1) {
                event.preventDefault();
                event.currentTarget.setPointerCapture(event.pointerId);
                panStart.current = { x: event.clientX, y: event.clientY, scale: info.scale, pan: zoom.pan };
              }
            }}
            onPointerMove={(event) => {
              const info = pointerInfo(event);
              if (!info || !event.isPrimary) return;
              const pan = panStart.current;
              if (pan) {
                zoom.setPan({ x: pan.pan.x + (event.clientX - pan.x) * pan.scale, y: pan.pan.y + (event.clientY - pan.y) * pan.scale });
                return;
              }
              if (!panMode) setHover(snapAt(info.point, info.scale, event.altKey));
            }}
            onPointerCancel={() => { panStart.current = null; }}
            onPointerUp={(event) => {
              if (panStart.current) { panStart.current = null; return; }
              if (event.button !== 0 || !event.isPrimary || panMode) return;
              const info = pointerInfo(event);
              if (!info) return;
              if (gapPick !== "off") {
                const groove = regionGrooves.find(({ ring }) => pointInSplitRing(info.point, ring));
                if (groove) selectGapGroove(groove.i);
                return;
              }
              const snap = snapAt(info.point, info.scale, event.altKey);
              selectPoint(snap?.point ?? info.point, info.scale * 15);
            }}>
            <g transform="scale(1,-1)">
              {parts.map((part, i) => <path key={part.id} d={regionPath(part)} fillRule="evenodd"
                fill={VIEW_PALETTE[i % VIEW_PALETTE.length]} fillOpacity={region.id === part.id ? 0.23 : 0.09}
                stroke={region.id === part.id ? "#e1b85f" : "#746659"} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />)}
              {draftChildren?.map((part, i) => <path key={i} d={regionPath(part)}
                fill={i === 0 ? "#7fb0c8" : "#8cb880"} fillRule="evenodd" fillOpacity={0.32} />)}
              {grooveLayers}
              {protectionLayers}
              {orthogonal && activeGuides.map(({ axis, value, from, to }, i) => <polyline key={i}
                points={points(axis === 0 ? [[value, from], [value, to]] : [[from, value], [to, value]])}
                fill="none" stroke="#8ab8c9" strokeDasharray="4 5" opacity={0.7} vectorEffect="non-scaling-stroke" />)}
              {orthogonal && guideAnchor && <circle cx={guideAnchor.point[0]} cy={guideAnchor.point[1]} r={zoom.viewW * 0.007}
                fill="#f1c56b" vectorEffect="non-scaling-stroke"><title>参考中点</title></circle>}
              {symmetry !== "off" && ([0, 1] as const).map((axis) => <polyline key={axis}
                points={points(axis === 0 ? [[center[0], bounds.min[1]], [center[0], bounds.max[1]]] : [[bounds.min[0], center[1]], [bounds.max[0], center[1]]])}
                fill="none" stroke="#8ab8c9" strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />)}
              {symmetry !== "off" && endpoints.filter(({ label }) => label.includes("对称") || label === "镜像参考")
                .map(({ point, label }, i) => <circle key={i} cx={point[0]} cy={point[1]} r={zoom.viewW * 0.009}
                  fill={label === "镜像参考" ? "none" : "#86cdd9"} stroke="#86cdd9" vectorEffect="non-scaling-stroke"><title>{label}</title></circle>)}
              {settings.cuts.map(({ target, path }) => <polyline key={target} points={points(path)} fill="none"
                stroke={invalid.has(target) ? "#f27765" : "#f1c56b"} strokeWidth={2} vectorEffect="non-scaling-stroke" />)}
              {routes.map(({ path }, i) => <polyline key={i} points={points(path)} fill="none"
                stroke={i === routeIndex ? "#a7e8eb" : "#77a2a8"} strokeWidth={i === routeIndex ? 3 : 1.5}
                strokeDasharray={i === routeIndex ? undefined : "5 4"} vectorEffect="non-scaling-stroke" />)}
              {orthogonal && <polyline points={points(orthogonal.path)} fill="none" stroke="#a7e8eb"
                strokeWidth={3} vectorEffect="non-scaling-stroke" />}
              {nextSegment && <polyline points={points(nextSegment)} fill="none"
                stroke={nextSegmentClear ? "#a7e8eb" : "#f27765"} strokeWidth={2} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />}
              {orthogonal?.path.map(([x, y], i) => <circle key={i} cx={x} cy={y}
                r={zoom.viewW * 0.006} fill="#a7e8eb" vectorEffect="non-scaling-stroke" />)}
              {[start, end, via, hover?.point].map((point, i) => point && <circle key={i} cx={point[0]} cy={point[1]}
                r={zoom.viewW * 0.008} fill={i === 3 ? "#fcf2d5" : "#a7e8eb"} stroke="#18120a" vectorEffect="non-scaling-stroke" />)}
            </g>
          </svg>
          <div className="absolute inset-x-3 bottom-2 flex items-end justify-between gap-2">
            <div className="rounded bg-[#12100d]/90 px-2 py-1 text-xs text-[#e0d2bb]">
              {hover ? `${hover.label} · X ${hover.point[0].toFixed(2)} / Y ${hover.point[1].toFixed(2)}` : "坐标原点位于托盘中心 · mm"}
            </div>
            <div className="flex rounded bg-[#12100d]/90">
              <Button size="sm" variant="ghost" aria-pressed={panMode} onClick={() => setPanMode(!panMode)}>平移</Button>
              <Button size="sm" variant="ghost" aria-label="放大" onClick={() => zoom.adjustZoom(0.25)}>＋</Button>
              <Button size="sm" variant="ghost" aria-label="缩小" onClick={() => zoom.adjustZoom(-0.25)}>－</Button>
              <Button size="sm" variant="ghost" onClick={zoom.resetZoom}>适配</Button>
            </div>
          </div>
        </div>
        <aside className="max-h-[46%] shrink-0 space-y-3 overflow-auto border-t border-[#383127] bg-[#211d17] p-3 md:max-h-none md:w-72 md:border-l md:border-t-0">
          <div className="space-y-2">
            {orthogonal && <div className="flex flex-wrap items-center gap-1">
              <label>下一段 <select value={direction} onChange={(event) => { setDirection(event.target.value as SplitDirection); setHover(undefined); }}>
                <option value="auto">自动判断</option><option value="horizontal">水平</option><option value="vertical">垂直</option>
              </select></label>
              <Button size="sm" variant="ghost" disabled={!lastPoint} onClick={removeLastPoint}>撤回上一点</Button>
              <Button size="sm" variant="ghost" onClick={() => discard()}>取消折线</Button>
            </div>}
            {orthogonal && <details open className="space-y-1 text-xs">
              <summary className="cursor-pointer">折线辅助</summary>
              <label className="flex items-center gap-2"><input type="checkbox" checked={showCenter}
                onChange={(event) => setShowCenter(event.target.checked)} />托盘中心线</label>
              <div className="flex flex-wrap items-center gap-1">
                <Button size="sm" variant="ghost" aria-pressed={Boolean(midpointPick)}
                  onClick={() => { setGapPick("off"); setMidpointPick(midpointPick ? undefined : "first"); }}>两点中点</Button>
                {guideAnchor && <button type="button" className="underline" onClick={() => setGuideAnchor(undefined)}>
                  清除参考点 {guideAnchor.point.map((value) => value.toFixed(2)).join(", ")}
                </button>}
                <Button size="sm" variant="ghost" onClick={() => addGuide(1)}>加横向参考线</Button>
                <Button size="sm" variant="ghost" onClick={() => addGuide(0)}>加竖向参考线</Button>
                {guides.length > 0 && <Button size="sm" variant="ghost" onClick={() => setGuides(guides.slice(0, -1))}>移除上一条参考线</Button>}
              </div>
              <p className="text-muted-foreground">参考线取中点或下方输入的坐标。实际间隙以保护区校验为准。</p>
            </details>}
            <label className="flex items-center gap-2"><input type="checkbox" checked={snapEnabled} onChange={(event) => setSnapEnabled(event.target.checked)} />捕捉辅助点</label>
            <label className="flex items-center justify-between gap-2">对称参考
              <select className="rounded bg-[#171410] px-1.5 py-1" value={symmetry} onChange={(event) => setSymmetry(event.target.value as typeof symmetry)}>
                <option value="off">关闭</option><option value="root">托盘中心轴</option><option value="part">零件中心轴</option>
              </select>
            </label>
            {snapEnabled && (step === "start" || step === "end" || (orthogonal && !lastPoint)) && <label className="flex items-center justify-between gap-2 text-xs">
              几何辅助点
              <select className="max-w-40 rounded bg-[#171410] py-1" value="" onChange={(event) => {
                const snap = [...endpoints, ...guideEndpoints][Number(event.target.value)];
                if (snap) selectPoint(snap.point, 0.001);
              }}>
                <option value="" disabled>中点、对齐或对称</option>
                {[...endpoints, ...guideEndpoints].map(({ point, label }, i) => label !== "镜像参考" && <option value={i} key={i}>
                  {label} · {point.map((coordinate) => coordinate.toFixed(2)).join(", ")}
                </option>)}
              </select>
            </label>}
            {(step === "via" || orthogonal) && regionGrooves.length >= 2 && <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" aria-pressed={gapPick !== "off"}
                onClick={() => { setMidpointPick(undefined); setGapPick(gapPick === "off" ? "first" : "off"); }}>两槽中点</Button>
              {gapPick !== "off" && <select aria-label={gapPick === "first" ? "第一个凹槽" : "第二个凹槽"}
                className="min-w-0 rounded bg-[#171410] py-1 text-xs" value="" onChange={(event) => selectGapGroove(Number(event.target.value))}>
                <option value="" disabled>选择凹槽</option>
                {regionGrooves.filter(({ i }) => gapPick !== i).map(({ ring, i }) => <option value={i} key={i}>
                  槽 {i + 1} · {splitRingCenter(ring).map((value) => value.toFixed(1)).join(", ")}
                </option>)}
              </select>}
            </div>}
            {step !== "idle" && <details className="text-xs">
              <summary className="cursor-pointer">按坐标选点</summary>
              {orthogonal && <label className="mt-2 flex items-center gap-2"><input type="checkbox" checked={relativeToCenter}
                onChange={(event) => setRelativeToCenter(event.target.checked)} />相对托盘中心</label>}
              <div className="mt-2 flex items-end gap-1">
                {(["X", "Y"] as const).map((axis, i) => <label key={axis} className="min-w-0 flex-1">{axis}<DraftNumberInput value={numericPoint[i]} step={0.01}
                  onValueChange={(value) => setNumericPoint(i === 0 ? [value, numericPoint[1]] : [numericPoint[0], value])} /></label>)}
                <Button size="sm" variant="outline" disabled={orthogonal?.complete && !midpointPick}
                  onClick={() => selectPoint(numericTarget, 0.03)}>取点</Button>
              </div>
            </details>}
            {gridGuide.length > 0 && !orthogonal && !start && !pending && <label className="flex items-center justify-between gap-2">网格分割
              <select aria-label="选择网格安全通道" className="max-w-40 rounded bg-[#171410] py-1" value="" onChange={(event) => {
                const guide = gridGuide[Number(event.target.value)];
                if (guide) void plan(guide.path[0], guide.path[1]);
              }}><option value="" disabled>选择行间或列间</option>
                {gridGuide.map(({ axis, value }, index) => <option key={index} value={index}>{axis === 0 ? "列间 X" : "行间 Y"} {value.toFixed(2)}</option>)}
              </select>
            </label>}
          </div>
          {status && <p role="alert" className="text-xs text-[#ffc090]">{status}</p>}
          {orthogonal?.complete && <div className="space-y-1 text-xs">
            {orthogonalCut?.children.map((part, i) => <p key={i}>预览零件 {i + 1} · {printLabel(splitPartSize(part, scene.height), settings)}</p>)}
            <Button size="sm" className="w-full" disabled={!orthogonalCut} onClick={confirm}>确认分割</Button>
          </div>}
          {start && end && !pending && <div className="flex flex-wrap gap-1">
            <Button size="sm" variant="outline" onClick={() => editPoint("start")}>改起点</Button>
            <Button size="sm" variant="outline" onClick={() => editPoint("end")}>改终点</Button>
            <Button size="sm" variant="outline" onClick={() => editPoint("via")}>{via ? "改途经点" : "加途经点"}</Button>
            {via && <Button size="sm" variant="ghost" onClick={() => void plan(start, end)}>清除途经点</Button>}
            <Button size="sm" variant="ghost" onClick={() => discard()}>取消</Button>
          </div>}
          {routes.length > 0 && <div className="space-y-2">
            {routes.map((route, i) => <button type="button" aria-pressed={i === routeIndex}
              key={i} className="w-full rounded border border-[#504635] px-2 py-1.5 text-left text-xs aria-pressed:border-[#a7e8eb] aria-pressed:bg-[#293637]" onClick={() => setRouteIndex(i)}>
              <span className="font-medium">候选 {i + 1} · 切线 {route.length.toFixed(1)} mm</span>
              {route.children.map((part, index) => <span key={index} className="block">
                {index === 0 ? "蓝区" : "绿区"}：{printLabel(splitPartSize(part, scene.height), settings)}
              </span>)}
              {route.narrowWeb && <span className="block text-[#ffc090]">接缝附近有薄边，请检查打印强度</span>}
            </button>)}
            <Button size="sm" className="w-full" onClick={confirm} disabled={!cut || step !== "idle"}>确认分割</Button>
          </div>}
          <div className="space-y-1 border-t border-[#383127] pt-2">
            <p className="text-xs text-muted-foreground">零件 {parts.length} 件</p>
            {scene.height > settings.bed[2] && <p className="text-xs text-[#ffc090]">托盘高度超过平台限制，平面拆分不会降低高度。</p>}
            {parts.map((part) => <button type="button" key={part.id} aria-pressed={part.id === region.id}
              className="block w-full rounded px-2 py-1 text-left text-xs aria-pressed:bg-[#3b3223]"
              onClick={() => { discard(); setSelected(part.id); }}>零件 {part.id} · {printLabel(size(part), settings)}</button>)}
            {settings.cuts.map(({ target }) => <div key={target} className="flex items-center justify-between text-xs">
              <span className={invalid.has(target) ? "text-[#ff9c87]" : "text-muted-foreground"}>
                切线 {target}{invalid.has(target) ? invalid.get(target) === "dependency" ? " · 待复核" : " · 已失效" : ""}
              </span>
              <Button size="sm" variant="ghost" onClick={() => setPendingDelete(target)}
                aria-label={`${invalid.get(target) === "boundary" ? "重做或移除" : "移除"}切线 ${target}`}>
                {invalid.get(target) === "boundary" ? "重做／移除" : "移除"}
              </Button>
            </div>)}
            {pendingDelete && <div className="rounded border border-[#9d7050] p-2 text-xs" role="alert">
              <p>移除切线 {pendingDelete} 将同时移除 {settings.cuts.filter((item) => item.target.startsWith(pendingDelete + ".")).length} 条后续切线。</p>
              <Button size="sm" variant="ghost" onClick={() => setPendingDelete(undefined)}>取消</Button>
              {invalid.get(pendingDelete) === "boundary" && <Button size="sm" variant="outline" onClick={() => removeBranch(pendingDelete, true)}>移除并重做</Button>}
              <Button size="sm" variant="destructive" onClick={() => removeBranch(pendingDelete)}>确认移除</Button>
            </div>}
          </div>
          {(onPreview || onExport) && <div className="flex flex-wrap gap-2">
            {onPreview && <Button size="sm" variant="outline" disabled={!ready} onClick={onPreview}>三维分件预览</Button>}
            {onExport && <Button size="sm" disabled={!ready || oversize || exporting || !isManualSplitBedValid(settings)} onClick={onExport}>
              {exporting ? "正在导出…" : "导出分件 STL"}
            </Button>}
            {stepExport && <Button size="sm" variant="outline" disabled={!ready || oversize || Boolean(stepExport.phase || stepExport.reason) || !isManualSplitBedValid(settings)}
              onClick={() => void stepExport.run()}>导出分件 STEP</Button>}
          </div>}
          {stepExport?.reason || stepExport?.sampled ? <p className="text-xs text-muted-foreground">{stepExport.reason ?? "包含分段轮廓，部分侧壁由平面组成"}</p> : null}
          {stepExport?.phase ? <div className="flex items-center gap-2 text-xs">
            <span role="status">STEP · {stepExport.phase}</span>
            <Button size="sm" variant="ghost" onClick={stepExport.cancel}>取消 STEP 导出</Button>
          </div> : null}
          <details className="border-t border-[#383127] pt-2 text-xs" open>
            <summary className="cursor-pointer">打印设置（mm）</summary>
            <div className="mt-2 grid grid-cols-3 gap-1">
              {["平台宽", "平台深", "平台高"].map((label, index) => <label key={label}>{label}
                <SettingInput value={settings.bed[index]} min={1} max={2000} onCommit={(value) => changeSize(index, value)} />
              </label>)}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label>平台预留<SettingInput value={settings.bedMargin} min={0}
                max={Math.min(settings.bed[0], settings.bed[1]) / 2 - 0.05} onCommit={(bedMargin) => onChange({ ...settings, bedMargin })} /></label>
              <label>凹槽保留<SettingInput value={settings.clearance} min={0} max={50}
                onCommit={(clearance) => onChange({ ...settings, clearance })} /></label>
            </div>
            <Button size="sm" variant="ghost" className="mt-1" onClick={() => { onChange({ ...settings, enabled: false }); onExit(); }}>停用拆件</Button>
          </details>
        </aside>
      </div>
    </div>
  );
}
