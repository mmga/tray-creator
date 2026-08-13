"use client";

import { useId, useRef, type KeyboardEvent, type PointerEvent } from "react";
import type { BaseConverterParams } from "@/types/custom-tray";
import {
  normalizeBaseConverterParams,
  resolveBaseConverterGeometry,
} from "@/lib/base-converter-config";
import {
  conversionProfileToSvgPath,
  sampleConversionTargetProfile,
} from "@/lib/base-converter-profile";
import {
  getRoundBaseOuterDiameterAtHeight,
  getRoundBaseTopDiameter,
  ROUND_BASE_SHELL_THICKNESS,
} from "@/lib/round-base-profile";
import {
  clampPushFitHexHoleOffset,
  createPushFitHexHoleVertices,
  createPushFitHexWallOuterVertices,
  PUSH_FIT_WALL_BOTTOM_CLEARANCE,
} from "@/lib/push-fit-hex-hole";

interface BaseConverterPreviewProps {
  params: BaseConverterParams;
  beginContinuousEdit?: () => boolean;
  previewParams?: (
    mutate: (params: BaseConverterParams) => BaseConverterParams,
  ) => void;
  commitContinuousEdit?: () => void;
  cancelContinuousEdit?: () => void;
  updateParams?: (
    mutate: (params: BaseConverterParams) => BaseConverterParams,
  ) => void;
}

interface SvgViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function clientPointToSvgPoint(
  client: { x: number; y: number },
  rect: Pick<DOMRect, "left" | "top" | "width" | "height">,
  viewBox: SvgViewBox,
) {
  const scale = Math.min(
    rect.width / viewBox.width,
    rect.height / viewBox.height,
  );
  const horizontalInset = (rect.width - viewBox.width * scale) / 2;
  const verticalInset = (rect.height - viewBox.height * scale) / 2;
  return {
    x: viewBox.x + (client.x - rect.left - horizontalInset) / scale,
    y: viewBox.y + (client.y - rect.top - verticalInset) / scale,
  };
}

function PreviewGrid() {
  return (
    <div
      className="absolute inset-0 opacity-20"
      style={{
        backgroundImage: "linear-gradient(#444 1px, transparent 1px), linear-gradient(90deg, #444 1px, transparent 1px)",
        backgroundSize: "20px 20px",
        backgroundPosition: "center",
      }}
    />
  );
}

