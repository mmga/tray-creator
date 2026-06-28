import type * as THREE from "three";
import type { Geom3 } from "@jscad/modeling/src/geometries/types";
import { createParamBlob } from "@/lib/param-io";
import type {
  DownloadPort,
  SteppedSplitPartResult,
  SteppedWorkerPort,
} from "@/lib/model-ports";
import type { SteppedLayoutExtents } from "@/lib/stepped-layout-math";
import { jscadToThreeGeometry } from "@/lib/jscad-to-three";
import type { SteppedLayoutParams } from "@/types/custom-tray";

export interface SteppedPreviewResult {
  geometry: Geom3;
  threeGeometry: THREE.BufferGeometry;
  volume: number;
}

export interface SteppedSplitPreviewPart
  extends Omit<SteppedSplitPartResult, "geometry"> {
  threeGeometry: THREE.BufferGeometry;
}

export async function generateSteppedPreview(
  params: SteppedLayoutParams,
  workerPort: SteppedWorkerPort,
): Promise<SteppedPreviewResult> {
  const result = await workerPort.generateStepped(params);

  return {
    geometry: result.geometry,
    threeGeometry: jscadToThreeGeometry(result.geometry),
    volume: result.volume,
  };
}

export function getSteppedSTLFilename(
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

  return `tray_stepped_${exportWidth}x${exportDepth}_${params.slots.length}slots.stl`;
}

export async function exportSteppedModelFiles(
  params: SteppedLayoutParams,
  effectiveDimensions: SteppedLayoutExtents,
  geometry: Geom3,
  workerPort: SteppedWorkerPort,
  downloadPort: DownloadPort,
): Promise<void> {
  const stlFilename = getSteppedSTLFilename(params, effectiveDimensions);
  const stlResult = await workerPort.exportSTL(geometry, stlFilename);
  downloadPort.downloadBlob(stlResult.blob, stlResult.filename);

  const jsonFilename = stlFilename.replace(/\.stl$/i, ".json");
  downloadPort.downloadBlob(createParamBlob("stepped", params), jsonFilename);
}

export async function generateSteppedSplitPreview(
  params: SteppedLayoutParams,
  workerPort: SteppedWorkerPort,
): Promise<SteppedSplitPreviewPart[]> {
  const { parts } = await workerPort.generateSteppedSplitParts(params);

  return parts.map(({ geometry, ...part }) => ({
    ...part,
    threeGeometry: jscadToThreeGeometry(geometry),
  }));
}

export function getSteppedSplitBaseFilename(
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

  return `tray_stepped_split_${exportWidth}x${exportDepth}_${params.slots.length}slots`;
}

export async function exportSteppedSplitPartFiles(
  params: SteppedLayoutParams,
  effectiveDimensions: SteppedLayoutExtents,
  workerPort: SteppedWorkerPort,
  downloadPort: DownloadPort,
): Promise<void> {
  const { parts } = await workerPort.generateSteppedSplitParts(params);
  if (parts.length === 0) {
    throw new Error("当前模型没有可导出的分件");
  }

  const baseFilename = getSteppedSplitBaseFilename(params, effectiveDimensions);

  for (const part of parts) {
    const stlResult = await workerPort.exportSTL(
      part.geometry,
      `${baseFilename}_${part.filenameLabel}.stl`,
    );
    downloadPort.downloadBlob(stlResult.blob, stlResult.filename);
  }

  const manifest = {
    mode: "stepped-split-parts",
    generatedAt: new Date().toISOString(),
    note: "相邻分组在上下高度交接处生成装配浅槽，便于对位拼装。",
    parts: parts.map((part) => ({
      file: `${baseFilename}_${part.filenameLabel}.stl`,
      label: part.label,
      fromHeight: part.fromHeight,
      toHeight: part.toHeight,
    })),
  };
  downloadPort.downloadBlob(
    new Blob([JSON.stringify(manifest, null, 2)], {
      type: "application/json",
    }),
    `${baseFilename}_manifest.json`,
  );

  downloadPort.downloadBlob(
    createParamBlob("stepped", params),
    `${baseFilename}_params.json`,
  );
}
