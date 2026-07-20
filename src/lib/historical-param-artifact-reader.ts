import type { AppMode } from "@/types/custom-tray";
import {
  CURRENT_PARAM_ARTIFACT_VERSION,
  type CurrentParamArtifact,
} from "@/lib/current-param-artifact-encoder";
import {
  type ExportableParams,
  type ParamsByMode,
} from "@/lib/mode-param-snapshot";
import { normalizeParamsForMode } from "@/lib/param-normalization";
import {
  createImportNormalizationRecorder,
  recordBehaviorChange,
  type ImportNormalizationReport,
} from "@/lib/param-import-report";

type HistoricalMode = AppMode | "stepped-cad";

const HISTORICAL_MODES: readonly HistoricalMode[] = [
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
  stepped: "自定义阶梯",
};

function getModeLabel(mode: HistoricalMode): string {
  return mode === "stepped-cad" ? "CAD 阶梯" : APP_MODE_LABELS[mode];
}

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

export type ParamArtifactReadErrorCode =
  | "invalid-content"
  | "unsupported-version"
  | "invalid-mode"
  | "invalid-params"
  | "unrecognized-structure"
  | "mode-structure-conflict"
  | "mode-mismatch"
  | "normalization-failed";

export class ParamArtifactReadError extends Error {
  constructor(
    readonly code: ParamArtifactReadErrorCode,
    message: string,
    options: { cause?: unknown } = {},
  ) {
    super(message, options);
    this.name = "ParamArtifactReadError";
  }
}

interface DecodedParamArtifact {
  rawParams: Record<string, unknown>;
  declaredMode: HistoricalMode | null;
  detectedModes: AppMode[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasWrappedParamFileShape(
  data: Record<string, unknown>,
): data is Record<keyof CurrentParamArtifact, unknown> {
  return "version" in data || "mode" in data || "params" in data;
}

function isHistoricalMode(value: unknown): value is HistoricalMode {
  return typeof value === "string" && HISTORICAL_MODES.includes(value as HistoricalMode);
}

function cloneParamValue(value: Record<string, unknown>): ExportableParams {
  return (typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value))) as ExportableParams;
}

function detectModesFromParamShape(data: Record<string, unknown>): AppMode[] {
  if (
    typeof data.sourceStandardId === "string" &&
    typeof data.targetStandardId === "string"
  ) {
    return ["base-converter"];
  }
  if (typeof data.rows === "number" && typeof data.columns === "number") {
    return ["grid"];
  }
  if (Array.isArray(data.groups) && Array.isArray(data.slots)) {
    return ["stepped"];
  }
  if (Array.isArray(data.rows) && Array.isArray(data.slots)) {
    return ["simple-stepped"];
  }
  if (
    Array.isArray(data.slots) &&
    (
      typeof data.activeGroupId === "string" ||
      typeof data.bridgeRadius === "number" ||
      data.slots.some(
        (slot) => isRecord(slot) && typeof slot.bottomHeight === "number",
      )
    )
  ) {
    return ["stepped"];
  }
  if (Array.isArray(data.slots)) {
    return ["custom"];
  }
  return [];
}

function compatibleModesForDeclaredMode(mode: HistoricalMode): AppMode[] {
  return mode === "stepped" || mode === "stepped-cad" ? ["stepped"] : [mode];
}

function applyHistoricalSteppedCapabilityDefault(
  rawParams: Record<string, unknown>,
  targetMode: AppMode,
  declaredMode: HistoricalMode | null,
): Record<string, unknown> {
  if (
    targetMode !== "stepped" ||
    typeof rawParams.enableSplitAssembly === "boolean"
  ) {
    return rawParams;
  }

  return {
    ...rawParams,
    enableSplitAssembly: declaredMode === "stepped-cad",
  };
}

