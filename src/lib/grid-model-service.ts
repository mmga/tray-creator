import type * as THREE from "three";
import type { Geom3 } from "@jscad/modeling/src/geometries/types";
import { jscadToThreeGeometry } from "@/lib/jscad-to-three";
import { createParamBlob } from "@/lib/param-io";
import type { DownloadPort, GridWorkerPort } from "@/lib/model-ports";
import { generateSTLFilename } from "@/lib/stl-export";
import type { TrayParams } from "@/types/tray";

export interface GridPreviewResult {
  geometry: Geom3;
  threeGeometry: THREE.BufferGeometry;
  volume: number;
}

export async function generateGridPreview(
  params: TrayParams,
  workerPort: GridWorkerPort,
): Promise<GridPreviewResult> {
  const result = await workerPort.generateGrid(params);

  return {
    geometry: result.geometry,
    threeGeometry: jscadToThreeGeometry(result.geometry),
    volume: result.volume,
  };
}

export function getGridSTLFilename(params: TrayParams): string {
  return generateSTLFilename(params.rows, params.columns, params.holeDiameter);
}

export function buildGridParamsBlob(params: TrayParams): Blob {
  return createParamBlob("grid", params);
}

export async function exportGridModelFiles(
  params: TrayParams,
  geometry: Geom3,
  workerPort: GridWorkerPort,
  downloadPort: DownloadPort,
): Promise<void> {
  const stlFilename = getGridSTLFilename(params);
  const stlResult = await workerPort.exportSTL(geometry, stlFilename);
  downloadPort.downloadBlob(stlResult.blob, stlResult.filename);

  const jsonFilename = stlFilename.replace(/\.stl$/i, ".json");
  downloadPort.downloadBlob(buildGridParamsBlob(params), jsonFilename);
}
