"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Boxes, Layers, Loader2 } from "lucide-react";
import * as THREE from "three";
import { RENDER_CONFIG } from "@/lib/config";
import type { StorageSteppedViewPart } from "@/hooks/useStorageStepped";

const MODEL_ROTATION = new THREE.Euler(-Math.PI / 2, 0, 0);
const MODEL_ROTATION_MATRIX = new THREE.Matrix4().makeRotationFromEuler(
  MODEL_ROTATION,
);
const LIFT_HEIGHT = 40;

interface StorageSteppedViewerProps {
  parts: StorageSteppedViewPart[];
  viewMode: "assembly" | "single";
  onViewModeChange: (mode: "assembly" | "single") => void;
  selectedPartId: string;
  onSelectPart: (partId: string) => void;
  liftedStepIndex: number | null;
  onLiftChange: (stepIndex: number | null) => void;
  isStale: boolean;
  isGenerating: boolean;
  onGenerate: () => void;
  missingPartLabels: string[];
}

/** 模型坐标 (X,Y,Z) 平移对应的 Three 世界位移（几何体先绕 X 轴 -90°）。 */
function modelOffsetToWorld(
  offset: [number, number, number],
  lift: number,
): [number, number, number] {
  return [offset[0], offset[2] + lift, -offset[1]];
}

function PartMesh({
  geometry,
  color,
  position,
}: {
  geometry: THREE.BufferGeometry;
  color: string;
  position: [number, number, number];
}) {
  const edgesGeometry = useMemo(
    () => new THREE.EdgesGeometry(geometry, RENDER_CONFIG.edgeThreshold),
    [geometry],
  );
  useEffect(() => () => edgesGeometry.dispose(), [edgesGeometry]);

  return (
    <group rotation={MODEL_ROTATION} position={position}>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial
          color={color}
          metalness={0.15}
          roughness={0.75}
          side={THREE.DoubleSide}
        />
      </mesh>
      <lineSegments geometry={edgesGeometry}>
        <lineBasicMaterial color="#3a342b" transparent opacity={0.75} />
      </lineSegments>
    </group>
  );
}

function CameraAutoFit({
  items,
}: {
  items: { geometry: THREE.BufferGeometry; position: [number, number, number] }[];
}) {
  const { camera, controls } = useThree();
  const fittedRef = useRef(false);

  useEffect(() => {
    if (fittedRef.current) return;
    const sceneBox = new THREE.Box3();
    for (const item of items) {
      if (!item.geometry.boundingBox) item.geometry.computeBoundingBox();
      const box = item.geometry.boundingBox;
      if (!box) continue;
      sceneBox.union(
        box
          .clone()
          .applyMatrix4(MODEL_ROTATION_MATRIX)
          .translate(new THREE.Vector3(...item.position)),
      );
    }
    if (sceneBox.isEmpty()) return;
    const sphere = sceneBox.getBoundingSphere(new THREE.Sphere());
    const fov = (camera as THREE.PerspectiveCamera).fov;
    const distance = (sphere.radius / Math.sin((fov * Math.PI) / 360)) * 0.85;
    const angle = Math.PI / 4;
    camera.position.set(
      sphere.center.x + distance * Math.cos(angle),
      sphere.center.y + distance * Math.sin(angle),
      sphere.center.z + distance * Math.cos(angle),
    );
    if (controls) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const orbit = controls as any;
      orbit.target.copy(sphere.center);
      orbit.update();
    }
    fittedRef.current = true;
  }, [items, camera, controls]);

  return null;
}

