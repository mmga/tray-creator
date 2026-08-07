import type { AppMode } from "@/types/custom-tray";
import {
  CURRENT_PARAM_ARTIFACT_VERSION,
  type CurrentParamArtifact,
} from "@/lib/current-param-artifact-encoder";
import {
  captureModeParamSnapshot,
  type ModeParamSnapshot,
  type ParamsByMode,
} from "@/lib/mode-param-snapshot";
import { normalizeParamsForMode } from "@/lib/param-normalization";
import {
  createImportNormalizationRecorder,
  recordBehaviorChange,
  type ImportNormalizationRecorder,
  type ImportNormalizationReport,
} from "@/lib/param-import-report";
import { convertSimpleSteppedToStepped } from "@/lib/simple-stepped-to-stepped";
import type { SimpleSteppedLayoutParams } from "@/types/custom-tray";

type HistoricalMode = AppMode | "simple-stepped" | "stepped-cad";

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
  stepped: "自定义阶梯",
};

function getModeLabel(mode: HistoricalMode): string {
  if (mode === "stepped-cad") return "CAD 阶梯";
  if (mode === "simple-stepped") return "简易阶梯";
  return APP_MODE_LABELS[mode];
}

type ImportCandidateForMode<M extends AppMode> = {
  fileName: string;
  mode: M;
  snapshot: ModeParamSnapshot<M>;
  report: ImportNormalizationReport;
};

export type ImportCandidate = {
  [M in AppMode]: ImportCandidateForMode<M>;
}[AppMode];

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

function cloneParamValue<M extends AppMode>(
  value: Record<string, unknown>,
): ParamsByMode[M] {
  return (typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value))) as ParamsByMode[M];
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
  // 历史 simple-stepped 结构（rows[] + slots[]）现在统一识别为 stepped（CONTEXT:580-583,609-610）
  // simple-stepped 不再是独立的用户可选 Mode
  if (Array.isArray(data.rows) && Array.isArray(data.slots)) {
    return ["stepped"];
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

/**
 * 判定参数结构是否为历史 simple-stepped（行 + 行内槽位）。
 * 用于在目标 mode 已解析为 stepped 时，决定是否调用 simple-stepped → stepped 转换器。
 */
function isSimpleSteppedStructure(data: Record<string, unknown>): boolean {
  return Array.isArray(data.rows) && Array.isArray(data.slots)
    && !Array.isArray(data.groups);
}

function compatibleModesForDeclaredMode(mode: HistoricalMode): AppMode[] {
  // simple-stepped 作为历史别名读取时直接归一到 stepped（CONTEXT:583,609-610）
  if (mode === "stepped" || mode === "stepped-cad" || mode === "simple-stepped") {
    return ["stepped"];
  }
  return [mode];
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
  recorder?: ImportNormalizationRecorder,
): ParamsByMode[M] {
  try {
    return normalizeParamsForMode(
      mode,
      cloneParamValue<M>(rawParams),
      recorder,
    );
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

/**
 * 若原始结构是 simple-stepped，先转换为 stepped 参数；否则原样返回。
 * 转换会在 Import Normalization Report 中记录一次行为变化（CONTEXT:580,583）。
 */
function applySimpleSteppedConversionIfNeeded(
  rawParams: Record<string, unknown>,
  targetMode: AppMode,
  recorder?: ImportNormalizationRecorder,
): Record<string, unknown> {
  if (targetMode !== "stepped" || !isSimpleSteppedStructure(rawParams)) {
    return rawParams;
  }
  const conversion = convertSimpleSteppedToStepped(
    rawParams as unknown as SimpleSteppedLayoutParams,
  );
  recordBehaviorChange(recorder, {
    path: "mode",
    label: "历史简易阶梯转换",
    previousValue: "simple-stepped",
    normalizedValue: "stepped",
    reason: `历史 simple-stepped 已转换为 stepped：${conversion.report.groupCount} 个高度分组、${conversion.report.slotCount} 个槽位${
      conversion.report.emptyRowCount > 0
        ? `（跳过 ${conversion.report.emptyRowCount} 个空行）`
        : ""
    }`,
  });
  return conversion.params as unknown as Record<string, unknown>;
}

function createImportCandidateForMode<M extends AppMode>(
  rawParams: Record<string, unknown>,
  targetMode: M,
  declaredMode: HistoricalMode | null,
  modeResolution: ImportNormalizationReport["modeResolution"],
  fileName: string,
): ImportCandidateForMode<M> {
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

  const afterConversion = applySimpleSteppedConversionIfNeeded(
    rawParams,
    targetMode,
    recorder,
  );

  const params = normalizeForMode(
    targetMode,
    applyHistoricalSteppedCapabilityDefault(
      afterConversion,
      targetMode,
      declaredMode,
    ),
    recorder,
  );

  return {
    fileName,
    mode: targetMode,
    snapshot: captureModeParamSnapshot(targetMode, params),
    report: {
      modeResolution,
      adjustments,
      retiredFields,
    },
  };
}

function createImportCandidate(
  rawParams: Record<string, unknown>,
  targetMode: AppMode,
  declaredMode: HistoricalMode | null,
  modeResolution: ImportNormalizationReport["modeResolution"],
  fileName: string,
): ImportCandidate {
  switch (targetMode) {
    case "grid":
      return createImportCandidateForMode(
        rawParams,
        "grid",
        declaredMode,
        modeResolution,
        fileName,
      );
    case "custom":
      return createImportCandidateForMode(
        rawParams,
        "custom",
        declaredMode,
        modeResolution,
        fileName,
      );
    case "base-converter":
      return createImportCandidateForMode(
        rawParams,
        "base-converter",
        declaredMode,
        modeResolution,
        fileName,
      );
    case "stepped":
      return createImportCandidateForMode(
        rawParams,
        "stepped",
        declaredMode,
        modeResolution,
        fileName,
      );
  }
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
      applySimpleSteppedConversionIfNeeded(decoded.rawParams, expectedMode),
      expectedMode,
      decoded.declaredMode,
    ),
  );
}
