import type { AppMode } from "@/types/custom-tray";
import type { ImportCandidate } from "@/lib/historical-param-artifact-reader";
import {
  type ModeEditorAdapter,
  type ModeEditorReplacement,
} from "@/mode-editor/adapters";

export type ModeEditorCatalogEntry<M extends AppMode> = ModeEditorAdapter<M>;

export type ModeEditorCatalog = {
  [M in AppMode]: ModeEditorCatalogEntry<M>;
};

/** Mode 与其 Workspace、Viewport 的唯一配对位置。 */
export function createModeEditorCatalog(
  entries: ModeEditorCatalog,
): ModeEditorCatalog {
  for (const [mode, entry] of Object.entries(entries) as Array<
    [AppMode, ModeEditorAdapter<AppMode>]
  >) {
    if (
      entry.mode !== mode ||
      entry.workspace.mode !== mode ||
      entry.viewport.mode !== mode
    ) {
      throw new Error(
        `Mode Editor Catalog 配对错误：${mode}、${entry.mode}、${entry.workspace.mode}、${entry.viewport.mode}`,
      );
    }
  }
  return entries;
}

export function prepareReset(
  catalog: ModeEditorCatalog,
  mode: AppMode,
): ModeEditorReplacement {
  switch (mode) {
    case "grid":
      return catalog.grid.prepareReset();
    case "custom":
      return catalog.custom.prepareReset();
    case "base-converter":
      return catalog["base-converter"].prepareReset();
    case "stepped":
      return catalog.stepped.prepareReset();
  }
}

export function prepareDraftReplacement(
  catalog: ModeEditorCatalog,
  mode: AppMode,
  draftId: string,
): ModeEditorReplacement | null {
  switch (mode) {
    case "grid": {
      const prepared = catalog.grid.prepareDraftLoad(draftId);
      return prepared ? { kind: "draft", mode, prepared } : null;
    }
    case "custom": {
      const prepared = catalog.custom.prepareDraftLoad(draftId);
      return prepared ? { kind: "draft", mode, prepared } : null;
    }
    case "base-converter": {
      const prepared = catalog["base-converter"].prepareDraftLoad(draftId);
      return prepared ? { kind: "draft", mode, prepared } : null;
    }
    case "stepped": {
      const prepared = catalog.stepped.prepareDraftLoad(draftId);
      return prepared ? { kind: "draft", mode, prepared } : null;
    }
  }
}

export function commitReplacement(
  catalog: ModeEditorCatalog,
  replacement: ModeEditorReplacement,
): void {
  switch (replacement.mode) {
    case "grid":
      catalog.grid.commitReplacement(replacement);
      return;
    case "custom":
      catalog.custom.commitReplacement(replacement);
      return;
    case "base-converter":
      catalog["base-converter"].commitReplacement(replacement);
      return;
    case "stepped":
      catalog.stepped.commitReplacement(replacement);
  }
}

export function commitImportedCandidate(
  catalog: ModeEditorCatalog,
  candidate: ImportCandidate,
): void {
  switch (candidate.mode) {
    case "grid":
      catalog.grid.commitImport(candidate.snapshot);
      return;
    case "custom":
      catalog.custom.commitImport(candidate.snapshot);
      return;
    case "base-converter":
      catalog["base-converter"].commitImport(candidate.snapshot);
      return;
    case "stepped":
      catalog.stepped.commitImport(candidate.snapshot);
  }
}
