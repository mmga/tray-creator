import type { AppMode } from "@/types/custom-tray";
import type { ModeViewportWorkspace } from "@/viewports/types";
import type { ModeWorkspace } from "@/workspaces/types";

export interface ModeEditorCatalogEntry<M extends AppMode> {
  readonly workspace: ModeWorkspace<M>;
  readonly viewport: ModeViewportWorkspace<M>;
}

export type ModeEditorCatalog = {
  [M in AppMode]: ModeEditorCatalogEntry<M>;
};

/** Mode 与其 Workspace、Viewport 的唯一配对位置。 */
export function createModeEditorCatalog(
  entries: ModeEditorCatalog,
): ModeEditorCatalog {
  for (const [mode, entry] of Object.entries(entries) as Array<
    [AppMode, ModeEditorCatalogEntry<AppMode>]
  >) {
    if (entry.workspace.mode !== mode || entry.viewport.mode !== mode) {
      throw new Error(
        `Mode Editor Catalog 配对错误：${mode}、${entry.workspace.mode}、${entry.viewport.mode}`,
      );
    }
  }
  return entries;
}
