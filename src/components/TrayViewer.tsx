"use client";

import { useRef, useEffect, useCallback, useMemo, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Layers, Loader2 } from "lucide-react";
import * as THREE from "three";
import { RENDER_CONFIG } from "@/lib/config";

export interface TrayViewerSplitPart {
  index: number;
  label: string;
  toHeight: number;
  connectorCount: number;
  threeGeometry: THREE.BufferGeometry;
}

interface TrayViewerProps {
  geometry: THREE.BufferGeometry | null;
  isStale?: boolean;
  isGenerating?: boolean;
  onRegenerate?: () => void;
  splitParts?: TrayViewerSplitPart[] | null;
  isGeneratingSplitPreview?: boolean;
  onGenerateSplitPreview?: () => void;
}

const SPLIT_PART_COLORS = [
  "#c8a84e",
  "#8cb880",
  "#7fb0c8",
  "#c88f6a",
  "#b38cc8",
  "#c87f96",
];

function TrayMesh({
  geometry,
  color = RENDER_CONFIG.modelColor,
  position = [0, 0, 0],
}: {
  geometry: THREE.BufferGeometry;
  color?: string;
  position?: [number, number, number];
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  const edgesGeometry = useMemo(() => {
    return new THREE.EdgesGeometry(geometry, RENDER_CONFIG.edgeThreshold);
  }, [geometry]);

  useEffect(() => {
    if (meshRef.current && geometry) {
      meshRef.current.geometry = geometry;
    }
  }, [geometry]);

  return (
    <group rotation={[-Math.PI / 2, 0, 0]} position={position}>
      <mesh ref={meshRef} geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial
          color={color}
          metalness={0.15}
          roughness={0.75}
          side={THREE.DoubleSide}
        />
      </mesh>
      <lineSegments geometry={edgesGeometry}>
        <lineBasicMaterial color="#6a6258" transparent opacity={0.55} />
      </lineSegments>
    </group>
  );
}

function getSplitPartOffset(index: number, count: number): [number, number, number] {
  if (count <= 1) return [0, 0, 0];
  const centeredIndex = index - (count - 1) / 2;
  return [centeredIndex * 42, 0, 0];
}

/**
 * 几何体变化时自动调整摄像机距离，保证模型完整可见
 */
function CameraAutoFit({
  items,
}: {
  items: { geometry: THREE.BufferGeometry; offset?: [number, number, number] }[];
}) {
  const { camera, controls } = useThree();
  const hasFittedRef = useRef(false);

  useEffect(() => {
    if (hasFittedRef.current) return;

    const sceneBox = new THREE.Box3();
    for (const item of items) {
      if (!item.geometry.boundingBox) item.geometry.computeBoundingBox();
      const box = item.geometry.boundingBox;
      if (!box) continue;
      const offset = item.offset ?? [0, 0, 0];
      sceneBox.union(
        box.clone().translate(new THREE.Vector3(offset[0], offset[1], offset[2])),
      );
    }

    if (sceneBox.isEmpty()) return;

    const sphere = sceneBox.getBoundingSphere(new THREE.Sphere());

    const fov = (camera as THREE.PerspectiveCamera).fov;
    const fovRad = (fov * Math.PI) / 180;
    // 模型绕 X 旋转了 -90°，考虑边界球在旋转后的中心
    const center = sphere.center.clone().applyAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
    const distance = (sphere.radius / Math.sin(fovRad / 2)) * 0.8;

    // 从 45° 仰角观察
    const angle = Math.PI / 4;
    camera.position.set(
      center.x + distance * Math.cos(angle),
      center.y + distance * Math.sin(angle),
      center.z + distance * Math.cos(angle),
    );

    if (controls) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (controls as any).target.copy(center);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (controls as any).update();
    }

    hasFittedRef.current = true;
  }, [items, camera, controls]);

  return null;
}

/**
 * 监听 WebGL context lost / restored 事件，自动恢复
 */
