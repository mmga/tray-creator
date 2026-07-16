import type * as THREE from "three";
import type { Geom3 } from "@jscad/modeling/src/geometries/types";
import { jscadToThreeGeometry } from "@/lib/jscad-to-three";
import { createCurrentParamArtifactBlob } from "@/lib/current-param-artifact-encoder";
import { captureModeParamSnapshot } from "@/lib/mode-param-snapshot";
import type { ModeParamSnapshot } from "@/lib/mode-param-snapshot";
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

export function buildGridParamsBlob(
  snapshot: ModeParamSnapshot<"grid">,
): Blob {
  return createCurrentParamArtifactBlob(snapshot);
}

export async function exportGridModelFiles(
  params: TrayParams,
  geometry: Geom3,
  workerPort: GridWorkerPort,
  downloadPort: DownloadPort,
): Promise<void> {
  const snapshot = captureModeParamSnapshot("grid", params);
  const stlFilename = getGridSTLFilename(snapshot.params);
  const stlResult = await workerPort.exportSTL(geometry, stlFilename);
  downloadPort.downloadBlob(stlResult.blob, stlResult.filename);

  const jsonFilename = stlFilename.replace(/\.stl$/i, ".json");
  downloadPort.downloadBlob(buildGridParamsBlob(snapshot), jsonFilename);
}
