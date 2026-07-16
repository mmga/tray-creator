import type { TrayParams } from "@/types/tray";
import type {
  AppMode,
  BaseConverterParams,
  CustomLayoutParams,
  SimpleSteppedLayoutParams,
  SteppedLayoutParams,
} from "@/types/custom-tray";
import {
  CURRENT_PARAM_ARTIFACT_VERSION,
  buildCurrentParamArtifact,
  createCurrentParamArtifactBlob,
  serializeCurrentParamArtifact,
  type CurrentParamArtifact,
} from "@/lib/current-param-artifact-encoder";
import {
  captureModeParamSnapshot,
  type ExportableParams,
  type ParamsByMode,
} from "@/lib/mode-param-snapshot";
import {
  migrateCustomParamsToStepped,
  normalizeParamsForMode,
} from "@/lib/param-normalization";
import {
  createImportNormalizationRecorder,
  recordBehaviorChange,
  type ImportNormalizationReport,
} from "@/lib/param-import-report";

export type { ExportableParams, ParamsByMode } from "@/lib/mode-param-snapshot";

export type ParamFile = CurrentParamArtifact;

const CURRENT_VERSION = CURRENT_PARAM_ARTIFACT_VERSION;
const APP_MODES: readonly AppMode[] = [
  "grid",
  "custom",
  "base-converter",
  "simple-stepped",
  "stepped",
  "stepped-cad",
];

export const APP_MODE_LABELS: Record<AppMode, string> = {
  grid: "网格",
  custom: "自定义",
  "base-converter": "转换底盘",
  "simple-stepped": "简易阶梯",
  stepped: "普通阶梯",
  "stepped-cad": "CAD 阶梯",
};

export interface ImportCandidate {
  fileName: string;
  targetMode: AppMode;
  params: ExportableParams;
  report: ImportNormalizationReport;
}

export interface ImportModeSelectionRequired {
  status: "mode-selection-required";
  fileName: string;
  choices: AppMode[];
  message: string;
}

export type ParamImportPreparation =
  | { status: "ready"; candidate: ImportCandidate }
  | ImportModeSelectionRequired;

function resolveParamMode(mode: AppMode): AppMode {
  return mode === "stepped-cad" ? "stepped" : mode;
}

export function buildParamFile(
  mode: AppMode,
  params: ExportableParams,
): ParamFile {
  return buildCurrentParamArtifact(
    captureModeParamSnapshot(mode, params as ParamsByMode[typeof mode]),
  );
}

export function serializeParamFile(
  mode: AppMode,
  params: ExportableParams,
): string {
  return serializeCurrentParamArtifact(
    captureModeParamSnapshot(mode, params as ParamsByMode[typeof mode]),
  );
}

export function createParamBlob(mode: AppMode, params: ExportableParams): Blob {
  return createCurrentParamArtifactBlob(
    captureModeParamSnapshot(mode, params as ParamsByMode[typeof mode]),
  );
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

function isAppMode(value: unknown): value is AppMode {
  return typeof value === "string" && APP_MODES.includes(value as AppMode);
}

function cloneJsonValue<T>(value: T): T {
  return typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value)) as T;
}

function detectModesFromParamShape(data: Record<string, unknown>): AppMode[] {
  if (
    typeof data.sourceStandardId === "string" &&
    typeof data.targetStandardId === "string"
  ) {
    return ["base-converter"];
  }
  if (
    typeof data.rows === "number" &&
    typeof data.columns === "number"
  ) {
    return ["grid"];
  }
  if (Array.isArray(data.groups) && Array.isArray(data.slots)) {
    return ["stepped", "stepped-cad"];
  }
  if (Array.isArray(data.rows) && Array.isArray(data.slots)) {
    return ["simple-stepped"];
  }
  if (Array.isArray(data.slots)) {
    return ["custom"];
  }
  return [];
}

function createImportCandidate(
  rawParams: Record<string, unknown>,
  targetMode: AppMode,
  modeResolution: ImportNormalizationReport["modeResolution"],
  fileName: string,
): ImportCandidate {
  const params = cloneJsonValue(rawParams) as unknown as ExportableParams;
  const { recorder, adjustments, retiredFields } =
    createImportNormalizationRecorder();

  if (modeResolution.kind !== "declared") {
    recordBehaviorChange(recorder, {
      path: "mode",
      label: "导入目标 Mode",
      previousValue: undefined,
      normalizedValue: targetMode,
      reason: modeResolution.message,
    });
  }

  const normalized = normalizeParamsForMode(targetMode, params, recorder);
  return {
    fileName,
    targetMode,
    params: normalized,
    report: {
      modeResolution,
      adjustments,
      retiredFields,
    },
  };
}