export default function StorageSteppedViewer({
  parts,
  viewMode,
  onViewModeChange,
  selectedPartId,
  onSelectPart,
  liftedStepIndex,
  onLiftChange,
  isStale,
  isGenerating,
  onGenerate,
  missingPartLabels,
}: StorageSteppedViewerProps) {
  const selectedPart = parts.find((part) => part.partId === selectedPartId);
  const selectedTrayStep = selectedPart?.kind === "tray"
    ? selectedPart.stepIndex
    : null;
  const canLift = viewMode === "assembly" && selectedTrayStep !== null;
  const selectedTrayLifted =
    selectedTrayStep !== null && liftedStepIndex === selectedTrayStep;

  const visibleParts = useMemo(() => {
    if (viewMode === "single") {
      return selectedPart ? [selectedPart] : [];
    }
    return parts;
  }, [parts, selectedPart, viewMode]);

  const fitItems = useMemo(
    () =>
      visibleParts.map((part) => {
        if (viewMode === "single") {
          return {
            geometry: part.threeGeometry,
            position: [0, 0, 0] as [number, number, number],
          };
        }
        const lift =
          liftedStepIndex !== null && part.stepIndex === liftedStepIndex
            ? LIFT_HEIGHT
            : 0;
        return {
          geometry: part.threeGeometry,
          position: modelOffsetToWorld(part.assemblyOffset, lift),
        };
      }),
    [liftedStepIndex, viewMode, visibleParts],
  );

  const fitKey = useMemo(
    () =>
      `${viewMode}-${visibleParts
        .map((part) => `${part.partId}:${part.threeGeometry.uuid}`)
        .join("-")}-${liftedStepIndex ?? "none"}`,
    [liftedStepIndex, viewMode, visibleParts],
  );

  const noParts = visibleParts.length === 0;
  const selectedBlocking = selectedPart?.blockingReason ?? null;

  const renderPartList = useCallback(
    (part: StorageSteppedViewPart) => {
      const active = part.partId === selectedPartId;
      return (
        <button
          key={part.partId}
          type="button"
          onClick={() => onSelectPart(part.partId)}
          aria-pressed={active}
          className={`flex w-full items-center gap-2 rounded-sm px-1.5 py-1 text-left text-[10px] transition-colors ${
            active
              ? "bg-[#2a3528] text-[#d8e6cf]"
              : "text-muted-foreground hover:bg-[#1c1a16] hover:text-foreground"
          }`}
        >
          <span
            aria-hidden="true"
            className="h-2 w-2 shrink-0 rounded-sm"
            style={{ background: part.color }}
          />
          <span className="min-w-0 flex-1 truncate">{part.label}</span>
          {part.stale ? (
            <span className="text-[9px] text-[#d7b95d]">待更新</span>
          ) : part.blockingReason ? (
            <span className="text-[9px] text-[#d06464]">冲突</span>
          ) : null}
          <span className="font-mono text-foreground/70">
            {(part.volume / 1000).toFixed(1)}cm³
          </span>
        </button>
      );
    },
    [onSelectPart, selectedPartId],
  );

  return (
    <div
      className="relative h-full min-h-0 w-full overflow-hidden forged-viewport"
      style={{ backgroundColor: "#3d3b38" }}
    >
      {isGenerating ? (
        <div
          role="progressbar"
          aria-label="正在生成收纳阶梯模型"
          className="absolute inset-x-0 top-0 z-30 h-0.5 bg-[#2a2518]"
        >
          <div className="h-full w-1/2 animate-pulse bg-[#c8a84e]" />
        </div>
      ) : null}

      <div className="absolute top-3 right-4 z-20 flex items-center gap-1.5 rounded border border-[#2e2a24] bg-[#12110e]/95 px-2 py-1 shadow-lg shadow-black/30">
        <button
          type="button"
          aria-pressed={viewMode === "assembly"}
          onClick={() => onViewModeChange("assembly")}
          className={`inline-flex h-7 items-center gap-1 rounded-sm px-2 text-[11px] transition-colors ${
            viewMode === "assembly"
              ? "bg-[#2a3528] text-[#a8d39a]"
              : "text-muted-foreground hover:bg-[#1c1a16] hover:text-foreground"
          }`}
        >
          <Layers aria-hidden="true" className="h-3 w-3" />
          装配
        </button>
        <button
          type="button"
          aria-pressed={viewMode === "single"}
          onClick={() => onViewModeChange("single")}
          className={`inline-flex h-7 items-center gap-1 rounded-sm px-2 text-[11px] transition-colors ${
            viewMode === "single"
              ? "bg-[#2a3528] text-[#a8d39a]"
              : "text-muted-foreground hover:bg-[#1c1a16] hover:text-foreground"
          }`}
        >
          <Boxes aria-hidden="true" className="h-3 w-3" />
          单件
        </button>
        {canLift ? (
          <button
            type="button"
            onClick={() =>
              onLiftChange(selectedTrayLifted ? null : selectedTrayStep)
            }
            aria-pressed={selectedTrayLifted}
            className={`h-7 rounded-sm px-2 text-[11px] transition-colors ${
              selectedTrayLifted
                ? "bg-[#3a3320] text-[#e3c774]"
                : "text-muted-foreground hover:bg-[#1c1a16] hover:text-foreground"
            }`}
          >
            {selectedTrayLifted ? "放下托盘" : "提起托盘"}
          </button>
        ) : null}
      </div>

      <div className="absolute left-1/2 top-3 z-10 -translate-x-1/2 border border-[#2e2a24] bg-[#12110e] px-3 py-0.5 pointer-events-none">
        <span className="font-mono text-[9px] uppercase tracking-[0.4em] text-primary/40">
          STORAGE STEP
        </span>
      </div>

      {isStale && !isGenerating ? (
        <div className="pointer-events-none absolute inset-x-0 top-14 z-20 flex justify-center px-4">
          <button
            type="button"
            onClick={onGenerate}
            className="pointer-events-auto rounded-sm border border-[#8d7432] bg-[#1b1710]/95 px-3 py-2 text-xs font-semibold text-[#e8d7a8] shadow-lg shadow-black/30 transition-colors hover:bg-[#2a2115] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8a84e]"
          >
            预览待更新，重新锻造
          </button>
        </div>
      ) : null}

      {selectedBlocking ? (
        <div
          role="status"
          className="absolute inset-x-4 bottom-3 z-20 rounded-sm border border-[#633737] bg-[#281717]/95 px-3 py-1.5 text-[11px] text-[#e0a0a0]"
        >
          当前零件不可导出：{selectedBlocking}
        </div>
      ) : null}

      <div className="absolute bottom-5 left-5 z-20 max-h-[45%] w-[230px] overflow-auto rounded border border-[#2e2a24] bg-[#12110e]/95 p-2 shadow-lg shadow-black/30">
        <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold tracking-wide text-[#f3dfb6]">
          <Layers className="h-3 w-3 text-[#c8a84e]" />
          {viewMode === "assembly" ? "装配视图" : "单件打印视图"}
        </div>
        {parts.length > 0 ? (
          <div className="space-y-0.5">{parts.map(renderPartList)}</div>
        ) : (
          <p className="px-1 py-2 text-[10px] leading-4 text-muted-foreground">
            还没有生成零件。点击「开始锻造」后查看主体与托盘。
          </p>
        )}
        {missingPartLabels.length > 0 ? (
          <p className="mt-1 border-t border-[#2e2a24] pt-1 text-[9px] text-[#d7b95d]">
            待生成：{missingPartLabels.join("、")}
          </p>
        ) : null}
        {isGenerating ? (
          <div className="mt-1 flex items-center gap-1.5 text-[9px] text-[#c8a84e]">
            <Loader2 aria-hidden="true" className="h-3 w-3 animate-spin" />
            正在生成……
          </div>
        ) : null}
      </div>

      <Canvas
        camera={{
          position: RENDER_CONFIG.camera.position as [number, number, number],
          fov: RENDER_CONFIG.camera.fov,
          near: 0.1,
          far: 3000,
        }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "default",
          failIfMajorPerformanceCaveat: false,
        }}
        onCreated={({ gl }) => {
          gl.setClearColor(new THREE.Color("#3d3b38"));
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.2;
        }}
      >
        <ambientLight intensity={0.28} color="#ffeecc" />
        <directionalLight position={[40, 120, 60]} intensity={1.5} color="#fff8f0" castShadow />
        <directionalLight position={[-60, 60, 20]} intensity={0.6} color="#ffeedd" />
        <directionalLight position={[0, -20, 80]} intensity={0.35} color="#ffe8cc" />
        <directionalLight position={[-20, 20, -60]} intensity={0.2} color="#ccddff" />

        {visibleParts.length > 0 ? (
          <>
            {visibleParts.map((part, index) => (
              <PartMesh
                key={part.partId}
                geometry={part.threeGeometry}
                color={part.color}
                position={fitItems[index].position}
              />
            ))}
            <CameraAutoFit key={fitKey} items={fitItems} />
          </>
        ) : null}

        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.1}
          mouseButtons={{
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.PAN,
            RIGHT: THREE.MOUSE.PAN,
          }}
          minDistance={10}
          maxDistance={1200}
          maxPolarAngle={Math.PI / 1.5}
        />
      </Canvas>

      {noParts && !isGenerating ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div className="rounded border border-[#2e2a24] bg-[#12110e]/90 px-4 py-3 text-center">
            <p className="text-xs text-muted-foreground">
              调整主体高度或托盘布局后开始锻造
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