function ContextLostHandler() {
  const { gl } = useThree();

  const handleContextLost = useCallback(
    (event: Event) => {
      event.preventDefault();
    },
    []
  );

  const handleContextRestored = useCallback(() => {
    // 恢复后无需额外操作，R3F 会自动重建渲染管线
  }, []);

  useEffect(() => {
    const canvas = gl.domElement;
    canvas.addEventListener("webglcontextlost", handleContextLost);
    canvas.addEventListener("webglcontextrestored", handleContextRestored);
    return () => {
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      canvas.removeEventListener("webglcontextrestored", handleContextRestored);
    };
  }, [gl, handleContextLost, handleContextRestored]);

  return null;
}

export default function TrayViewer({
  geometry,
  isStale,
  isGenerating,
  onRegenerate,
  splitParts,
  isGeneratingSplitPreview,
  onGenerateSplitPreview,
}: TrayViewerProps) {
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [viewerMode, setViewerMode] = useState<"solid" | "split">("solid");
  const canShowSplitPreview = Boolean(splitParts && splitParts.length > 0);
  const showSplitPreview = viewerMode === "split" && canShowSplitPreview;
  const splitFitItems = useMemo(
    () =>
      splitParts?.map((part, index) => ({
        geometry: part.threeGeometry,
        offset: getSplitPartOffset(index, splitParts.length),
      })) ?? [],
    [splitParts],
  );

  useEffect(() => {
    let frameId: number | null = null;
    let intervalId: number | null = null;

    if (isGenerating) {
      const startTime = Date.now();
      frameId = window.requestAnimationFrame(() => {
        setLoadingProgress(0);

        const updateProgress = () => {
          const elapsed = Date.now() - startTime;
          setLoadingProgress(Math.min(elapsed / 15000, 0.85));
        };

        updateProgress();
        intervalId = window.setInterval(updateProgress, 100);
      });
    } else {
      frameId = window.requestAnimationFrame(() => {
        setLoadingProgress(0);
      });
    }

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
    };
  }, [isGenerating]);

  return (
    <div
      className="relative w-full h-full min-h-[400px] overflow-hidden forged-viewport cursor-pointer"
      style={{ backgroundColor: '#3d3b38' }}
      onClick={() => {
        if (isStale && onRegenerate) {
          onRegenerate();
        }
      }}
    >
      {/* Loading bar */}
      {isGenerating && (
        <div className="absolute top-0 left-0 right-0 z-30 h-0.5 bg-[#2a2518]">
          <div
            className="h-full bg-[#c8a84e] transition-[width] duration-200 ease-out"
            style={{ width: `${loadingProgress * 100}%` }}
          />
        </div>
      )}
      {/* Corner rivets */}
      <div className="absolute top-3 left-3 rivet z-10" />
      <div className="absolute top-3 right-3 rivet z-10" />
      <div className="absolute bottom-3 left-3 rivet z-10" />
      <div className="absolute bottom-3 right-3 rivet z-10" />

      {/* Top edge trim */}
      <div className="absolute top-0 left-6 right-6 h-px gold-trim opacity-20 z-10" />
      <div className="absolute bottom-0 left-6 right-6 h-px gold-trim opacity-20 z-10" />

      {/* Viewport label */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-[#12110e] border border-[#2e2a24] pointer-events-none z-10">
        <span className="text-[9px] font-mono text-primary/40 tracking-[0.4em] uppercase">FORGE VIEW</span>
      </div>

      <div className="absolute top-3 right-5 z-20 flex items-center gap-2 rounded border border-[#2e2a24] bg-[#12110e]/95 px-2 py-1 shadow-lg shadow-black/30">
        <button
          type="button"
          onClick={() => setViewerMode("solid")}
          className={`h-7 rounded-sm px-2 text-[11px] transition-colors ${
            viewerMode === "solid"
              ? "bg-[#2a3528] text-[#a8d39a]"
              : "text-muted-foreground hover:bg-[#1c1a16] hover:text-foreground"
          }`}
        >
          整件
        </button>
        <button
          type="button"
          onClick={() => {
            setViewerMode("split");
            if (!canShowSplitPreview && !isGeneratingSplitPreview) {
              onGenerateSplitPreview?.();
            }
          }}
          disabled={!onGenerateSplitPreview && !canShowSplitPreview}
          className={`inline-flex h-7 items-center gap-1 rounded-sm px-2 text-[11px] transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            viewerMode === "split"
              ? "bg-[#2a3528] text-[#a8d39a]"
              : "text-muted-foreground hover:bg-[#1c1a16] hover:text-foreground"
          }`}
        >
          {isGeneratingSplitPreview ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Layers className="h-3 w-3" />
          )}
          拆件
        </button>
      </div>

      {showSplitPreview ? (
        <div className="absolute bottom-5 left-5 z-20 max-w-[260px] rounded border border-[#2e2a24] bg-[#12110e]/95 p-2 shadow-lg shadow-black/30">
          <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold tracking-wide text-[#f3dfb6]">
            <Layers className="h-3 w-3 text-[#c8a84e]" />
            拆件预览
          </div>
          <div className="space-y-1">
            {splitParts!.map((part, index) => (
              <div
                key={`${part.index}-${part.label}`}
                className="flex items-center gap-2 text-[10px] text-muted-foreground"
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-sm"
                  style={{
                    background:
                      SPLIT_PART_COLORS[index % SPLIT_PART_COLORS.length],
                  }}
                />
                <span className="min-w-0 flex-1 truncate">{part.label}</span>
                <span className="font-mono text-foreground/80">
                  {part.toHeight}mm
                </span>
                <span className="font-mono text-[#c8a84e]">
                  {part.connectorCount}孔
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <Canvas
        camera={{
          position: RENDER_CONFIG.camera.position as [number, number, number],
          fov: RENDER_CONFIG.camera.fov,
          near: 0.1,
          far: 2000
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
        <ContextLostHandler />

        {/* 灯光 — 调整为凹槽清晰可见 */}
        {/* 环境光适当降低，让阴影更明显 */}
        <ambientLight intensity={0.25} color="#ffeecc" />
        {/* 主光：斜上方强光，打出凹槽内部阴影 */}
        <directionalLight position={[40, 120, 60]} intensity={1.5} color="#fff8f0" castShadow />
        {/* 侧补光：左侧，增加凹槽内壁的层次感 */}
        <directionalLight position={[-60, 60, 20]} intensity={0.6} color="#ffeedd" />
        {/* 前下补光：从前下方打亮，防止整体过暗 */}
        <directionalLight position={[0, -20, 80]} intensity={0.4} color="#ffe8cc" />
        {/* 背光：让托盘背面轮廓可见 */}
        <directionalLight position={[-20, 20, -60]} intensity={0.2} color="#ccddff" />

        {/* 托盘模型 */}
        {showSplitPreview ? (
          <>
            {splitParts!.map((part, index) => (
              <TrayMesh
                key={`${part.index}-${part.label}`}
                geometry={part.threeGeometry}
                color={SPLIT_PART_COLORS[index % SPLIT_PART_COLORS.length]}
                position={getSplitPartOffset(index, splitParts!.length)}
              />
            ))}
            <CameraAutoFit
              key={`split-${splitParts!.map((part) => part.threeGeometry.uuid).join("-")}`}
              items={splitFitItems}
            />
          </>
        ) : geometry ? (
          <>
            <TrayMesh geometry={geometry} />
            <CameraAutoFit key={`solid-${geometry.uuid}`} items={[{ geometry }]} />
          </>
        ) : null}

        {/* 交互控制 */}
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.1}
          minDistance={10}
          maxDistance={300}
          maxPolarAngle={Math.PI / 1.5}
        />
      </Canvas>
    </div>
  );
}
