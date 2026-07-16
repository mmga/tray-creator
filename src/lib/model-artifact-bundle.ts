import { createCurrentParamArtifactBlob } from "@/lib/current-param-artifact-encoder";
import type { ModeParamSnapshot } from "@/lib/mode-param-snapshot";
import type { DownloadPort } from "@/lib/model-ports";
import type { AppMode } from "@/types/custom-tray";

export interface NamedModelArtifact {
  readonly blob: Blob;
  readonly filename: string;
}

export interface PreparedModeModelArtifacts {
  readonly files: readonly NamedModelArtifact[];
  readonly companionParamFilename: string;
}

export interface ModelArtifactDownloadFailure {
  readonly filename: string;
  readonly cause: unknown;
}

export class ModelArtifactDownloadError extends Error {
  readonly failures: readonly ModelArtifactDownloadFailure[];

  constructor(failures: readonly ModelArtifactDownloadFailure[]) {
    super(`有 ${failures.length} 个模型文件未能触发下载`);
    this.name = "ModelArtifactDownloadError";
    this.failures = failures;
  }
}

/**
 * 先完整准备同一次 Mode Param Snapshot 的全部文件，再按确定顺序触发下载。
 * Mode Implementation 只负责模型文件、文件名和可选清单内容；参数伴随文件由此 Module 统一编码。
 */
export async function exportModelArtifactBundle<M extends AppMode>(
  snapshot: ModeParamSnapshot<M>,
  prepareModeArtifacts: (
    snapshot: ModeParamSnapshot<M>,
  ) => Promise<PreparedModeModelArtifacts>,
  downloadPort: DownloadPort,
): Promise<void> {
  const prepared = await prepareModeArtifacts(snapshot);
  const files: readonly NamedModelArtifact[] = [
    ...prepared.files,
    {
      blob: createCurrentParamArtifactBlob(snapshot),
      filename: prepared.companionParamFilename,
    },
  ];

  const failures: ModelArtifactDownloadFailure[] = [];
  for (const file of files) {
    try {
      downloadPort.downloadBlob(file.blob, file.filename);
    } catch (cause) {
      failures.push({ filename: file.filename, cause });
    }
  }

  if (failures.length > 0) {
    throw new ModelArtifactDownloadError(failures);
  }
}
