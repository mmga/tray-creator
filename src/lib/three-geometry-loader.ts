import type { Geom3 } from "@jscad/modeling/src/geometries/types";
import type { BufferGeometry } from "three";

export async function loadThreeGeometry(
  geometry: Geom3,
): Promise<BufferGeometry> {
  const { jscadToThreeGeometry } = await import("@/lib/jscad-to-three");
  return jscadToThreeGeometry(geometry);
}
