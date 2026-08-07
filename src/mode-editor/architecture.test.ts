import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectFile = (path: string) => resolve(process.cwd(), path);
const readProjectFile = (path: string) =>
  readFileSync(projectFile(path), "utf8");

describe("Mode Editor 架构守卫", () => {
  it("页面只负责延迟启动，Runtime 只消费 active + perform", () => {
    const pageSource = readProjectFile("src/app/page.tsx");
    const runtimeSource = readProjectFile(
      "src/app/TrayCreatorEditorRuntime.tsx",
    );

    expect(pageSource).not.toMatch(/\buseState\b|\bsetMode\b/);
    expect(pageSource).not.toMatch(
      /useTrayModel|useCustomLayout|useBaseConverter|useSteppedLayout/,
    );
    expect(pageSource).toContain('dynamic(\n  () => import("./TrayCreatorEditorRuntime")');
    expect(runtimeSource).not.toMatch(/\buseState\b|\bsetMode\b/);
    expect(runtimeSource).not.toMatch(
      /useTrayModel|useCustomLayout|useBaseConverter|useSteppedLayout/,
    );
    expect(runtimeSource).toContain("useModeEditor()");
    expect(runtimeSource).toContain("editor.active");
    expect(runtimeSource).toContain("editor.perform");
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

  it("Session 替换提交与 Viewport 重置集中在 Mode Editor", () => {
    const editorSource = readProjectFile("src/hooks/useModeEditor.tsx");
    const pageSource = readProjectFile("src/app/page.tsx");

    expect(editorSource).toContain("commitImportedCandidate");
    expect(editorSource).toContain("commitDraftReplacement");
    expect(editorSource).toContain("resetForSessionReplacement");
    expect(pageSource).not.toMatch(
      /commitImport|commitDraftLoad|commitReset|resetForSessionReplacement/,
    );
  });
});
