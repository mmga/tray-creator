import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StackableBoxConfig } from "@/components/StackableBoxConfig";
import {
  createDefaultStackableBoxParams,
  type BoxValidationResult,
} from "@/lib/stackable-box";

function makeValidation(overrides: Partial<BoxValidationResult> = {}): BoxValidationResult {
  return {
    valid: true,
    blockingReasons: [],
    warnings: [],
    ...overrides,
  };
}

function BoxHarness({
  validation,
  onExpandToFit,
}: {
  validation: BoxValidationResult;
  onExpandToFit?: () => void;
}) {
  const [box, setBox] = useState(createDefaultStackableBoxParams());
  return (
    <StackableBoxConfig
      box={box}
      onChange={setBox}
      validation={validation}
      usableWidth={88}
      usableDepth={88}
      lidClearHeight={47}
      stackClearHeight={45}
      onExpandToFit={onExpandToFit}
    />
  );
}

describe("StackableBoxConfig", () => {
  it("切换启用后展示外部尺寸输入", () => {
    render(<BoxHarness validation={makeValidation()} />);
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    expect(screen.getByText("堆叠盒体")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("switch"));
    expect(screen.getByText("外部长度")).toBeInTheDocument();
    expect(screen.getByText("外部深度")).toBeInTheDocument();
    expect(screen.getByText("外部高度")).toBeInTheDocument();
    expect(screen.getByText("最小内壁间距")).toBeInTheDocument();
  });

  it("槽位越界时展示差值并触发扩展", () => {
    const onExpandToFit = vi.fn();
    render(
      <BoxHarness
        validation={makeValidation({
          valid: false,
          blockingReasons: [{ code: "slot-in-safety-boundary", message: "越界" }],
          overflow: {
            currentWidth: 60,
            currentDepth: 60,
            requiredWidth: 80,
            requiredDepth: 80,
            deltaX: 20,
            deltaY: 20,
          },
        })}
        onExpandToFit={onExpandToFit}
      />,
    );
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    fireEvent.click(screen.getByRole("switch"));

    expect(screen.getByText(/槽位越界/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("扩展盒体至刚好容纳"));
    expect(onExpandToFit).toHaveBeenCalledTimes(1);
  });
});
