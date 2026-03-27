"use client";

import { useRef, useEffect, useCallback, useMemo, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { RENDER_CONFIG } from "@/lib/config";

interface TrayViewerProps {
  geometry: THREE.BufferGeometry | null;
  isStale?: boolean;
  isGenerating?: boolean;
  onRegenerate?: () => void;
}

function TrayMesh({ geometry }: { geometry: THREE.BufferGeometry }) {
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
    <group rotation={[-Math.PI / 2, 0, 0]}>
      <mesh ref={meshRef} geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial
          color={RENDER_CONFIG.modelColor}
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

/**
 * 几何体变化时自动调整摄像机距离，保证模型完整可见
 */
function CameraAutoFit({ geometry }: { geometry: THREE.BufferGeometry }) {
  const { camera, controls } = useThree();
  const hasFittedRef = useRef(false);

  useEffect(() => {
    if (hasFittedRef.current) return;

    if (!geometry.boundingSphere) geometry.computeBoundingSphere();
    const sphere = geometry.boundingSphere;
    if (!sphere) return;

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
  }, [geometry, camera, controls]);

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

export default function TrayViewer({ geometry, isStale, isGenerating, onRegenerate }: TrayViewerProps) {
  const [loadingStartTime, setLoadingStartTime] = useState<number | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);

  useEffect(() => {
    if (isGenerating) {
      setLoadingStartTime(Date.now());
      setLoadingProgress(0);
    } else {
      setLoadingStartTime(null);
      setLoadingProgress(0);
    }
  }, [isGenerating]);

  useEffect(() => {
    if (loadingStartTime === null) return;
    const raf = setInterval(() => {
      const elapsed = Date.now() - loadingStartTime;
      // Slow progress that never completes (real completion handled by geometry update)
      setLoadingProgress(Math.min(elapsed / 15000, 0.85));
    }, 100);
    return () => clearInterval(raf);
  }, [loadingStartTime]);

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
        {geometry && (
          <>
            <TrayMesh geometry={geometry} />
            <CameraAutoFit geometry={geometry} />
          </>
        )}

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
