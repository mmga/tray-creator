import { beforeEach, expect, it, vi } from "vitest";
import { DEFAULT_TRAY_PARAMS } from "@/lib/grid-config";
import { exportStepFiles } from "./step-export-service";

const { requestStepExport, downloadBlob } = vi.hoisted(() => ({
  requestStepExport: vi.fn(), downloadBlob: vi.fn(),
}));

vi.mock("@/lib/worker/step-worker-service", () => ({ requestStepExport }));
vi.mock("@/lib/download-port", () => ({ browserDownloadPort: { downloadBlob } }));

const snapshot = { mode: "grid" as const, params: DEFAULT_TRAY_PARAMS };
const bytes = new Uint8Array([1]).buffer;

beforeEach(() => vi.resetAllMocks());

it("旧快照即使收到成功结果也不开始下载", async () => {
  const controller = new AbortController();
  requestStepExport.mockImplementation(async () => {
    controller.abort();
    return { files: [{ bytes }], width: 80, depth: 120 };
  });
  await expect(exportStepFiles(snapshot, "whole", controller.signal, vi.fn())).rejects.toMatchObject({ name: "AbortError" });
  expect(downloadBlob).not.toHaveBeenCalled();
});

it("盒体与盖子各保存一份 STEP，最后保存参数", async () => {
  requestStepExport.mockResolvedValue({ files: [{ id: "body", bytes }, { id: "lid", bytes }], width: 100, depth: 100 });
  await exportStepFiles({ mode: "grid", params: { ...snapshot.params,
    stackableBox: { ...snapshot.params.stackableBox!, enabled: true } } }, "whole", new AbortController().signal, vi.fn());
  expect(downloadBlob.mock.calls.map(([, name]) => name)).toEqual([
    expect.stringMatching(/^box_grid_.*_body\.step$/),
    expect.stringMatching(/^box_grid_.*_lid\.step$/),
    expect.stringMatching(/^box_grid_.*_body\.json$/),
  ]);
});
