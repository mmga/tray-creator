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
  "stepped-cad": SteppedLayoutParams;
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
