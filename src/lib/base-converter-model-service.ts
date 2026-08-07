import type * as THREE from "three";
import type { Geom3 } from "@jscad/modeling/src/geometries/types";
import { loadThreeGeometry } from "@/lib/three-geometry-loader";
import type { ModeParamSnapshot } from "@/lib/mode-param-snapshot";
import { exportModelArtifactBundle } from "@/lib/model-artifact-bundle";
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
  const threeGeometry = await loadThreeGeometry(result.geometry);
  return {
    geometry: result.geometry,
    threeGeometry,
    volume: result.volume,
  };
}

export function getBaseConverterSTLFilename(params: BaseConverterParams) {
  return `base-converter-${params.sourceStandardId.replace("source-", "")}-to-${params.targetStandardId.replace("target-", "")}.stl`;
}

export async function exportBaseConverterModelFiles(
  snapshot: ModeParamSnapshot<"base-converter">,
  geometry: Geom3,
  workerPort: BaseConverterWorkerPort,
  downloadPort: DownloadPort,
) {
  const stlFilename = getBaseConverterSTLFilename(snapshot.params);
  await exportModelArtifactBundle(
    snapshot,
    async () => ({
      files: [await workerPort.exportSTL(geometry, stlFilename)],
      companionParamFilename: stlFilename.replace(/\.stl$/i, ".json"),
    }),
    downloadPort,
  );
}
