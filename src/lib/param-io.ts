import type { AppMode } from "@/types/custom-tray";
import {
  ParamArtifactReadError,
  prepareParamFileObject,
  type ParamImportPreparation,
} from "@/lib/historical-param-artifact-reader";

export const MAX_PARAM_FILE_BYTES = 5 * 1024 * 1024;

export class ParamFileSourceError extends Error {
  constructor(
    readonly code: "file-too-large",
    message: string,
  ) {
    super(message);
    this.name = "ParamFileSourceError";
  }
}

function readJsonFile(file: File): Promise<unknown> {
  if (file.size > MAX_PARAM_FILE_BYTES) {
    return Promise.reject(new ParamFileSourceError(
      "file-too-large",
      "参数文件不能超过 5 MiB",
    ));
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const cleanup = () => {
      reader.onload = null;
      reader.onerror = null;
      reader.onabort = null;
    };

    reader.onload = () => {
      cleanup();
      try {
        resolve(JSON.parse(reader.result as string));
      } catch (error) {
        reject(new ParamArtifactReadError(
          "invalid-content",
          "文件内容不是有效的 JSON",
          { cause: error },
        ));
      }
    };
    reader.onerror = () => {
      const cause = reader.error;
      cleanup();
      reject(new ParamArtifactReadError(
        "invalid-content",
        "文件读取失败",
        { cause },
      ));
    };
    reader.onabort = () => {
      cleanup();
      reject(new ParamArtifactReadError(
        "invalid-content",
        "文件读取已取消",
      ));
    };

    try {
      reader.readAsText(file);
    } catch (error) {
      cleanup();
      reject(new ParamArtifactReadError(
        "invalid-content",
        "文件读取失败",
        { cause: error },
      ));
    }
  });
}

export async function prepareParamImport(
  file: File,
  selectedMode?: AppMode,
): Promise<ParamImportPreparation> {
  const data = await readJsonFile(file);
  return prepareParamFileObject(data, {
    fileName: file.name,
    selectedMode,
  });
}
