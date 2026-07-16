import type * as THREE from "three";
import type { Geom3 } from "@jscad/modeling/src/geometries/types";
import { jscadToThreeGeometry } from "@/lib/jscad-to-three";
import type { ModeParamSnapshot } from "@/lib/mode-param-snapshot";
import { exportModelArtifactBundle } from "@/lib/model-artifact-bundle";
import type { DownloadPort, GridWorkerPort } from "@/lib/model-ports";
import { generateSTLFilename } from "@/lib/stl-export";
import type { TrayParams } from "@/types/tray";
import {
  getGridSlotGeometry,
  isRectangularGridSlot,
} from "@/lib/grid-config";

export interface GridPreviewResult {
  geometry: Geom3;
  threeGeometry: THREE.BufferGeometry;
  volume: number;
}

export async function generateGridPreview(
  params: TrayParams,
  workerPort: GridWorkerPort,
): Promise<GridPreviewResult> {
  const result = await workerPort.generateGrid(params);

  return {
    geometry: result.geometry,
    threeGeometry: jscadToThreeGeometry(result.geometry),
    volume: result.volume,
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
