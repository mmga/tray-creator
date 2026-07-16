"use client";

import {
  useSteppedCadSplitOrchestration,
  type UseSteppedCadSplitOrchestrationReturn,
} from "@/hooks/useSteppedCadSplitOrchestration";
import { useSteppedLayoutController } from "@/hooks/useSteppedLayoutController";
import type { UseSteppedLayoutControllerReturn } from "@/hooks/useSteppedLayoutController";
import {
  exportSteppedCadSplitPartFiles,
  exportSteppedCadModelFiles,
  generateSteppedCadSplitPreview,
  generateSteppedCadPreview,
} from "@/lib/stepped-cad-model-service";
import { captureModeParamSnapshot } from "@/lib/mode-param-snapshot";
import type { Geom3 } from "@jscad/modeling/src/geometries/types";
import type { SteppedLayoutParams } from "@/types/custom-tray";
import type {
  DownloadPort,
  SteppedCadWorkerPort,
} from "@/lib/model-ports";
import type { SteppedLayoutExtents } from "@/lib/stepped-layout-math";

const exportSteppedCadModelSnapshot = (
  params: SteppedLayoutParams,
  effectiveDimensions: SteppedLayoutExtents,
  geometry: Geom3,
  workerPort: SteppedCadWorkerPort,
  downloadPort: DownloadPort,
) =>
  exportSteppedCadModelFiles(
    captureModeParamSnapshot("stepped-cad", params),
    effectiveDimensions,
    geometry,
    workerPort,
    downloadPort,
  );

const exportSteppedCadSplitSnapshot = (
  params: SteppedLayoutParams,
  effectiveDimensions: SteppedLayoutExtents,
  workerPort: SteppedCadWorkerPort,
  downloadPort: DownloadPort,
) =>
  exportSteppedCadSplitPartFiles(
    captureModeParamSnapshot("stepped-cad", params),
    effectiveDimensions,
    workerPort,
    downloadPort,
  );

export type UseSteppedCadLayoutReturn = UseSteppedLayoutControllerReturn &
  UseSteppedCadSplitOrchestrationReturn;

export function useSteppedCadLayout(): UseSteppedCadLayoutReturn {
  const coreModel = useSteppedLayoutController({
    generatePreview: generateSteppedCadPreview,
    exportModel: exportSteppedCadModelSnapshot,
  });
  const splitModel = useSteppedCadSplitOrchestration({
    params: coreModel.params,
    generateSplitPreview: generateSteppedCadSplitPreview,
    exportSplitParts: exportSteppedCadSplitSnapshot,
  });

  return {
    ...coreModel,
    ...splitModel,
  };
}
