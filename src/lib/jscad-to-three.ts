import { geom3 } from "@jscad/modeling/src/geometries";
import type { Geom3 } from "@jscad/modeling/src/geometries/types";
import * as THREE from "three";

// 预分配复用向量，避免循环中大量临时对象分配
const _v0 = new THREE.Vector3();
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _edge1 = new THREE.Vector3();
const _edge2 = new THREE.Vector3();
const _normal = new THREE.Vector3();

/**
 * 将 JSCAD geom3 几何体转换为 Three.js BufferGeometry
 *
 * 流程：
 * 1. 从 geom3 提取多边形面 (polygons)
 * 2. 对每个多边形进行三角化 (fan triangulation)
 * 3. 计算面法线 (flat shading) 以最大化结构清晰度
 * 4. 返回 Three.js BufferGeometry
 */
export function jscadToThreeGeometry(jscadGeom: Geom3): THREE.BufferGeometry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- jscad 类型定义不完整
  const polygons = geom3.toPolygons(jscadGeom as any);

  let triangleCount = 0;
  for (const poly of polygons) {
    triangleCount += poly.vertices.length - 2;
  }

  const positions = new Float32Array(triangleCount * 3 * 3);
  const normals = new Float32Array(triangleCount * 3 * 3);

  let offset = 0;

  for (const poly of polygons) {
    const vertices = poly.vertices;
    const n = vertices.length;

    if (n < 3) continue;

    _v0.set(vertices[0][0], vertices[0][1], vertices[0][2]);
    _v1.set(vertices[1][0], vertices[1][1], vertices[1][2]);
    _v2.set(vertices[2][0], vertices[2][1], vertices[2][2]);

    _edge1.subVectors(_v1, _v0);
    _edge2.subVectors(_v2, _v0);
    _normal.crossVectors(_edge1, _edge2).normalize();

    for (let i = 1; i < n - 1; i++) {
      const a = vertices[0];
      const b = vertices[i];
      const c = vertices[i + 1];

      positions[offset] = a[0];
      positions[offset + 1] = a[1];
      positions[offset + 2] = a[2];

      positions[offset + 3] = b[0];
      positions[offset + 4] = b[1];
      positions[offset + 5] = b[2];

      positions[offset + 6] = c[0];
      positions[offset + 7] = c[1];
      positions[offset + 8] = c[2];

      normals[offset] = _normal.x;
      normals[offset + 1] = _normal.y;
      normals[offset + 2] = _normal.z;

      normals[offset + 3] = _normal.x;
      normals[offset + 4] = _normal.y;
      normals[offset + 5] = _normal.z;

      normals[offset + 6] = _normal.x;
      normals[offset + 7] = _normal.y;
      normals[offset + 8] = _normal.z;

      offset += 9;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));

  return geometry;
}
