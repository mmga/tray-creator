"use client";

import { useRef, useEffect, useCallback, useMemo } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { RENDER_CONFIG } from "@/lib/config";

interface TrayViewerProps {
  geometry: THREE.BufferGeometry | null;
}

function TrayMesh({ geometry }: { geometry: THREE.BufferGeometry }) {
  const meshRef = useRef<THREE.Mesh>(null);

  // 从几何体提取硬边缘线
  const edgesGeometry = useMemo(() => {
    return new THREE.EdgesGeometry(geometry, RENDER_CONFIG.edgeThreshold);
  }, [geometry]);

  useEffect(() => {
    if (meshRef.current && geometry) {
      meshRef.current.geometry = geometry;
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
    }
  }, [geometry]);

  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      {/* 实体模型 */}
      <mesh
        ref={meshRef}
        geometry={geometry}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color={RENDER_CONFIG.modelColor}
          metalness={RENDER_CONFIG.modelMetalness}
          roughness={RENDER_CONFIG.modelRoughness}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* 边缘线叠加 — 极低 GPU 开销 */}
      <lineSegments geometry={edgesGeometry}>
        <lineBasicMaterial
          color="#58524a"
          transparent
          opacity={0.6}
        />
      </lineSegments>
    </group>
  );
}

/**
 * 监听 WebGL context lost / restored 事件，自动恢复
 */
function ContextLostHandler() {
  const { gl } = useThree();

  const handleContextLost = useCallback(
    (event: Event) => {
      event.preventDefault();
      console.warn("WebGL context lost, attempting recovery...");
    },
    []
  );

  const handleContextRestored = useCallback(() => {
    console.log("WebGL context restored.");
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

export default function TrayViewer({ geometry }: TrayViewerProps) {
  return (
    <div className="relative w-full h-full min-h-[400px] overflow-hidden forged-viewport" style={{ backgroundColor: '#3d3b38' }}>
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

        {/* 灯光 — warm forge lighting (3-point) */}
        <ambientLight intensity={0.4} color="#ffeedd" />
        {/* 主光：右上前方 */}
        <directionalLight position={[50, 80, 50]} intensity={1.2} color="#fff5e6" />
        {/* 补光：左后方，柔和 */}
        <directionalLight position={[-30, 40, -20]} intensity={0.35} color="#ffe8cc" />
        {/* 侧底光：从下方打亮凹槽内壁 */}
        <directionalLight position={[0, -30, 40]} intensity={0.25} color="#ffeedd" />

        {/* 托盘模型 */}
        {geometry && <TrayMesh geometry={geometry} />}

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