export function prepareParamFileObject(
  data: unknown,
  options: { fileName?: string; selectedMode?: AppMode } = {},
): ParamImportPreparation {
  if (!data || typeof data !== "object") {
    throw new Error("文件内容无效");
  }

  const fileName = options.fileName ?? "参数文件";
  const rawData = data as Record<string, unknown>;
  let rawParams: Record<string, unknown>;
  let choices: AppMode[];
  let declaredMode: AppMode | null = null;

  if (hasWrappedParamFileShape(rawData)) {
    if (rawData.version !== CURRENT_VERSION) {
      throw new Error(`不支持的版本号: ${String(rawData.version)}`);
    }
    if (!isAppMode(rawData.mode)) {
      throw new Error("参数文件缺少有效的 Mode");
    }
    if (!rawData.params || typeof rawData.params !== "object") {
      throw new Error("参数文件缺少有效的 params");
    }

    declaredMode = rawData.mode;
    rawParams = rawData.params as Record<string, unknown>;
    const detectedModes = detectModesFromParamShape(rawParams);
    const compatibleDeclaredModes = declaredMode === "stepped"
      ? ["stepped", "stepped-cad"]
      : [declaredMode];
    if (
      detectedModes.length > 0 &&
      !detectedModes.some((mode) => compatibleDeclaredModes.includes(mode))
    ) {
      throw new Error(
        `声明 Mode「${APP_MODE_LABELS[declaredMode]}」与参数结构不一致`,
      );
    }
    choices = declaredMode === "stepped"
      ? ["stepped", "stepped-cad"]
      : [declaredMode];
  } else {
    rawParams = rawData;
    choices = detectModesFromParamShape(rawParams);
    if (choices.length === 0) {
      throw new Error("无法从旧参数结构识别所属 Mode");
    }
  }

  if (choices.length > 1 && !options.selectedMode) {
    return {
      status: "mode-selection-required",
      fileName,
      choices,
      message: declaredMode === "stepped"
        ? "历史阶梯文件没有区分普通阶梯与 CAD 阶梯，请选择原始 Mode"
        : "旧参数结构可能属于多个 Mode，请选择文件原本所属的 Mode",
    };
  }

  const targetMode = options.selectedMode ?? choices[0];
  if (!choices.includes(targetMode)) {
    throw new Error(`所选 Mode「${APP_MODE_LABELS[targetMode]}」与参数结构不一致`);
  }

  const kind = options.selectedMode
    ? "selected"
    : declaredMode
      ? "declared"
      : "inferred";
  const message = kind === "selected"
    ? `已按用户选择识别为「${APP_MODE_LABELS[targetMode]}」`
    : kind === "inferred"
      ? `文件未声明 Mode，已根据参数结构识别为「${APP_MODE_LABELS[targetMode]}」`
      : `文件声明为「${APP_MODE_LABELS[targetMode]}」`;

  return {
    status: "ready",
    candidate: createImportCandidate(
      rawParams,
      targetMode,
      { kind, targetMode, message },
      fileName,
    ),
  };
}

export function prepareParamImport(
  file: File,
  selectedMode?: AppMode,
): Promise<ParamImportPreparation> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = reader.result as string;
        const data = JSON.parse(text);
        resolve(prepareParamFileObject(data, {
          fileName: file.name,
          selectedMode,
        }));
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    };
    reader.onerror = () => reject(new Error("文件读取失败"));
    reader.readAsText(file);
  });
}

export function parseParamFileObject<M extends AppMode>(
  data: unknown,
  expectedMode: M,
): ParamsByMode[M];
export function parseParamFileObject(
  data: unknown,
  expectedMode: AppMode,
):
  | TrayParams
  | CustomLayoutParams
  | BaseConverterParams
  | SimpleSteppedLayoutParams
  | SteppedLayoutParams {
  if (!data || typeof data !== "object") {
    throw new Error("文件内容无效");
  }

  const rawData = data as Record<string, unknown>;
  const resolvedExpectedMode = resolveParamMode(expectedMode);

  if (!hasWrappedParamFileShape(rawData)) {
    if (resolvedExpectedMode === "stepped" && isLegacyCustomParamObject(rawData)) {
      return migrateCustomParamsToStepped(rawData as CustomLayoutParams);
    }
    return normalizeParamsForMode(
      resolvedExpectedMode,
      rawData as ExportableParams,
    );
  }

  const paramFile = rawData as unknown as ParamFile;
  if (paramFile.version !== CURRENT_VERSION) {
    throw new Error(`不支持的版本号: ${paramFile.version}`);
  }

  if (paramFile.mode === "custom" && resolvedExpectedMode === "stepped") {
    const customParams = paramFile.params as CustomLayoutParams;
    return migrateCustomParamsToStepped(customParams);
  }

  const isCadIdentityMismatch =
    paramFile.mode === "stepped-cad" && expectedMode !== "stepped-cad";
  if (
    isCadIdentityMismatch ||
    resolveParamMode(paramFile.mode) !== resolvedExpectedMode
  ) {
    const modeNames: Record<string, string> = {
      grid: "网格",
      custom: "自定义",
      "base-converter": "转换底盘",
      "simple-stepped": "简易阶梯",
      stepped: "自定义阶梯底座",
      "stepped-cad": "CAD 阶梯底座",
    };
    throw new Error(
      `模式不匹配：文件为「${modeNames[paramFile.mode] || paramFile.mode}」模式，当前为「${modeNames[expectedMode] || expectedMode}」模式`,
    );
  }

  return normalizeParamsForMode(resolvedExpectedMode, paramFile.params);
}

export function importParams<M extends AppMode>(
  file: File,
  expectedMode: M,
): Promise<ParamsByMode[M]>;
export function importParams(
  file: File,
  expectedMode: AppMode,
): Promise<
  TrayParams | BaseConverterParams | CustomLayoutParams | SimpleSteppedLayoutParams | SteppedLayoutParams
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
