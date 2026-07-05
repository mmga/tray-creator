import * as React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import TrayViewer from "@/components/TrayViewer";

const {
  useThreeState,
  orbitControlsPropsSpy,
  canvasCreatedGlSpy,
  glDomElement,
} = vi.hoisted(() => {
  const target = { copy: vi.fn() };
  const controls = { target, update: vi.fn() };
  const glDom = {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  const gl = {
    domElement: glDom,
    setClearColor: vi.fn(),
    toneMapping: null,
    toneMappingExposure: 0,
  };
  const camera = {
    fov: 45,
    position: { set: vi.fn() },
  };

  return {
    useThreeState: { camera, controls, gl },
    orbitControlsPropsSpy: vi.fn(),
    canvasCreatedGlSpy: gl,
    glDomElement: glDom,
  };
});

vi.mock("@react-three/fiber", async () => {
  const ReactModule = await import("react");

  return {
    Canvas({
      children,
      onCreated,
    }: {
      children: React.ReactNode;
      onCreated?: (state: { gl: typeof canvasCreatedGlSpy }) => void;
    }) {
      ReactModule.useEffect(() => {
        onCreated?.({ gl: canvasCreatedGlSpy });
      }, [onCreated]);

      return <div data-testid="mock-canvas">{children}</div>;
    },
    useThree() {
      return useThreeState;
    },
  };
});

vi.mock("@react-three/drei", () => ({
  OrbitControls(props: unknown) {
    orbitControlsPropsSpy(props);
    return <div data-testid="orbit-controls" />;
  },
}));

function createGeometry() {
  const geometry = new THREE.BoxGeometry(10, 20, 30);
  geometry.computeBoundingSphere();
  return geometry;
}

describe("TrayViewer", { timeout: 15000 }, () => {
  beforeEach(() => {
    useThreeState.camera.position.set.mockReset();
    useThreeState.controls.target.copy.mockReset();
    useThreeState.controls.update.mockReset();
    canvasCreatedGlSpy.setClearColor.mockReset();
    glDomElement.addEventListener.mockReset();
    glDomElement.removeEventListener.mockReset();
    orbitControlsPropsSpy.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("requests regeneration only when the current 3D view is stale", () => {
    const onRegenerate = vi.fn();
    const { rerender } = render(
      <TrayViewer
        geometry={null}
        isStale={true}
        isGenerating={false}
        onRegenerate={onRegenerate}
      />,
    );

    fireEvent.click(screen.getByText("FORGE VIEW"));
    expect(onRegenerate).toHaveBeenCalledTimes(1);

    rerender(
      <TrayViewer
        geometry={null}
        isStale={false}
        isGenerating={false}
        onRegenerate={onRegenerate}
      />,
    );

    fireEvent.click(screen.getByText("FORGE VIEW"));
    expect(onRegenerate).toHaveBeenCalledTimes(1);
  });

  it("shows and resets the loading bar based on generate state", () => {
    vi.useFakeTimers();
    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      });
    const cancelAnimationFrameSpy = vi
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation(() => undefined);

    const { container, rerender } = render(
      <TrayViewer geometry={null} isGenerating={true} />,
    );

    act(() => {
      vi.advanceTimersByTime(1500);
    });
    const progressBar = container.querySelector(
      'div[style*="width:"]',
    ) as HTMLDivElement | null;
    expect(progressBar).not.toBeNull();
    expect(Number.parseFloat(progressBar!.style.width)).toBeGreaterThan(0);

    rerender(<TrayViewer geometry={null} isGenerating={false} />);
    expect(container.querySelector('div[style*="width:"]')).toBeNull();

    requestAnimationFrameSpy.mockRestore();
    cancelAnimationFrameSpy.mockRestore();
    vi.useRealTimers();
  });

  it("shows progress while generating split preview", () => {
    vi.useFakeTimers();
    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      });
    const cancelAnimationFrameSpy = vi
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation(() => undefined);

    const { container } = render(
      <TrayViewer geometry={null} isGeneratingSplitPreview={true} />,
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    const progressBar = container.querySelector(
      'div[style*="width:"]',
    ) as HTMLDivElement | null;
    expect(progressBar).not.toBeNull();
    expect(Number.parseFloat(progressBar!.style.width)).toBeGreaterThan(0);

    requestAnimationFrameSpy.mockRestore();
    cancelAnimationFrameSpy.mockRestore();
    vi.useRealTimers();
  });

  it("fits the camera and wires context listeners when geometry is available", () => {
    render(
      <TrayViewer
        geometry={createGeometry()}
        isStale={false}
        isGenerating={false}
      />,
    );

    expect(screen.getByTestId("mock-canvas")).toBeInTheDocument();
    expect(screen.getByTestId("orbit-controls")).toBeInTheDocument();
    expect(useThreeState.camera.position.set).toHaveBeenCalledTimes(1);
    expect(useThreeState.controls.target.copy).toHaveBeenCalledTimes(1);
    expect(useThreeState.controls.update).toHaveBeenCalledTimes(1);
    expect(canvasCreatedGlSpy.setClearColor).toHaveBeenCalledTimes(1);
    expect(glDomElement.addEventListener).toHaveBeenCalledWith(
      "webglcontextlost",
      expect.any(Function),
    );
    expect(glDomElement.addEventListener).toHaveBeenCalledWith(
      "webglcontextrestored",
      expect.any(Function),
    );
    expect(orbitControlsPropsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        makeDefault: true,
        enableDamping: true,
        mouseButtons: {
          LEFT: THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.PAN,
          RIGHT: THREE.MOUSE.PAN,
        },
        minDistance: 10,
        maxDistance: 900,
      }),
    );
  });

  it("requests and displays split-part preview data", () => {
    const onGenerateSplitPreview = vi.fn();
    const splitGeometry = createGeometry();
    const { rerender } = render(
      <TrayViewer
        geometry={createGeometry()}
        splitParts={null}
        onGenerateSplitPreview={onGenerateSplitPreview}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /拆件/ }));
    expect(onGenerateSplitPreview).toHaveBeenCalledTimes(1);

    rerender(
      <TrayViewer
        geometry={createGeometry()}
        splitParts={[
          {
            index: 0,
            label: "低组",
            toHeight: 3,
            threeGeometry: splitGeometry,
          },
        ]}
        onGenerateSplitPreview={onGenerateSplitPreview}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /拆件/ }));
    expect(screen.getByText("拆件预览")).toBeInTheDocument();
    expect(screen.getByText("低组")).toBeInTheDocument();
    expect(screen.getByText("3mm")).toBeInTheDocument();

    const distanceSlider = screen.getByLabelText("爆炸视图间距");
    expect(distanceSlider).toHaveValue("42");
    expect(distanceSlider).toHaveAttribute("min", "-10");
    expect(distanceSlider).toHaveAttribute("step", "1");
    expect(useThreeState.camera.position.set).toHaveBeenCalledTimes(2);
    fireEvent.change(distanceSlider, { target: { value: "76" } });
    expect(distanceSlider).toHaveValue("76");
    expect(screen.getByText("76")).toBeInTheDocument();
    expect(useThreeState.camera.position.set).toHaveBeenCalledTimes(2);
    fireEvent.change(distanceSlider, { target: { value: "0" } });
    expect(distanceSlider).toHaveValue("0");
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(useThreeState.camera.position.set).toHaveBeenCalledTimes(2);
    fireEvent.change(distanceSlider, { target: { value: "-10" } });
    expect(distanceSlider).toHaveValue("-10");
    expect(screen.getByText("-10")).toBeInTheDocument();
    expect(useThreeState.camera.position.set).toHaveBeenCalledTimes(2);
  });

  it("prevents default on context loss and removes listeners on unmount", () => {
    const { unmount } = render(
      <TrayViewer
        geometry={createGeometry()}
        isStale={false}
        isGenerating={false}
      />,
    );

    const lostHandlerCall = glDomElement.addEventListener.mock.calls.find(
      ([eventName]) => eventName === "webglcontextlost",
    );
    const restoredHandlerCall = glDomElement.addEventListener.mock.calls.find(
      ([eventName]) => eventName === "webglcontextrestored",
    );

    expect(lostHandlerCall).toBeDefined();
    expect(restoredHandlerCall).toBeDefined();

    const preventDefault = vi.fn();
    const lostHandler = lostHandlerCall?.[1] as ((event: Event) => void) | undefined;
    const restoredHandler = restoredHandlerCall?.[1] as (() => void) | undefined;

    lostHandler?.({ preventDefault } as unknown as Event);
    expect(preventDefault).toHaveBeenCalledTimes(1);

    unmount();

    expect(glDomElement.removeEventListener).toHaveBeenCalledWith(
      "webglcontextlost",
      lostHandler,
    );
    expect(glDomElement.removeEventListener).toHaveBeenCalledWith(
      "webglcontextrestored",
      restoredHandler,
    );
  });
});
