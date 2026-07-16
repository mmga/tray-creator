import type { Geom3 } from "@jscad/modeling/src/geometries/types";
import { exportModelArtifactBundle } from "@/lib/model-artifact-bundle";
import type { ModeParamSnapshot } from "@/lib/mode-param-snapshot";
import type { DownloadPort, STLExportWorkerPort } from "@/lib/model-ports";
import { deriveSimpleSteppedLayout } from "@/lib/simple-stepped-projection";
import { generateSimpleSteppedSTLFilename } from "@/lib/stl-export";

export async function exportSimpleSteppedModelFiles(
  snapshot: ModeParamSnapshot<"simple-stepped">,
  geometry: Geom3,
  workerPort: STLExportWorkerPort,
  downloadPort: DownloadPort,
): Promise<void> {
  const derived = deriveSimpleSteppedLayout(snapshot.params);
  const stlFilename = generateSimpleSteppedSTLFilename(
    Math.round(derived.trayWidth),
    Math.round(derived.trayDepth),
    derived.activeRows.length,
    snapshot.params.slots.length,
  );

  await exportModelArtifactBundle(
    snapshot,
    async () => ({
      files: [await workerPort.exportSTL(geometry, stlFilename)],
      companionParamFilename: stlFilename.replace(/\.stl$/i, ".json"),
    }),
    downloadPort,
  );
}
