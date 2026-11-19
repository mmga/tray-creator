import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { expect, it, vi } from "vitest";
import ManualSplitEditor from "./ManualSplitEditor";
import { DEFAULT_TRAY_PARAMS } from "@/lib/grid-config";
import { CUSTOM_LAYOUT_DEFAULTS } from "@/lib/custom-config";
import { MANUAL_SPLIT_DEFAULTS, type ManualSplitScene, type ManualSplitSettings } from "@/lib/manual-split-plan";
import { planManualSplitRoutes } from "@/lib/manual-split-routes";

const worker = vi.hoisted(() => ({ prepareManualSplit: vi.fn(), planManualSplitRoute: vi.fn() }));
vi.mock("@/lib/worker/worker-service", () => ({ trayWorkerService: worker }));

const scene: ManualSplitScene = {
  roots: [{ id: "1", outer: [[0, 0], [100, 0], [100, 80], [0, 80]], holes: [] }],
  grooves: [[[20, 25], [35, 25], [35, 50], [20, 50]], [[65, 25], [80, 25], [80, 50], [65, 50]]],
  obstacles: [[[18, 23], [37, 23], [37, 52], [18, 52]], [[63, 23], [82, 23], [82, 52], [63, 52]]],
  height: 6,
};

function Editor({ mode }: { mode: "grid" | "custom" }) {
  const [history, setHistory] = useState<ManualSplitSettings[]>([{ ...MANUAL_SPLIT_DEFAULTS, enabled: true }]);
  const settings = history[history.length - 1];
  return <ManualSplitEditor
    snapshot={mode === "grid"
      ? { mode, params: { ...DEFAULT_TRAY_PARAMS, manualSplit: settings } }
      : { mode, params: { ...CUSTOM_LAYOUT_DEFAULTS, manualSplit: settings } }}
    settings={settings} onChange={(next) => setHistory([...history, next])}
    canUndo={history.length > 1} onUndo={() => setHistory(history.slice(0, -1))}
    onExit={() => {}} />;
}

function setupWorker() {
  worker.prepareManualSplit.mockClear().mockResolvedValue(scene);
  worker.planManualSplitRoute.mockClear().mockImplementation(async ({ region, obstacles, start, end, via }) =>
    planManualSplitRoutes(region, obstacles, start, end, via));
}

function takePoint(x: number, y: number) {
  fireEvent.change(screen.getByRole("spinbutton", { name: "X" }), { target: { value: String(x) } });
  fireEvent.change(screen.getByRole("spinbutton", { name: "Y" }), { target: { value: String(y) } });
  fireEvent.click(screen.getByRole("button", { name: "取点" }));
}

it("网格通道预览成功后才写入切线，撤销恢复父零件", async () => {
  setupWorker();
  render(<Editor mode="grid" />);
  const guides = await screen.findByRole("combobox", { name: "选择网格安全通道" });
  fireEvent.change(guides, { target: { value: "0" } });
  const confirm = await screen.findByRole("button", { name: "确认分割" });
  expect(screen.getByText("零件 1 件")).toBeInTheDocument();
  fireEvent.click(confirm);
  expect(screen.getByText("零件 2 件")).toBeInTheDocument();
  expect(worker.prepareManualSplit).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "撤销" }));
  expect(screen.getByText("零件 1 件")).toBeInTheDocument();
});

it("自定义按两点绕槽、追加途经点，确认后可继续分割子件", async () => {
  setupWorker();
  render(<Editor mode="custom" />);
  fireEvent.click(await screen.findByRole("button", { name: "添加分割线" }));
  takePoint(25, 0);
  takePoint(25, 80);
  expect(await screen.findByRole("button", { name: /候选 2/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "加途经点" }));
  fireEvent.click(screen.getByRole("button", { name: "两槽中点" }));
  fireEvent.change(screen.getByRole("combobox", { name: "第一个凹槽" }), { target: { value: "0" } });
  fireEvent.change(screen.getByRole("combobox", { name: "第二个凹槽" }), { target: { value: "1" } });
  await waitFor(() => expect(worker.planManualSplitRoute).toHaveBeenCalledTimes(2));
  expect(worker.planManualSplitRoute).toHaveBeenLastCalledWith(expect.objectContaining({ via: [50, 37.5] }));
  fireEvent.click(await screen.findByRole("button", { name: /候选 1/ }));
  expect(screen.getByRole("button", { name: "确认分割" })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "确认分割" }));
  expect(screen.getByText("零件 2 件")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /零件 1\.1 ·/ }));
  fireEvent.click(screen.getByRole("button", { name: "添加分割线" }));
  takePoint(25, 0);
  takePoint(100, 10);
  fireEvent.click(await screen.findByRole("button", { name: "确认分割" }));
  expect(screen.getByText("零件 3 件")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "移除切线 1" }));
  expect(screen.getByText(/同时移除 1 条后续/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "确认移除" }));
  expect(screen.getByText("零件 1 件")).toBeInTheDocument();
});
