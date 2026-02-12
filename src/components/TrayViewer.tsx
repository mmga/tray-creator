"use client";

import { useRef, useEffect, useCallback } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";
import * as THREE from "three";
import { RENDER_CONFIG } from "@/lib/config";

interface TrayViewerProps {
  geometry: THREE.BufferGeometry | null;
}

function TrayMesh({ geometry }: { geometry: THREE.BufferGeometry }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useEffect(() => {
    if (meshRef.current && geometry) {
      meshRef.current.geometry = geometry;
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
    }
  }, [geometry]);

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      rotation={[-Math.PI / 2, 0, 0]}
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
    <div className="w-full h-full min-h-[400px] rounded-xl overflow-hidden border border-zinc-800" style={{ backgroundColor: '#1a1b2e' }}>
      <Canvas
        camera={{ position: [60, 60, 60], fov: 45, near: 0.1, far: 2000 }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "default",
          failIfMajorPerformanceCaveat: false,
        }}
        onCreated={({ gl }) => {
          gl.setClearColor(new THREE.Color("#1a1b2e"));
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.0;
        }}
      >
        <ContextLostHandler />

        {/* 灯光（精简版，降低 GPU 压力） */}
        <ambientLight intensity={0.6} />
        <directionalLight position={[50, 80, 50]} intensity={1.2} />
        <directionalLight position={[-30, 40, -20]} intensity={0.4} />

        {/* 参考网格 */}
        <Grid
          args={[200, 200]}
          position={[0, -0.01, 0]}
          cellSize={5}
          cellThickness={0.5}
          cellColor="#333333"
          sectionSize={25}
          sectionThickness={1}
          sectionColor="#555555"
          fadeDistance={150}
          fadeStrength={1}
          infiniteGrid
        />

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
