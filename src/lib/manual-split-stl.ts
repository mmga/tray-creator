type Vertex = [number, number, number];
type Face = [Vertex, Vertex, Vertex];
type OpenEdge = { face: number; edge: number; from: Vertex; to: Vertex };

const HEADER_BYTES = 84;
const FACE_BYTES = 50;
const JOIN_TOLERANCE = 0.003;

function openEdges(faces: Face[]) {
  const edges = new Map<string, OpenEdge | null>();
  for (const [face, vertices] of faces.entries()) {
    for (let edge = 0; edge < 3; edge++) {
      const from = vertices[edge], to = vertices[(edge + 1) % 3];
      const a = from.join(","), b = to.join(",");
      if (a === b) return null;
      const key = a < b ? a + "/" + b : b + "/" + a;
      const previous = edges.get(key);
      if (previous === undefined) edges.set(key, { face, edge, from, to });
      else if (previous?.from.join(",") === b) edges.set(key, null);
      else return null;
    }
  }
  return [...edges.values()].filter((edge) => edge !== null);
}

function readVertex(input: DataView, offset: number): Vertex {
  return [input.getFloat32(offset, true), input.getFloat32(offset + 4, true), input.getFloat32(offset + 8, true)];
}

function interiorRatio(point: Vertex, from: Vertex, to: Vertex) {
  const vector = to.map((coordinate, i) => coordinate - from[i]);
  const lengthSquared = vector.reduce((sum, coordinate) => sum + coordinate * coordinate, 0);
  const t = vector.reduce((sum, coordinate, i) => sum + coordinate * (point[i] - from[i]), 0) / lengthSquared;
  if (t <= 0 || t >= 1) return null;
  const error = Math.hypot(...vector.map((coordinate, i) => from[i] + t * coordinate - point[i]));
  return error <= JOIN_TOLERANCE ? t : null;
}

/** 仅修复量化误差造成的 T 形接缝，无法闭合的网格禁止导出。 */
export async function closeManualSplitStl(blob: Blob): Promise<Blob | null> {
  const buffer = await blob.arrayBuffer();
  const data = new DataView(buffer);
  if (data.byteLength < HEADER_BYTES) return null;
  const count = data.getUint32(80, true);
  if (!count || data.byteLength !== HEADER_BYTES + count * FACE_BYTES) return null;
  const faces: Face[] = Array.from({ length: count }, (_, i) => {
    const start = HEADER_BYTES + i * FACE_BYTES + 12;
    return [readVertex(data, start), readVertex(data, start + 12), readVertex(data, start + 24)];
  });
  if (faces.some((face) => face.some((vertex) => !vertex.every(Number.isFinite)))) return null;
  const open = openEdges(faces);
  // shortcut: 大量开放边时停止配对，后续可用空间索引支持更大的修复范围。
  if (!open || open.length > 2048) return null;
  if (!open.length) return blob;

  const vertices = [...new Map(open.flatMap(({ from, to }) => [[from.join(","), from], [to.join(","), to]])).values()];
  const inserts = new Map<number, Vertex[]>();
  for (const { face, edge, from, to } of open) {
    const along = vertices.flatMap((point) => {
      const ratio = interiorRatio(point, from, to);
      return ratio === null ? [] : [{ point, ratio }];
    }).sort((a, b) => a.ratio - b.ratio).map(({ point }) => point);
    if (along.length) inserts.set(face * 3 + edge, along);
  }
  if (!inserts.size) return null;

  const repaired = faces.flatMap((face, index): { face: Face; index: number }[] => {
    const boundary = face.flatMap((point, edge) => [point, ...(inserts.get(index * 3 + edge) ?? [])]);
    if (boundary.length === 3) return [{ face, index }];
    const center: Vertex = [0, 1, 2].map((i) => Math.fround((face[0][i] + face[1][i] + face[2][i]) / 3)) as Vertex;
    return boundary.map((vertex, i) => ({ face: [center, vertex, boundary[(i + 1) % boundary.length]], index }));
  });
  if (openEdges(repaired.map(({ face }) => face))?.length !== 0) return null;
  const output = new Uint8Array(HEADER_BYTES + repaired.length * FACE_BYTES);
  output.set(new Uint8Array(buffer, 0, HEADER_BYTES));
  const view = new DataView(output.buffer);
  view.setUint32(80, repaired.length, true);
  repaired.forEach(({ face, index }, i) => {
    const offset = HEADER_BYTES + i * FACE_BYTES;
    output.set(new Uint8Array(buffer, HEADER_BYTES + index * FACE_BYTES, 12), offset);
    face.forEach((vertex, j) => vertex.forEach((value, k) => view.setFloat32(offset + 12 + j * 12 + k * 4, value, true)));
  });
  return new Blob([output], { type: blob.type });
}