function decodeParamArtifact(data: unknown): DecodedParamArtifact {
  if (!isRecord(data)) {
    throw new ParamArtifactReadError("invalid-content", "文件内容无效");
  }

  if (!hasWrappedParamFileShape(data)) {
    return {
      rawParams: data,
      declaredMode: null,
      detectedModes: detectModesFromParamShape(data),
    };
  }

  if (data.version !== CURRENT_PARAM_ARTIFACT_VERSION) {
    throw new ParamArtifactReadError(
      "unsupported-version",
      `不支持的版本号: ${String(data.version)}`,
    );
  }
  if (!isHistoricalMode(data.mode)) {
    throw new ParamArtifactReadError(
      "invalid-mode",
      "参数文件缺少有效的 Mode",
    );
  }
  if (!isRecord(data.params)) {
    throw new ParamArtifactReadError(
      "invalid-params",
      "参数文件缺少有效的 params",
    );
  }

  const detectedModes = detectModesFromParamShape(data.params);
  if (
    detectedModes.length > 0 &&
    !detectedModes.some((mode) =>
      compatibleModesForDeclaredMode(data.mode as HistoricalMode).includes(mode),
    )
  ) {
    throw new ParamArtifactReadError(
      "mode-structure-conflict",
      `声明 Mode「${getModeLabel(data.mode as HistoricalMode)}」与参数结构不一致`,
    );
  }

  return {
    rawParams: data.params,
    declaredMode: data.mode as HistoricalMode,
    detectedModes,
  };
}

function normalizeForMode<M extends AppMode>(
  mode: M,
  rawParams: Record<string, unknown>,
  recorder?: Parameters<typeof normalizeParamsForMode>[2],
): ParamsByMode[M] {
  try {
    return normalizeParamsForMode(
      mode,
      cloneParamValue(rawParams),
      recorder,
    ) as ParamsByMode[M];
  } catch (error) {
    if (error instanceof ParamArtifactReadError) {
      throw error;
    }
    throw new ParamArtifactReadError(
      "normalization-failed",
      error instanceof Error ? error.message : "参数规范化失败",
      { cause: error },
    );
  }
}

function createImportCandidate(
  rawParams: Record<string, unknown>,
  targetMode: AppMode,
  declaredMode: HistoricalMode | null,
  modeResolution: ImportNormalizationReport["modeResolution"],
  fileName: string,
): ImportCandidate {
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

  return {
    fileName,
    targetMode,
    params: normalizeForMode(
      targetMode,
      applyHistoricalSteppedCapabilityDefault(
        rawParams,
        targetMode,
        declaredMode,
      ),
      recorder,
    ),
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
  const fileName = options.fileName ?? "参数文件";
  const decoded = decodeParamArtifact(data);
  const choices = decoded.declaredMode
    ? compatibleModesForDeclaredMode(decoded.declaredMode)
    : decoded.detectedModes;

  if (choices.length === 0) {
    throw new ParamArtifactReadError(
      "unrecognized-structure",
      "无法从旧参数结构识别所属 Mode",
    );
  }

  if (choices.length > 1 && !options.selectedMode) {
    return {
      status: "mode-selection-required",
      fileName,
      choices,
      message: "旧参数结构可能属于多个 Mode，请选择文件原本所属的 Mode",
    };
  }

  const targetMode = options.selectedMode ?? choices[0];
  if (!choices.includes(targetMode)) {
    throw new ParamArtifactReadError(
      "mode-structure-conflict",
      `所选 Mode「${APP_MODE_LABELS[targetMode]}」与参数结构不一致`,
    );
  }

  const kind = options.selectedMode
    ? "selected"
    : decoded.declaredMode
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
      decoded.rawParams,
      targetMode,
      decoded.declaredMode,
      { kind, targetMode, message },
      fileName,
    ),
  };
}

export function readDraftParamArtifact<M extends AppMode>(
  data: unknown,
  expectedMode: M,
): ParamsByMode[M] {
  const decoded = decodeParamArtifact(data);

  if (
    decoded.declaredMode &&
    !compatibleModesForDeclaredMode(decoded.declaredMode).includes(expectedMode)
  ) {
    throw new ParamArtifactReadError(
      "mode-mismatch",
      `模式不匹配：文件为「${getModeLabel(decoded.declaredMode)}」模式，当前为「${APP_MODE_LABELS[expectedMode]}」模式`,
    );
  }
  if (
    decoded.detectedModes.length > 0 &&
    !decoded.detectedModes.includes(expectedMode)
  ) {
    throw new ParamArtifactReadError(
      "mode-mismatch",
      `模式不匹配：参数结构不属于「${APP_MODE_LABELS[expectedMode]}」模式`,
    );
  }

  return normalizeForMode(
    expectedMode,
    applyHistoricalSteppedCapabilityDefault(
      decoded.rawParams,
      expectedMode,
      decoded.declaredMode,
    ),
  );
}
