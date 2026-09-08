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
import {
  generateCustomBoxSTLFilename,
  generateCustomSTLFilename,
} from "@/lib/model-filenames";
import type { CustomLayoutParams } from "@/types/custom-tray";
import { resolveStackableBoxParams } from "@/lib/stackable-box";

export interface CustomPreviewResult {
  geometry: Geom3;
  threeGeometry: THREE.BufferGeometry;
  volume: number;
  bodyVolume?: number;
  lidVolume?: number;
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
    bodyVolume: result.bodyVolume,
    lidVolume: result.lidVolume,
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
  const box = resolveStackableBoxParams(snapshot.params.stackableBox);
  if (box.enabled) {
    const parts = await workerPort.generateCustomBoxParts!(snapshot.params);
    const bodyFilename = generateCustomBoxSTLFilename(
      box.outerWidth,
      box.outerDepth,
      box.outerHeight,
      snapshot.params.slots.length,
      "body",
    );
    const lidFilename = generateCustomBoxSTLFilename(
      box.outerWidth,
      box.outerDepth,
      box.outerHeight,
      snapshot.params.slots.length,
      "lid",
    );
    await exportModelArtifactBundle(
      snapshot,
      async () => {
        const [bodyStl, lidStl] = await Promise.all([
          workerPort.exportSTL(parts.body, bodyFilename),
          workerPort.exportSTL(parts.lid, lidFilename),
        ]);
        return {
          files: [bodyStl, lidStl],
          companionParamFilename: bodyFilename.replace(/\.stl$/i, ".json"),
        };
      },
      downloadPort,
    );
    return;
  }

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
