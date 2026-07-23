import type { AppMode } from "@/types/custom-tray";
import type { ModeViewportWorkspace } from "@/viewports/types";
import type { ModeWorkspace } from "@/workspaces/types";

export interface ModeEditorCatalogEntry {
  readonly workspace: ModeWorkspace;
  readonly viewport: ModeViewportWorkspace;
}

export type ModeEditorCatalog = Record<AppMode, ModeEditorCatalogEntry>;

/** Mode 与其 Workspace、Viewport 的唯一配对位置。 */
export function createModeEditorCatalog(
  entries: ModeEditorCatalog,
): ModeEditorCatalog {
  for (const [mode, entry] of Object.entries(entries) as Array<
    [AppMode, ModeEditorCatalogEntry]
  >) {
    if (entry.viewport.mode !== mode) {
      throw new Error(`Mode Editor Catalog 配对错误：${mode} 与 ${entry.viewport.mode}`);
    }
  }
  return entries;
}
