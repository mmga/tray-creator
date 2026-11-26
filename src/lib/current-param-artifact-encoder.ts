import type { AppMode } from "@/types/custom-tray";
import type {
  ModeParamSnapshot,
  ParamsByMode,
} from "@/lib/mode-param-snapshot";

export const CURRENT_PARAM_ARTIFACT_VERSION = 1;

export interface CurrentParamArtifact<M extends AppMode = AppMode> {
  version: typeof CURRENT_PARAM_ARTIFACT_VERSION;
  mode: M;
  params: ParamsByMode[M];
}

function precisionReplacer(_key: string, value: unknown) {
  if (typeof value === "number") {
    return Math.round(value * 1000) / 1000;
  }
  return value;
}

export function buildCurrentParamArtifact<M extends AppMode>(
  snapshot: ModeParamSnapshot<M>,
): CurrentParamArtifact<M> {
  const params = { ...snapshot.params } as ParamsByMode[M] & {
    enableBaseHole?: boolean;
  };
  delete params.enableBaseHole;
  return {
    version: CURRENT_PARAM_ARTIFACT_VERSION,
    mode: snapshot.mode,
    params,
  };
}

export function serializeCurrentParamArtifact<M extends AppMode>(
  snapshot: ModeParamSnapshot<M>,
  preservePrecision = false,
): string {
  const artifact = buildCurrentParamArtifact(snapshot);
  // 收纳阶梯的槽位可能正好贴合边距，分割线也依赖原始几何精度。
  const preserveGeometry = preservePrecision || snapshot.mode === "storage-stepped" ||
    ("manualSplit" in artifact.params && artifact.params.manualSplit !== undefined);
  return JSON.stringify(
    artifact,
    preserveGeometry ? undefined : precisionReplacer,
    2,
  );
}

export function createCurrentParamArtifactBlob<M extends AppMode>(
  snapshot: ModeParamSnapshot<M>,
  preservePrecision = false,
): Blob {
  return new Blob([serializeCurrentParamArtifact(snapshot, preservePrecision)], {
    type: "application/json",
  });
}
