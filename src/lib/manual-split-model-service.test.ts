import { expect, it, vi } from "vitest";
import { primitives } from "@jscad/modeling";
import { DEFAULT_TRAY_PARAMS } from "./grid-config";
import { MANUAL_SPLIT_DEFAULTS } from "./manual-split-plan";
import { captureModeParamSnapshot } from "./mode-param-snapshot";
import { exportManualSplitFiles } from "./manual-split-model-service";

const snapshot = captureModeParamSnapshot("grid", {
  ...DEFAULT_TRAY_PARAMS, columns: 2, rows: 1,
  manualSplit: { ...MANUAL_SPLIT_DEFAULTS, enabled: true, cuts: [{ target: "1", path: [[0, -20], [0, 20]] }] },
});
const geometry = primitives.cuboid({ size: [10, 10, 2] });
const parts = ["1.1", "1.2"].map((id) => ({
  id, geometry, size: [10, 10, 2] as [number, number, number], rotation: 0 as const,
}));

it("依次下载编号 STL 和同一快照的拆件参数", async () => {
  const worker = {
    generateManualSplitParts: vi.fn().mockResolvedValue(parts),
    exportSTL: vi.fn(async (_geometry, filename: string) => ({ filename, blob: new Blob(["stl"]) })),
  };
  const downloadBlob = vi.fn<(blob: Blob, filename: string) => void>();
  await exportManualSplitFiles(snapshot, worker, { downloadBlob }, () => true);
  expect(worker.generateManualSplitParts).toHaveBeenCalledWith(snapshot, true);
  expect(worker.exportSTL).toHaveBeenCalledWith(geometry, "tray_2x1_part_1-1.stl", true);
  expect(downloadBlob.mock.calls.map(([, name]) => name)).toEqual([
    "tray_2x1_part_1-1.stl", "tray_2x1_part_1-2.stl", "tray_2x1_parts.json",
  ]);
  expect(JSON.parse(await downloadBlob.mock.calls[2][0].text()).params.manualSplit).toEqual(snapshot.params.manualSplit);
});

it("准备期间布局改变或任一 STL 失败时，不触发部分下载", async () => {
  let current = true;
  const worker = {
    generateManualSplitParts: vi.fn().mockResolvedValue(parts),
    exportSTL: vi.fn(async (_geometry, filename: string) => {
      current = false;
      return { filename, blob: new Blob(["stl"]) };
    }),
  };
  const downloadBlob = vi.fn();
  await expect(exportManualSplitFiles(snapshot, worker, { downloadBlob }, () => current)).rejects.toThrow(/已修改/);
  worker.exportSTL.mockRejectedValueOnce(new Error("STL 失败"));
  await expect(exportManualSplitFiles(snapshot, worker, { downloadBlob }, () => true)).rejects.toThrow("STL 失败");
  expect(downloadBlob).not.toHaveBeenCalled();
});
