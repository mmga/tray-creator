import type {
  ModeParamSnapshot,
} from "@/lib/mode-param-snapshot";
import type { PreparedDraftLoad } from "@/hooks/useModeDrafts";
import type { AppMode } from "@/types/custom-tray";
import type { ModeViewportWorkspace } from "@/viewports/types";
import type {
  ModeWorkspace,
  ModeWorkspaceReplacementTarget,
} from "@/workspaces/types";

export type ReplacementRisk = Pick<
  ModeWorkspaceReplacementTarget<AppMode>,
  "currentDraftId" | "hasUnsavedChanges" | "paramsRevision"
>;

export type PreparedModeReplacement<M extends AppMode> =
  | { kind: "reset"; mode: M }
  | { kind: "draft"; mode: M; prepared: PreparedDraftLoad<M> };

export type ModeEditorReplacement = {
  [M in AppMode]: PreparedModeReplacement<M>;
}[AppMode];

export interface ModeEditorAdapter<M extends AppMode> {
  readonly mode: M;
  readonly workspace: ModeWorkspace<M>;
  readonly viewport: ModeViewportWorkspace<M>;
  readReplacementRisk(): ReplacementRisk;
  deactivate(): void;
  prepareReset(): PreparedModeReplacement<M>;
  prepareDraftLoad(draftId: string): PreparedDraftLoad<M> | null;
  commitReplacement(replacement: PreparedModeReplacement<M>): void;
  commitImport(snapshot: ModeParamSnapshot<M>): void;
}

export function createModeEditorAdapter<M extends AppMode>(
  workspace: ModeWorkspace<M>,
  viewport: ModeViewportWorkspace<M>,
): ModeEditorAdapter<M> {
  return {
    mode: workspace.mode,
    workspace,
    viewport,
    readReplacementRisk: () => {
      const target = workspace.replacementTarget;
      return {
        currentDraftId: target.currentDraftId,
        hasUnsavedChanges: target.hasUnsavedChanges,
        paramsRevision: target.paramsRevision,
      };
    },
    deactivate: () => {
      viewport.deactivate();
    },
    prepareReset: () => ({
      kind: "reset",
      mode: workspace.mode,
    }),
    prepareDraftLoad: (draftId) =>
      workspace.replacementTarget.prepareDraftLoad(draftId),
    commitReplacement: (replacement) => {
      if (replacement.kind === "reset") {
        workspace.replacementTarget.commitReset();
      } else {
        workspace.replacementTarget.commitDraftLoad(replacement.prepared);
      }
      viewport.resetForSessionReplacement();
    },
    commitImport: (snapshot) => {
      workspace.replacementTarget.commitImport(snapshot.params);
      viewport.resetForSessionReplacement();
    },
  };
}
