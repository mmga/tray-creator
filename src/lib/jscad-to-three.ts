import { geom3 } from "@jscad/modeling/src/geometries";
import type { Geom3 } from "@jscad/modeling/src/geometries/types";
import * as THREE from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * 将 JSCAD geom3 几何体转换为 Three.js BufferGeometry
 *
 * 流程：
 * 1. 从 geom3 提取多边形面 (polygons)
 * 2. 对每个多边形进行三角化 (fan triangulation)
 * 3. 构建顶点位置 Array
 * 4. 使用 BufferGeometryUtils.mergeVertices 合并顶点
 * 5. computeVertexNormals 计算平滑顶点法线
 */
export function jscadToThreeGeometry(jscadGeom: Geom3): THREE.BufferGeometry {
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

    const v0 = new THREE.Vector3(vertices[0][0], vertices[0][1], vertices[0][2]);
    const v1 = new THREE.Vector3(vertices[1][0], vertices[1][1], vertices[1][2]);
    const v2 = new THREE.Vector3(vertices[2][0], vertices[2][1], vertices[2][2]);

    const edge1 = new THREE.Vector3().subVectors(v1, v0);
    const edge2 = new THREE.Vector3().subVectors(v2, v0);
    const normal = new THREE.Vector3().crossVectors(edge1, edge2).normalize();

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

      normals[offset] = normal.x;
      normals[offset + 1] = normal.y;
      normals[offset + 2] = normal.z;

      normals[offset + 3] = normal.x;
      normals[offset + 4] = normal.y;
      normals[offset + 5] = normal.z;

      normals[offset + 6] = normal.x;
      normals[offset + 7] = normal.y;
      normals[offset + 8] = normal.z;

      offset += 9;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));

  return geometry;
}
