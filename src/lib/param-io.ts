import type { AppMode } from "@/types/custom-tray";
import {
  ParamArtifactReadError,
  prepareParamFileObject,
  type ParamImportPreparation,
} from "@/lib/historical-param-artifact-reader";

function readJsonFile(file: File): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
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
    reader.onerror = () => reject(new ParamArtifactReadError(
      "invalid-content",
      "文件读取失败",
      { cause: reader.error },
    ));
    reader.readAsText(file);
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
