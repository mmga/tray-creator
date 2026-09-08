import type * as THREE from "three";
import type { Geom3 } from "@jscad/modeling/src/geometries/types";
import { loadThreeGeometry } from "@/lib/three-geometry-loader";
import type { ModeParamSnapshot } from "@/lib/mode-param-snapshot";
import { exportModelArtifactBundle } from "@/lib/model-artifact-bundle";
import type { DownloadPort, GridWorkerPort } from "@/lib/model-ports";
import {
  generateGridBoxSTLFilename,
  generateSTLFilename,
} from "@/lib/model-filenames";
import type { TrayParams } from "@/types/tray";
import {
  getGridSlotGeometry,
  isRectangularGridSlot,
} from "@/lib/grid-config";
import { resolveStackableBoxParams } from "@/lib/stackable-box";

export interface GridPreviewResult {
  geometry: Geom3;
  threeGeometry: THREE.BufferGeometry;
  volume: number;
  bodyVolume?: number;
  lidVolume?: number;
}

export async function generateGridPreview(
  params: TrayParams,
  workerPort: GridWorkerPort,
): Promise<GridPreviewResult> {
  const result = await workerPort.generateGrid(params);
  const threeGeometry = await loadThreeGeometry(result.geometry);

  return {
    geometry: result.geometry,
    threeGeometry,
    volume: result.volume,
    bodyVolume: result.bodyVolume,
    lidVolume: result.lidVolume,
  };
}

export function getGridSTLFilename(params: TrayParams): string {
  if (isRectangularGridSlot(params)) {
    const slot = getGridSlotGeometry(params);
    return `tray_${params.columns}x${params.rows}_rectangle_${slot.baseWidth}x${slot.baseHeight}mm.stl`;
  }
  return generateSTLFilename(params.rows, params.columns, params.holeDiameter);
}

export async function exportGridModelFiles(
  snapshot: ModeParamSnapshot<"grid">,
  geometry: Geom3,
  workerPort: GridWorkerPort,
  downloadPort: DownloadPort,
): Promise<void> {
  const box = resolveStackableBoxParams(snapshot.params.stackableBox);
  if (box.enabled) {
    const parts = await workerPort.generateGridBoxParts!(snapshot.params);
    const bodyFilename = generateGridBoxSTLFilename(
      box.outerWidth,
      box.outerDepth,
      box.outerHeight,
      snapshot.params.columns,
      snapshot.params.rows,
      "body",
    );
    const lidFilename = generateGridBoxSTLFilename(
      box.outerWidth,
      box.outerDepth,
      box.outerHeight,
      snapshot.params.columns,
      snapshot.params.rows,
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

  const stlFilename = getGridSTLFilename(snapshot.params);
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
