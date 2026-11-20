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

it("正交折线锁定方向、拒绝碰槽，支持多个内部折点与撤回", async () => {
  setupWorker();
  render(<Editor mode="custom" />);
  fireEvent.click(await screen.findByRole("button", { name: "正交折线" }));
  takePoint(28, 80);
  const direction = screen.getByRole("combobox", { name: "下一段" });
  fireEvent.change(direction, { target: { value: "vertical" } });
  takePoint(28, 30);
  expect(screen.getByRole("alert")).toHaveTextContent("保护区");
  expect(screen.queryByRole("button", { name: "确认分割" })).not.toBeInTheDocument();
  takePoint(28, 60);
  fireEvent.change(direction, { target: { value: "horizontal" } });
  takePoint(50, 62);
  fireEvent.click(screen.getByRole("button", { name: "撤回上一点" }));
  takePoint(48, 59);
  fireEvent.change(direction, { target: { value: "vertical" } });
  takePoint(48, 0);
  fireEvent.click(screen.getByRole("button", { name: "确认分割" }));
  expect(screen.getByText("零件 2 件")).toBeInTheDocument();
  expect(worker.planManualSplitRoute).not.toHaveBeenCalled();
});

it("从槽间和任意两点建立参考线，可以用参考线与边界的交点起笔", async () => {
  setupWorker();
  render(<Editor mode="custom" />);
  fireEvent.click(await screen.findByRole("button", { name: "正交折线" }));
  fireEvent.click(screen.getByRole("button", { name: "两槽中点" }));
  fireEvent.change(screen.getByRole("combobox", { name: "第一个凹槽" }), { target: { value: "0" } });
  fireEvent.change(screen.getByRole("combobox", { name: "第二个凹槽" }), { target: { value: "1" } });
  expect(screen.getByRole("button", { name: /清除参考点 50\.00, 37\.50/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "加横向参考线" }));
  fireEvent.click(screen.getByRole("button", { name: "两点中点" }));
  takePoint(35, 55);
  takePoint(55, 55);
  expect(screen.getByRole("button", { name: /清除参考点 45\.00, 55\.00/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "加竖向参考线" }));
  const option = screen.getByRole("option", { name: "参考线与边界交点 · 45.00, 80.00" });
  fireEvent.change(screen.getByRole("combobox", { name: "几何辅助点" }), { target: { value: (option as HTMLOptionElement).value } });
  takePoint(45, 0);
  fireEvent.click(screen.getByRole("button", { name: "确认分割" }));
  expect(screen.getByText("零件 2 件")).toBeInTheDocument();
});

it("镜像阶梯切线一次拆成三件、一次撤销或移除", async () => {
  setupWorker();
  render(<Editor mode="grid" />);
  async function draw() {
    fireEvent.click(await screen.findByRole("button", { name: "正交折线" }));
    fireEvent.change(screen.getByRole("combobox", { name: "整线对称" }), { target: { value: "left-right" } });
    takePoint(12, 80);
    takePoint(12, 16);
    takePoint(33, 16);
    takePoint(33, 0);
    const confirm = screen.getByRole("button", { name: "确认对称分割" });
    expect(confirm).toBeEnabled();
    expect(screen.getByText(/预览零件 3/)).toBeInTheDocument();
    fireEvent.click(confirm);
    expect(screen.getByText("零件 3 件")).toBeInTheDocument();
  }
  await draw();
  fireEvent.click(screen.getByRole("button", { name: "撤销" }));
  expect(screen.getByText("零件 1 件")).toBeInTheDocument();
  await draw();
  const secondary = screen.getByRole("button", { name: /移除切线 1\.[12]/ });
  fireEvent.click(secondary);
  fireEvent.click(screen.getByRole("button", { name: "确认移除" }));
  expect(screen.getByText("零件 1 件")).toBeInTheDocument();
});

it("镜像侧遇到保护区时阻止整组确认，可解除联动继续绘制", async () => {
  setupWorker();
  render(<Editor mode="custom" />);
  fireEvent.click(await screen.findByRole("button", { name: "正交折线" }));
  const symmetry = screen.getByRole("combobox", { name: "整线对称" });
  fireEvent.change(symmetry, { target: { value: "left-right" } });
  takePoint(12, 80);
  takePoint(12, 0);
  fireEvent.change(screen.getByRole("spinbutton", { name: "基准 X" }), { target: { value: "43" } });
  expect(screen.getByRole("alert")).toHaveTextContent("对称线经过保护区");
  expect(screen.getByRole("button", { name: "确认对称分割" })).toBeDisabled();
  fireEvent.change(symmetry, { target: { value: "off" } });
  fireEvent.click(screen.getByRole("button", { name: "确认分割" }));
  expect(screen.getByText("零件 2 件")).toBeInTheDocument();
});
