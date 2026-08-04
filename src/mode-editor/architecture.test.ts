import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectFile = (path: string) => resolve(process.cwd(), path);
const readProjectFile = (path: string) =>
  readFileSync(projectFile(path), "utf8");

describe("Mode Editor 架构守卫", () => {
  it("页面只消费 active + perform，不持有 Mode 或模型", () => {
    const pageSource = readProjectFile("src/app/page.tsx");

    expect(pageSource).not.toMatch(/\buseState\b|\bsetMode\b/);
    expect(pageSource).not.toMatch(
      /useTrayModel|useCustomLayout|useBaseConverter|useSteppedLayout/,
    );
    expect(pageSource).toContain("editor.active");
    expect(pageSource).toContain("editor.perform");
  });

  it("旧双 Registry 与透传 Hook 已删除", () => {
    const removedFiles = [
      "src/hooks/useModeEditorWorkspaces.tsx",
      "src/hooks/useModeWorkspaces.tsx",
      "src/hooks/useModeViewportWorkspaces.tsx",
    ];

    expect(removedFiles.filter((file) => existsSync(projectFile(file)))).toEqual(
      [],
    );
  });

  it("Session 替换提交与 Viewport 重置集中在 Mode Editor Adapter", () => {
    const editorSource = readProjectFile("src/hooks/useModeEditor.tsx");
    const adapterSource = readProjectFile("src/mode-editor/adapters.ts");
    const pageSource = readProjectFile("src/app/page.tsx");

    expect(editorSource).toContain("createModeEditorCatalog");
    expect(editorSource).not.toMatch(/function commitImportedCandidate/);
    expect(editorSource).not.toMatch(/function commitDraftReplacement/);
    expect(adapterSource).toContain("commitReplacement");
    expect(adapterSource).toContain("commitImport");
    expect(adapterSource).toContain("resetForSessionReplacement");
    expect(pageSource).not.toMatch(
      /commitImport|commitDraftLoad|commitReset|resetForSessionReplacement/,
    );
  });
});
