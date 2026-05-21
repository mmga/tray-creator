import type { TrayParams } from "@/types/tray";
import type {
  AppMode,
  CustomLayoutParams,
  SimpleSteppedLayoutParams,
  SteppedLayoutParams,
} from "@/types/custom-tray";
import {
  migrateCustomParamsToStepped,
  normalizeParamsForMode,
} from "@/lib/param-normalization";

export type ExportableParams =
  | TrayParams
  | CustomLayoutParams
  | SimpleSteppedLayoutParams
  | SteppedLayoutParams;

interface ParamFile {
  version: number;
  mode: AppMode;
  params: ExportableParams;
}

const CURRENT_VERSION = 1;

function precisionReplacer(_key: string, value: unknown) {
  if (typeof value === "number") {
    return Math.round(value * 1000) / 1000;
  }
  return value;
}

export function buildParamFile(
  mode: AppMode,
  params: ExportableParams,
): ParamFile {
  return { version: CURRENT_VERSION, mode, params };
}

export function serializeParamFile(
  mode: AppMode,
  params: ExportableParams,
): string {
  return JSON.stringify(buildParamFile(mode, params), precisionReplacer, 2);
}

export function createParamBlob(mode: AppMode, params: ExportableParams): Blob {
  return new Blob([serializeParamFile(mode, params)], {
    type: "application/json",
  });
}

export function downloadParamFile(
  mode: AppMode,
  params: ExportableParams,
  filename: string = `tray-${mode}-config.json`,
) {
  const blob = createParamBlob(mode, params);
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function exportParams(mode: AppMode, params: ExportableParams) {
  downloadParamFile(mode, params);
}

function hasWrappedParamFileShape(
  data: Record<string, unknown>,
): data is Record<keyof ParamFile, unknown> {
  return "version" in data || "mode" in data || "params" in data;
}

function isLegacyCustomParamObject(data: Record<string, unknown>) {
  return (
    Array.isArray(data.slots) &&
    !Array.isArray(data.groups) &&
    !Array.isArray(data.rows)
  );
}

export function parseParamFileObject(
  data: unknown,
  expectedMode: AppMode,
):
  | TrayParams
  | CustomLayoutParams
  | SimpleSteppedLayoutParams
  | SteppedLayoutParams {
  if (!data || typeof data !== "object") {
    throw new Error("文件内容无效");
  }

  const rawData = data as Record<string, unknown>;

  if (!hasWrappedParamFileShape(rawData)) {
    if (expectedMode === "stepped" && isLegacyCustomParamObject(rawData)) {
      return migrateCustomParamsToStepped(rawData as CustomLayoutParams);
    }
    return normalizeParamsForMode(expectedMode, rawData as ExportableParams);
  }

  const paramFile = rawData as unknown as ParamFile;
  if (paramFile.version !== CURRENT_VERSION) {
    throw new Error(`不支持的版本号: ${paramFile.version}`);
  }

  if (paramFile.mode === "custom" && expectedMode === "stepped") {
    const customParams = paramFile.params as CustomLayoutParams;
    return migrateCustomParamsToStepped(customParams);
  }

  if (paramFile.mode !== expectedMode) {
    const modeNames: Record<string, string> = {
      grid: "网格",
      custom: "自定义",
      "simple-stepped": "简易阶梯",
      stepped: "自定义阶梯底座",
    };
    throw new Error(
      `模式不匹配：文件为「${modeNames[paramFile.mode] || paramFile.mode}」模式，当前为「${modeNames[expectedMode] || expectedMode}」模式`,
    );
  }

  return normalizeParamsForMode(expectedMode, paramFile.params);
}

export function importParams(
  file: File,
  expectedMode: AppMode,
): Promise<
  TrayParams | CustomLayoutParams | SimpleSteppedLayoutParams | SteppedLayoutParams
> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = reader.result as string;
        const data = JSON.parse(text);
        resolve(parseParamFileObject(data, expectedMode));
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    };
    reader.onerror = () => reject(new Error("文件读取失败"));
    reader.readAsText(file);
  });
}
