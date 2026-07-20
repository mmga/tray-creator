import type * as THREE from "three";
import type { Geom3 } from "@jscad/modeling/src/geometries/types";
import type { ModeParamSnapshot } from "@/lib/mode-param-snapshot";
import { exportModelArtifactBundle } from "@/lib/model-artifact-bundle";
import type {
  DownloadPort,
  SteppedSplitPartResult,
  SteppedWorkerPort,
} from "@/lib/model-ports";
import {
  calculateSteppedEffectiveDimensions,
  type SteppedLayoutExtents,
} from "@/lib/stepped-layout-math";
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
  snapshot: ModeParamSnapshot<"stepped">,
  geometry: Geom3,
  workerPort: SteppedWorkerPort,
  downloadPort: DownloadPort,
): Promise<void> {
  const effectiveDimensions = calculateSteppedEffectiveDimensions(snapshot.params);
  const stlFilename = getSteppedSTLFilename(snapshot.params, effectiveDimensions);
  await exportModelArtifactBundle(
    snapshot,
    async () => ({
      files: [await workerPort.exportSTL(geometry, stlFilename)],
      companionParamFilename: stlFilename.replace(/\.stl$/i, ".json"),
    }),
    downloadPort,
  );
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
  const exportWidth = effectiveDimensions.width > 0
    ? effectiveDimensions.width
    : params.trayWidth;
  const exportDepth = effectiveDimensions.depth > 0
    ? effectiveDimensions.depth
    : params.trayDepth;

  return `tray_stepped_split_${exportWidth}x${exportDepth}_${params.slots.length}slots`;
}

export async function exportSteppedSplitPartFiles(
  snapshot: ModeParamSnapshot<"stepped">,
  workerPort: SteppedWorkerPort,
  downloadPort: DownloadPort,
): Promise<void> {
  const { params } = snapshot;
  const { parts } = await workerPort.generateSteppedSplitParts(params);
  if (parts.length === 0) {
    throw new Error("当前模型没有可导出的分件");
  }

  const effectiveDimensions = calculateSteppedEffectiveDimensions(params);
  const baseFilename = getSteppedSplitBaseFilename(params, effectiveDimensions);
  await exportModelArtifactBundle(
    snapshot,
    async () => {
      const stlFiles = await Promise.all(
        parts.map((part) => workerPort.exportSTL(
          part.geometry,
          `${baseFilename}_${part.filenameLabel}.stl`,
        )),
      );
      return {
        files: stlFiles,
        companionParamFilename: `${baseFilename}_params.json`,
      };
    },
    downloadPort,
  );
}
