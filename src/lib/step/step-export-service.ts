import type { FlatTraySnapshot } from "@/lib/manual-split-plan";
import { exportModelArtifactBundle } from "@/lib/model-artifact-bundle";
import { browserDownloadPort } from "@/lib/download-port";
import { getGridSTLFilename } from "@/lib/grid-model-service";
import { getCustomSTLFilename } from "@/lib/custom-layout-service";
import { requestStepExport } from "@/lib/worker/step-worker-service";
import type { StepScope } from "./step-capability";
import type { StepPhase } from "./step-protocol";
import { resolveStackableBoxParams } from "@/lib/stackable-box";
import { generateCustomBoxSTLFilename, generateGridBoxSTLFilename } from "@/lib/model-filenames";

export async function exportStepFiles(snapshot: FlatTraySnapshot, scope: StepScope,
  signal: AbortSignal, onPhase: (phase: StepPhase) => void) {
  await exportModelArtifactBundle(snapshot, async () => {
    const files = await requestStepExport({ snapshot, scope }, signal, onPhase);
    signal.throwIfAborted();
    const name = (snapshot.mode === "grid"
      ? getGridSTLFilename(snapshot.params) : getCustomSTLFilename(snapshot.params)).replace(/\.stl$/i, "");
    if (files.length === 0) throw new Error("没有可导出的 STEP 实体");
    const { enabled, outerWidth, outerDepth, outerHeight } = resolveStackableBoxParams(snapshot.params.stackableBox);
    const filename = (id?: string) => {
      if (enabled && (id === "body" || id === "lid")) {
        const boxName = snapshot.mode === "grid"
          ? generateGridBoxSTLFilename(outerWidth, outerDepth, outerHeight, snapshot.params.columns, snapshot.params.rows, id)
          : generateCustomBoxSTLFilename(outerWidth, outerDepth, outerHeight, snapshot.params.slots.length, id);
        return boxName.replace(/\.stl$/i, ".step");
      }
      return `${name}${id ? `_part_${id.replaceAll(".", "-")}` : ""}.step`;
    };
    return {
      files: files.map(({ id, bytes }) => ({
        filename: filename(id),
        blob: new Blob([bytes], { type: "application/step" }),
      })),
      companionParamFilename: enabled ? filename("body").replace(/\.step$/i, ".json")
        : `${name}${scope === "parts" ? "_parts" : ""}.json`,
    };
  }, browserDownloadPort);
}
