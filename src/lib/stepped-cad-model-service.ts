import type * as THREE from "three";
import type { Geom3 } from "@jscad/modeling/src/geometries/types";
import type { ModeParamSnapshot } from "@/lib/mode-param-snapshot";
import { exportModelArtifactBundle } from "@/lib/model-artifact-bundle";
import type {
  DownloadPort,
  SteppedSplitPartResult,
  SteppedCadWorkerPort,
} from "@/lib/model-ports";
import {
  calculateSteppedEffectiveDimensions,
  type SteppedLayoutExtents,
} from "@/lib/stepped-layout-math";
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
  geometry: Geom3,
  workerPort: SteppedCadWorkerPort,
  downloadPort: DownloadPort,
): Promise<void> {
  const { params } = snapshot;
  const effectiveDimensions = calculateSteppedEffectiveDimensions(params);
  const stlFilename = getSteppedCadSTLFilename(params, effectiveDimensions);
  await exportModelArtifactBundle(
    snapshot,
    async () => ({
      files: [await workerPort.exportSTL(geometry, stlFilename)],
      companionParamFilename: stlFilename.replace(/\.stl$/i, ".json"),
    }),
    downloadPort,
  );
}

export async function exportSteppedCadSplitPartFiles(
  snapshot: ModeParamSnapshot<"stepped-cad">,
  workerPort: SteppedCadWorkerPort,
  downloadPort: DownloadPort,
): Promise<void> {
  const { params } = snapshot;
  const { parts } = await workerPort.generateSteppedCadSplitParts(params);
  if (parts.length === 0) {
    throw new Error("当前模型没有可导出的分件");
  }

  const effectiveDimensions = calculateSteppedEffectiveDimensions(params);
  const baseFilename = getSteppedCadSplitBaseFilename(params, effectiveDimensions);
  await exportModelArtifactBundle(
    snapshot,
    async () => {
      const stlFiles = await Promise.all(
        parts.map((part) =>
          workerPort.exportSTL(
            part.geometry,
            `${baseFilename}_${part.filenameLabel}.stl`,
          ),
        ),
      );
      return {
        files: stlFiles,
        companionParamFilename: `${baseFilename}_params.json`,
      };
    },
    downloadPort,
  );
}