function RoundBasePreview({
  params,
  beginContinuousEdit,
  previewParams,
  commitContinuousEdit,
  cancelContinuousEdit,
  updateParams,
}: BaseConverterPreviewProps) {
  const wallClipId = useId().replace(/:/g, "");
  const dragRef = useRef<{
    pointerId: number;
    hole: BaseConverterParams["pushFitHexHole"];
  } | null>(null);
  const profile = params.roundBaseSnapshot;
  const radius = profile.nominalDiameter / 2;
  const topRadius = getRoundBaseTopDiameter(profile) / 2;
  const margin = profile.nominalDiameter * 0.12 + 4;
  const viewBoxValues = {
    x: -radius - margin,
    y: -radius - margin,
    width: profile.nominalDiameter + margin * 2,
    height: profile.nominalDiameter + margin * 2,
  };
  const viewBox = `${viewBoxValues.x} ${viewBoxValues.y} ${viewBoxValues.width} ${viewBoxValues.height}`;
  const isPushFit = params.generationKind === "push-fit";
  const holeVertices = isPushFit
    ? createPushFitHexHoleVertices(params.pushFitHexHole)
    : [];
  const holePoints = isPushFit
    ? holeVertices
        .map(({ x, y }) => `${Number(x.toFixed(3))},${Number((-y).toFixed(3))}`)
        .join(" ")
    : null;
  const wallOuterPoints = isPushFit
    ? createPushFitHexWallOuterVertices(
        params.pushFitHexHole,
        ROUND_BASE_SHELL_THICKNESS,
      ).map(({ x, y }) => `${Number(x.toFixed(3))},${Number((-y).toFixed(3))}`)
        .join(" ")
    : null;
  const wallClipRadius = getRoundBaseOuterDiameterAtHeight(
    profile,
    PUSH_FIT_WALL_BOTTOM_CLEARANCE,
  ) / 2;
  const nearestWall = isPushFit
    ? topRadius - Math.max(...holeVertices.map(({ x, y }) => Math.hypot(x, y)))
    : null;
  const previewHole = (hole: BaseConverterParams["pushFitHexHole"]) => {
    previewParams?.((previous) => ({ ...previous, pushFitHexHole: hole }));
  };
  const handlePointerDown = (event: PointerEvent<SVGPolygonElement>) => {
    if (!isPushFit || !beginContinuousEdit?.()) return;
    event.preventDefault();
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, hole: params.pushFitHexHole };
  };
  const handlePointerMove = (event: PointerEvent<SVGPolygonElement>) => {
    const drag = dragRef.current;
    const svg = event.currentTarget.ownerSVGElement;
    if (!drag || drag.pointerId !== event.pointerId || !svg) return;
    const point = clientPointToSvgPoint(
      { x: event.clientX, y: event.clientY },
      svg.getBoundingClientRect(),
      viewBoxValues,
    );
    const next = clampPushFitHexHoleOffset(profile, drag.hole, {
      x: point.x,
      y: -point.y,
    });
    drag.hole = { ...drag.hole, offsetX: next.x, offsetY: next.y };
    previewHole(drag.hole);
  };
  const finishDrag = (event: PointerEvent<SVGPolygonElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    commitContinuousEdit?.();
  };
  const cancelDrag = () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    cancelContinuousEdit?.();
  };
  const handleKeyDown = (event: KeyboardEvent<SVGPolygonElement>) => {
    if (event.key === "Escape" && dragRef.current) {
      event.preventDefault();
      cancelDrag();
      return;
    }
    const directions: Record<string, { x: number; y: number }> = {
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
      ArrowUp: { x: 0, y: 1 },
      ArrowDown: { x: 0, y: -1 },
    };
    const direction = directions[event.key];
    if (!direction || !updateParams) return;
    event.preventDefault();
    const step = event.shiftKey ? 1 : 0.1;
    updateParams((previous) => {
      const hole = previous.pushFitHexHole;
      const next = clampPushFitHexHoleOffset(previous.roundBaseSnapshot, hole, {
        x: hole.offsetX + direction.x * step,
        y: hole.offsetY + direction.y * step,
      });
      return {
        ...previous,
        pushFitHexHole: { ...hole, offsetX: next.x, offsetY: next.y },
      };
    });
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#0d0b09]">
      <PreviewGrid />
      <svg
        viewBox={viewBox}
        className="relative z-10 h-full w-full"
        preserveAspectRatio="xMidYMid meet"
        aria-label="底盘生成 2D 图"
      >
        <defs>
          <clipPath id={wallClipId}>
            <circle r={wallClipRadius} />
          </clipPath>
        </defs>
        <circle
          data-shape="round-base-bottom"
          r={radius}
          fill="rgba(214, 168, 79, 0.28)"
          stroke="#d6a84f"
          strokeWidth={0.8}
        />
        <circle
          data-shape="round-base-top"
          r={topRadius}
          fill="none"
          stroke="#a8844d"
          strokeWidth={0.35}
          strokeDasharray="1 0.8"
        />
        {wallOuterPoints && (
          <polygon
            data-shape="push-fit-hole-wall"
            points={wallOuterPoints}
            clipPath={`url(#${wallClipId})`}
            fill="rgba(214, 168, 79, 0.16)"
            stroke="#b99055"
            strokeWidth={0.35}
            strokeDasharray="0.8 0.6"
          />
        )}
        {holePoints && (
          <polygon
            data-shape="push-fit-hole"
            points={holePoints}
            fill="rgba(14, 13, 11, 0.9)"
            stroke="#f0d8b8"
            strokeWidth={0.5}
            role="button"
            aria-label="拖动简版六边孔"
            tabIndex={0}
            className="cursor-grab outline-none focus-visible:stroke-primary active:cursor-grabbing"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={finishDrag}
            onPointerCancel={cancelDrag}
            onKeyDown={handleKeyDown}
          />
        )}
        <line x1={-radius} y1={0} x2={radius} y2={0} stroke="#8b7355" strokeWidth={0.2} strokeDasharray="1 1" />
        <line x1={0} y1={-radius} x2={0} y2={radius} stroke="#8b7355" strokeWidth={0.2} strokeDasharray="1 1" />
      </svg>
      <div className="absolute bottom-3 left-3 z-20 rounded-sm border border-[#2e2a24] bg-[#100d0a]/90 px-3 py-1.5 font-mono text-xs text-[#d8d1c5]">
        {isPushFit ? "简版底盘" : "普通底盘"} · {profile.name}
        {isPushFit && ` · 六边孔 ${params.pushFitHexHole.acrossFlats.toFixed(1)}mm`}
        {isPushFit && ` · 中心 (${params.pushFitHexHole.offsetX.toFixed(1)}, ${params.pushFitHexHole.offsetY.toFixed(1)})mm`}
        {nearestWall !== null && ` · 最近壁厚 ${nearestWall.toFixed(1)}mm`}
      </div>
    </div>
  );
}

