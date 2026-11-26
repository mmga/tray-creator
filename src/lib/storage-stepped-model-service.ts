import type { Geom3 } from "@jscad/modeling/src/geometries/types";
import type * as THREE from "three";
import type { ModeParamSnapshot } from "@/lib/mode-param-snapshot";
import type {
  DownloadPort,
  StorageSteppedPartResult,
  StorageSteppedWorkerPort,
} from "@/lib/model-ports";
import { exportModelArtifactBundle } from "@/lib/model-artifact-bundle";
import {
  STORAGE_STEPPED_BODY_PART_ID,
  storageSteppedPartFileStem,
  storageSteppedPartLabel,
  storageSteppedTrayPartId,
} from "@/lib/storage-stepped-config";
import {
  getStorageSteppedBlockingReason,
  getStorageSteppedExpectedPartIds,
  getStorageSteppedPartBlockingReason,
  validateStorageSteppedParams,
} from "@/lib/storage-stepped-plan";
import type { StorageSteppedParams } from "@/types/storage-stepped";
import { loadThreeGeometry } from "@/lib/three-geometry-loader";

export interface StorageSteppedPartPreview extends StorageSteppedPartResult {
  threeGeometry: THREE.BufferGeometry;
}

export async function generateStorageSteppedPartPreview(
  params: StorageSteppedParams,
  partId: string,
  workerPort: StorageSteppedWorkerPort,
): Promise<StorageSteppedPartPreview> {
  const result = await workerPort.generateStorageSteppedPart(params, partId);
  return {
    ...result,
    threeGeometry: await loadThreeGeometry(result.geometry),
  };
}

export function getStorageSteppedStlFilename(
  params: StorageSteppedParams,
  partId: string,
): string {
  return `${storageSteppedPartFileStem(params, partId)}.stl`;
}

export function getStorageSteppedParamsFilename(
  params: StorageSteppedParams,
): string {
  return `${storageSteppedPartFileStem(params, STORAGE_STEPPED_BODY_PART_ID).replace(
    /_body_/,
    "_params_",
  )}.json`;
}

function assertPartExportable(
  params: StorageSteppedParams,
  partId: string,
): void {
  const validation = validateStorageSteppedParams(params);
  const reason = getStorageSteppedPartBlockingReason(validation, partId);
  if (reason) {
    throw new Error(`${storageSteppedPartLabel(partId)}当前不可导出：${reason}`);
  }
}

function assertWholeExportable(params: StorageSteppedParams): void {
  const reason = getStorageSteppedBlockingReason(
    validateStorageSteppedParams(params),
  );
  if (reason) throw new Error(`整套模型当前不可导出：${reason}`);
}

async function generatePartGeometry(
  params: StorageSteppedParams,
  partId: string,
  workerPort: StorageSteppedWorkerPort,
): Promise<Geom3> {
  const result = await workerPort.generateStorageSteppedPart(params, partId);
  return result.geometry;
}

/** 单件导出：只要求该零件及其接口参数有效，不被无关托盘错误阻断。 */
export async function exportStorageSteppedPart(
  snapshot: ModeParamSnapshot<"storage-stepped">,
  partId: string,
  workerPort: StorageSteppedWorkerPort,
  downloadPort: DownloadPort,
): Promise<void> {
  const { params } = snapshot;
  assertPartExportable(params, partId);
  const filename = getStorageSteppedStlFilename(params, partId);
  await exportModelArtifactBundle(
    snapshot,
    async () => {
      const geometry = await generatePartGeometry(params, partId, workerPort);
      return {
        files: [await workerPort.exportSTL(geometry, filename, true)],
        companionParamFilename: filename.replace(/\.stl$/i, ".json"),
      };
    },
    downloadPort,
  );
}

/**
 * 整套导出：同一参数快照下生成主体与三块托盘的独立 STL，
 * 再加一份完整 JSON。任意零件准备失败时不触发任何下载。
 */
export async function exportStorageSteppedAllParts(
  snapshot: ModeParamSnapshot<"storage-stepped">,
  workerPort: StorageSteppedWorkerPort,
  downloadPort: DownloadPort,
): Promise<void> {
  const { params } = snapshot;
  assertWholeExportable(params);
  const partIds = getStorageSteppedExpectedPartIds(params);
  await exportModelArtifactBundle(
    snapshot,
    async () => {
      const files = await Promise.all(
        partIds.map(async (partId) => {
          const geometry = await generatePartGeometry(params, partId, workerPort);
          return workerPort.exportSTL(
            geometry,
            getStorageSteppedStlFilename(params, partId),
            true,
          );
        }),
      );
      return {
        files,
        companionParamFilename: getStorageSteppedParamsFilename(params),
      };
    },
    downloadPort,
  );
}

/** 当前阶托盘；不在阶数范围内时抛错。 */
export function getStorageSteppedCurrentTrayPartId(stepIndex: number): string {
  return storageSteppedTrayPartId(stepIndex);
}
