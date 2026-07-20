import type { TrayParams } from "@/types/tray";
import type {
  AppMode,
  BaseConverterParams,
  CustomLayoutParams,
  SimpleSteppedLayoutParams,
  SteppedLayoutParams,
} from "@/types/custom-tray";

export type ParamsByMode = {
  grid: TrayParams;
  custom: CustomLayoutParams;
  "base-converter": BaseConverterParams;
  "simple-stepped": SimpleSteppedLayoutParams;
  stepped: SteppedLayoutParams;
};

export type ExportableParams = ParamsByMode[AppMode];

/**
 * 一次持久化操作使用的稳定 Mode 参数快照。
 *
 * 参数在捕获时复制，避免后续编辑影响异步模型导出及其伴随参数文件。
 */
export interface ModeParamSnapshot<M extends AppMode = AppMode> {
  readonly mode: M;
  readonly params: ParamsByMode[M];
}

export function captureModeParamSnapshot<M extends AppMode>(
  mode: M,
  params: ParamsByMode[M],
): ModeParamSnapshot<M> {
  return {
    mode,
    params: structuredClone(params),
  };
}

function canonicalizeFingerprintValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalizeFingerprintValue);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entryValue]) => [
          key,
          canonicalizeFingerprintValue(entryValue),
        ]),
    );
  }
  return value;
}

/**
 * 标识缓存几何由哪一个 Mode Param Snapshot 生成。
 * 指纹仅存在于运行时，不进入持久化参数产物。
 */
export function createModelGeometryFingerprint<M extends AppMode>(
  snapshot: ModeParamSnapshot<M>,
): string {
  return JSON.stringify(canonicalizeFingerprintValue(snapshot));
}