export function BaseConverterPreview(props: BaseConverterPreviewProps) {
  const { params } = props;
  const clipId = useId().replace(/:/g, "");
  const normalizedParams = normalizeBaseConverterParams(params);
  if (normalizedParams.generationKind !== "conversion") {
    return <RoundBasePreview {...props} params={normalizedParams} />;
  }
  const { params: normalized, source, target, recess } =
    resolveBaseConverterGeometry(normalizedParams);
  const targetPath = conversionProfileToSvgPath(
    sampleConversionTargetProfile(target),
  );
  const topPath = normalized.sideBevelWidth > 0
    ? conversionProfileToSvgPath(
        sampleConversionTargetProfile(target, normalized.sideBevelWidth),
      )
    : null;
  const margin = Math.max(target.width, target.depth) * 0.12 + 4;
  const viewBox = `${-target.width / 2 - margin} ${-target.depth / 2 - margin} ${target.width + margin * 2} ${target.depth + margin * 2}`;

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#0d0b09]">
      <PreviewGrid />
      <svg
        viewBox={viewBox}
        className="relative z-10 h-full w-full"
        preserveAspectRatio="xMidYMid meet"
        aria-label="转换底盘 2D 图"
      >
        <defs>
          <clipPath id={clipId}>
            <path d={targetPath} />
          </clipPath>
        </defs>
        <path
          d={targetPath}
          fill="rgba(214, 168, 79, 0.28)"
          stroke="#d6a84f"
          strokeWidth={0.8}
        />
        {topPath && (
          <path
            d={topPath}
            fill="none"
            stroke="#a8844d"
            strokeWidth={0.35}
            strokeDasharray="1 0.8"
          />
        )}
        {source.shape === "circle" ? (
          <ellipse
            rx={recess.width / 2}
            ry={recess.depth / 2}
            clipPath={`url(#${clipId})`}
            fill="rgba(14, 13, 11, 0.86)"
            stroke="#f0d8b8"
            strokeWidth={0.5}
          />
        ) : (
          <rect
            x={-recess.width / 2}
            y={-recess.depth / 2}
            width={recess.width}
            height={recess.depth}
            rx={recess.cornerRadius}
            ry={recess.cornerRadius}
            clipPath={`url(#${clipId})`}
            fill="rgba(14, 13, 11, 0.86)"
            stroke="#f0d8b8"
            strokeWidth={0.5}
          />
        )}
        <line x1={-target.width / 2} y1={0} x2={target.width / 2} y2={0} stroke="#8b7355" strokeWidth={0.2} strokeDasharray="1 1" />
        <line x1={0} y1={-target.depth / 2} x2={0} y2={target.depth / 2} stroke="#8b7355" strokeWidth={0.2} strokeDasharray="1 1" />
      </svg>
      <div className="absolute bottom-3 left-3 z-20 rounded-sm border border-[#2e2a24] bg-[#100d0a]/90 px-3 py-1.5 font-mono text-xs text-[#d8d1c5]">
        {source.name} → {target.name} · 凹槽 {recess.width.toFixed(1)} × {recess.depth.toFixed(1)} mm
      </div>
    </div>
  );
}
