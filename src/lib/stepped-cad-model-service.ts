import type * as THREE from "three";
import type { Geom3 } from "@jscad/modeling/src/geometries/types";
import { createCurrentParamArtifactBlob } from "@/lib/current-param-artifact-encoder";
import type { ModeParamSnapshot } from "@/lib/mode-param-snapshot";
import type {
  DownloadPort,
  SteppedSplitPartResult,
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

export interface SteppedCadSplitPreviewPart
  extends Omit<SteppedSplitPartResult, "geometry"> {
  threeGeometry: THREE.BufferGeometry;
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

export async function generateSteppedCadSplitPreview(
  params: SteppedLayoutParams,
  workerPort: SteppedCadWorkerPort,
): Promise<SteppedCadSplitPreviewPart[]> {
  const { parts } = await workerPort.generateSteppedCadSplitParts(params);

  return parts.map(({ geometry, ...part }) => ({
    ...part,
    threeGeometry: jscadToThreeGeometry(geometry),
  }));
}

export function getSteppedCadSplitBaseFilename(
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

  return `tray_stepped_cad_split_${exportWidth}x${exportDepth}_${params.slots.length}slots`;
}

export async function exportSteppedCadModelFiles(
  snapshot: ModeParamSnapshot<"stepped-cad">,
  effectiveDimensions: SteppedLayoutExtents,
  geometry: Geom3,
  workerPort: SteppedCadWorkerPort,
  downloadPort: DownloadPort,
): Promise<void> {
  const { params } = snapshot;
  const stlFilename = getSteppedCadSTLFilename(params, effectiveDimensions);
  const stlResult = await workerPort.exportSTL(geometry, stlFilename);
  downloadPort.downloadBlob(stlResult.blob, stlResult.filename);

  const jsonFilename = stlFilename.replace(/\.stl$/i, ".json");
  downloadPort.downloadBlob(
    createCurrentParamArtifactBlob(snapshot),
    jsonFilename,
  );
}

export async function exportSteppedCadSplitPartFiles(
  snapshot: ModeParamSnapshot<"stepped-cad">,
  effectiveDimensions: SteppedLayoutExtents,
  workerPort: SteppedCadWorkerPort,
  downloadPort: DownloadPort,
): Promise<void> {
  const { params } = snapshot;
  const { parts } = await workerPort.generateSteppedCadSplitParts(params);
  if (parts.length === 0) {
    throw new Error("当前模型没有可导出的分件");
  }

  const baseFilename = getSteppedCadSplitBaseFilename(params, effectiveDimensions);

  for (const part of parts) {
    const stlResult = await workerPort.exportSTL(
      part.geometry,
      `${baseFilename}_${part.filenameLabel}.stl`,
    );
    downloadPort.downloadBlob(stlResult.blob, stlResult.filename);
  }

  const manifest = {
    mode: "stepped-cad-split-parts",
    generatedAt: new Date().toISOString(),
    note: "CAD 阶梯模式拆件，按统一 feature graph 生成整面 2mm 公母装配槽。",
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
    createCurrentParamArtifactBlob(snapshot),
    `${baseFilename}_params.json`,
  );
}
