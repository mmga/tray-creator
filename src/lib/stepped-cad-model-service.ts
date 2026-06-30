import type * as THREE from "three";
import type { Geom3 } from "@jscad/modeling/src/geometries/types";
import { createParamBlob } from "@/lib/param-io";
import type {
  DownloadPort,
  SteppedCadWorkerPort,
} from "@/lib/model-ports";
import type { SteppedLayoutExtents } from "@/lib/stepped-layout-math";
import { jscadToThreeGeometry } from "@/lib/jscad-to-three";
import type { SteppedLayoutParams } from "@/types/custom-tray";

export interface SteppedCadPreviewResult {
  geometry: Geom3;
  threeGeometry: THREE.BufferGeometry;
  volume: number;
}

export async function generateSteppedCadPreview(
  params: SteppedLayoutParams,
  workerPort: SteppedCadWorkerPort,
): Promise<SteppedCadPreviewResult> {
  const result = await workerPort.generateSteppedCad(params);

  return {
    geometry: result.geometry,
    threeGeometry: jscadToThreeGeometry(result.geometry),
    volume: result.volume,
  };
}

export function getSteppedCadSTLFilename(
  params: SteppedLayoutParams,
  effectiveDimensions: SteppedLayoutExtents,
): string {
  const exportWidth =
    effectiveDimensions.width > 0
      ? effectiveDimensions.width
      : params.trayWidth;
  const exportDepth =
    effectiveDimensions.depth > 0
      ? effectiveDimensions.depth
      : params.trayDepth;

  return `tray_stepped_cad_${exportWidth}x${exportDepth}_${params.slots.length}slots.stl`;
}

export async function exportSteppedCadModelFiles(
  params: SteppedLayoutParams,
  effectiveDimensions: SteppedLayoutExtents,
  geometry: Geom3,
  workerPort: SteppedCadWorkerPort,
  downloadPort: DownloadPort,
): Promise<void> {
  const stlFilename = getSteppedCadSTLFilename(params, effectiveDimensions);
  const stlResult = await workerPort.exportSTL(geometry, stlFilename);
  downloadPort.downloadBlob(stlResult.blob, stlResult.filename);

  const jsonFilename = stlFilename.replace(/\.stl$/i, ".json");
  downloadPort.downloadBlob(createParamBlob("stepped", params), jsonFilename);
}
