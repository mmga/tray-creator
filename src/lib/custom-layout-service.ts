import type * as THREE from "three";
import type { Geom3 } from "@jscad/modeling/src/geometries/types";
import {
  calculateCustomEffectiveDimensions,
  resolveCustomTraySizingMode,
  type LayoutExtents,
} from "@/lib/custom-layout-math";
import type { CustomWorkerPort, DownloadPort } from "@/lib/model-ports";
import { loadThreeGeometry } from "@/lib/three-geometry-loader";
import type { ModeParamSnapshot } from "@/lib/mode-param-snapshot";
import { exportModelArtifactBundle } from "@/lib/model-artifact-bundle";
import { generateCustomSTLFilename } from "@/lib/model-filenames";
import type { CustomLayoutParams } from "@/types/custom-tray";

export interface CustomPreviewResult {
  geometry: Geom3;
  threeGeometry: THREE.BufferGeometry;
  volume: number;
}

export async function generateCustomPreview(
  params: CustomLayoutParams,
  workerPort: CustomWorkerPort,
): Promise<CustomPreviewResult> {
  const result = await workerPort.generateCustom(params);
  const threeGeometry = await loadThreeGeometry(result.geometry);

  return {
    geometry: result.geometry,
    threeGeometry,
    volume: result.volume,
  };
}

export function getCustomSTLFilename(
  params: CustomLayoutParams,
  effectiveDimensions: LayoutExtents = calculateCustomEffectiveDimensions(params),
): string {
  const isFixed = resolveCustomTraySizingMode(params) === "fixed";
  const exportWidth = isFixed
    ? params.trayWidth
    : effectiveDimensions.width > 0
      ? effectiveDimensions.width
      : params.trayWidth;
  const exportDepth = isFixed
    ? params.trayDepth
    : effectiveDimensions.depth > 0
      ? effectiveDimensions.depth
      : params.trayDepth;

  return generateCustomSTLFilename(
    exportWidth,
    exportDepth,
    params.slots.length,
  );
}

export async function exportCustomModelFiles(
  snapshot: ModeParamSnapshot<"custom">,
  geometry: Geom3,
  workerPort: CustomWorkerPort,
  downloadPort: DownloadPort,
  effectiveDimensions: LayoutExtents,
): Promise<void> {
  const stlFilename = getCustomSTLFilename(snapshot.params, effectiveDimensions);
  await exportModelArtifactBundle(
    snapshot,
    async () => {
      const stlResult = await workerPort.exportSTL(geometry, stlFilename);
      return {
        files: [stlResult],
        companionParamFilename: stlFilename.replace(/\.stl$/i, ".json"),
      };
    },
    downloadPort,
  );
}
