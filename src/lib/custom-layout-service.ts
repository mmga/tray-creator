import type * as THREE from "three";
import type { Geom3 } from "@jscad/modeling/src/geometries/types";
import {
  calculateCustomEffectiveDimensions,
  resolveCustomTraySizingMode,
  type LayoutExtents,
} from "@/lib/custom-layout-math";
import type { CustomWorkerPort, DownloadPort } from "@/lib/model-ports";
import { jscadToThreeGeometry } from "@/lib/jscad-to-three";
import { createCurrentParamArtifactBlob } from "@/lib/current-param-artifact-encoder";
import { captureModeParamSnapshot } from "@/lib/mode-param-snapshot";
import type { ModeParamSnapshot } from "@/lib/mode-param-snapshot";
import { generateCustomSTLFilename } from "@/lib/stl-export";
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

  return {
    geometry: result.geometry,
    threeGeometry: jscadToThreeGeometry(result.geometry),
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

export function buildCustomParamsBlob(
  snapshot: ModeParamSnapshot<"custom">,
): Blob {
  return createCurrentParamArtifactBlob(snapshot);
}

export async function exportCustomModelFiles(
  params: CustomLayoutParams,
  effectiveDimensions: LayoutExtents,
  geometry: Geom3,
  workerPort: CustomWorkerPort,
  downloadPort: DownloadPort,
): Promise<void> {
  const snapshot = captureModeParamSnapshot("custom", params);
  const stlFilename = getCustomSTLFilename(snapshot.params, effectiveDimensions);
  const stlResult = await workerPort.exportSTL(geometry, stlFilename);
  downloadPort.downloadBlob(stlResult.blob, stlResult.filename);

  const jsonFilename = stlFilename.replace(/\.stl$/i, ".json");
  downloadPort.downloadBlob(buildCustomParamsBlob(snapshot), jsonFilename);
}
