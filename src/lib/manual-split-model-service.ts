import type { DownloadPort, STLExportWorkerPort } from "./model-ports";
import type { FlatTraySnapshot } from "./manual-split-plan";
import type { WorkerResponse } from "./worker/tray.worker";
import { exportModelArtifactBundle } from "./model-artifact-bundle";

type RealizedParts = Extract<WorkerResponse, { type: "MANUAL_SPLIT_PARTS_SUCCESS" }>["parts"];

interface ManualSplitExportPort extends STLExportWorkerPort {
  generateManualSplitParts: (snapshot: FlatTraySnapshot, forPrint: boolean) => Promise<RealizedParts>;
}

export async function exportManualSplitFiles(
  snapshot: FlatTraySnapshot,
  worker: ManualSplitExportPort,
  download: DownloadPort,
  isCurrent: () => boolean,
) {
  const label = snapshot.mode === "grid"
    ? `tray_${snapshot.params.columns}x${snapshot.params.rows}`
    : `custom_tray_${snapshot.params.slots.length}slots`;
  function verifyCurrent() {
    if (!isCurrent()) throw new Error("布局或拆件设置已修改，请重新导出");
  }
  await exportModelArtifactBundle(snapshot, async () => {
    const parts = await worker.generateManualSplitParts(snapshot, true);
    verifyCurrent();
    const files = await Promise.all(parts.map(({ id, geometry }) =>
      worker.exportSTL(geometry, `${label}_part_${id.replaceAll(".", "-")}.stl`, true),
    ));
    verifyCurrent();
    return { files, companionParamFilename: `${label}_parts.json` };
  }, download);
}
