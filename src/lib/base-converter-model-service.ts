import type * as THREE from "three";
import type { Geom3 } from "@jscad/modeling/src/geometries/types";
import { jscadToThreeGeometry } from "@/lib/jscad-to-three";
import { createCurrentParamArtifactBlob } from "@/lib/current-param-artifact-encoder";
import { captureModeParamSnapshot } from "@/lib/mode-param-snapshot";
import type {
  BaseConverterWorkerPort,
  DownloadPort,
} from "@/lib/model-ports";
import type { BaseConverterParams } from "@/types/custom-tray";

export interface BaseConverterPreviewResult {
  geometry: Geom3;
  threeGeometry: THREE.BufferGeometry;
  volume: number;
}

export async function generateBaseConverterPreview(
  params: BaseConverterParams,
  workerPort: BaseConverterWorkerPort,
): Promise<BaseConverterPreviewResult> {
  const result = await workerPort.generateBaseConverter(params);
  return {
    geometry: result.geometry,
    threeGeometry: jscadToThreeGeometry(result.geometry),
    volume: result.volume,
  };
}

export function getBaseConverterSTLFilename(params: BaseConverterParams) {
  return `base-converter-${params.sourceStandardId.replace("source-", "")}-to-${params.targetStandardId.replace("target-", "")}.stl`;
}

export async function exportBaseConverterModelFiles(
  params: BaseConverterParams,
  geometry: Geom3,
  workerPort: BaseConverterWorkerPort,
  downloadPort: DownloadPort,
) {
  const snapshot = captureModeParamSnapshot("base-converter", params);
  const stlFilename = getBaseConverterSTLFilename(snapshot.params);
  const stlResult = await workerPort.exportSTL(geometry, stlFilename);
  downloadPort.downloadBlob(stlResult.blob, stlResult.filename);
  downloadPort.downloadBlob(
    createCurrentParamArtifactBlob(snapshot),
    stlFilename.replace(/\.stl$/i, ".json"),
  );
}
