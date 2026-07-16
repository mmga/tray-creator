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
): string {
  return JSON.stringify(
    buildCurrentParamArtifact(snapshot),
    precisionReplacer,
    2,
  );
}

export function createCurrentParamArtifactBlob<M extends AppMode>(
  snapshot: ModeParamSnapshot<M>,
): Blob {
  return new Blob([serializeCurrentParamArtifact(snapshot)], {
    type: "application/json",
  });
}
