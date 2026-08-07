import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { KeyboardHintsOverlay } from "./KeyboardHintsOverlay";

describe("KeyboardHintsOverlay", () => {
    it("提供对话框语义，并将焦点移入及归还给触发按钮", () => {
        const onClose = vi.fn();
        const trigger = document.createElement("button");
        document.body.appendChild(trigger);
        trigger.focus();

        const { rerender } = render(
            <KeyboardHintsOverlay showHints onClose={onClose} />,
        );

        expect(screen.getByRole("dialog", { name: "快捷键" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "关闭快捷键帮助" })).toHaveFocus();

        trigger.focus();
        fireEvent.keyDown(window, { key: "Tab" });
        expect(screen.getByRole("button", { name: "关闭快捷键帮助" })).toHaveFocus();

        rerender(<KeyboardHintsOverlay showHints={false} onClose={onClose} />);
        expect(trigger).toHaveFocus();
        trigger.remove();
    });

    it("支持关闭按钮、背景和 Escape 三种关闭路径", () => {
        const onClose = vi.fn();
        const { rerender } = render(
            <KeyboardHintsOverlay showHints onClose={onClose} />,
        );

        fireEvent.click(screen.getByRole("button", { name: "关闭快捷键帮助" }));
        fireEvent.click(screen.getByRole("presentation"));
        fireEvent.keyDown(window, { key: "Escape" });
        expect(onClose).toHaveBeenCalledTimes(3);

        rerender(<KeyboardHintsOverlay showHints={false} onClose={onClose} />);
        fireEvent.keyDown(window, { key: "Escape" });
        expect(onClose).toHaveBeenCalledTimes(3);
    });
});
