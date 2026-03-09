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
const _triNormal = new THREE.Vector3();

function projectTo2D(
  vertices: number[][],
  normal: THREE.Vector3,
): THREE.Vector2[] {
  const ax = Math.abs(normal.x);
  const ay = Math.abs(normal.y);
  const az = Math.abs(normal.z);

  // Drop the dominant axis to get a stable 2D projection.
  if (ax >= ay && ax >= az) {
    return vertices.map((v) => new THREE.Vector2(v[1], v[2]));
  }
  if (ay >= ax && ay >= az) {
    return vertices.map((v) => new THREE.Vector2(v[0], v[2]));
  }
  return vertices.map((v) => new THREE.Vector2(v[0], v[1]));
}

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
    const vertices = poly.vertices;
    if (vertices.length < 3) continue;

    _v0.set(vertices[0][0], vertices[0][1], vertices[0][2]);
    _v1.set(vertices[1][0], vertices[1][1], vertices[1][2]);
    _v2.set(vertices[2][0], vertices[2][1], vertices[2][2]);
    _edge1.subVectors(_v1, _v0);
    _edge2.subVectors(_v2, _v0);
    _normal.crossVectors(_edge1, _edge2).normalize();

    const contour2D = projectTo2D(vertices, _normal);
    const tris = THREE.ShapeUtils.triangulateShape(contour2D, []);
    triangleCount += tris.length;
  }

  const positions = new Float32Array(triangleCount * 3 * 3);
  const normals = new Float32Array(triangleCount * 3 * 3);

  let offset = 0;

  for (const poly of polygons) {
    const vertices = poly.vertices;
    if (vertices.length < 3) continue;

    _v0.set(vertices[0][0], vertices[0][1], vertices[0][2]);
    _v1.set(vertices[1][0], vertices[1][1], vertices[1][2]);
    _v2.set(vertices[2][0], vertices[2][1], vertices[2][2]);

    _edge1.subVectors(_v1, _v0);
    _edge2.subVectors(_v2, _v0);
    _normal.crossVectors(_edge1, _edge2).normalize();

    const contour2D = projectTo2D(vertices, _normal);
    const tris = THREE.ShapeUtils.triangulateShape(contour2D, []);

    for (const tri of tris) {
      let a = vertices[tri[0]];
      let b = vertices[tri[1]];
      let c = vertices[tri[2]];

      // Keep triangle winding consistent with the polygon normal.
      _v0.set(a[0], a[1], a[2]);
      _v1.set(b[0], b[1], b[2]);
      _v2.set(c[0], c[1], c[2]);
      _edge1.subVectors(_v1, _v0);
      _edge2.subVectors(_v2, _v0);
      _triNormal.crossVectors(_edge1, _edge2).normalize();
      if (_triNormal.dot(_normal) < 0) {
        const tmp = b;
        b = c;
        c = tmp;
      }

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
