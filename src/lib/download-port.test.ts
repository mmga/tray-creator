import { describe, expect, it, vi } from "vitest";
import { browserDownloadPort } from "@/lib/download-port";

describe("browserDownloadPort", () => {
  it("creates a blob URL, clicks a temporary link, and cleans it up", () => {
    const blob = new Blob(["hello"], { type: "text/plain" });
    const appendChildSpy = vi.spyOn(document.body, "appendChild");
    const removeChildSpy = vi.spyOn(document.body, "removeChild");
    const createElementSpy = vi.spyOn(document, "createElement");
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    browserDownloadPort.downloadBlob(blob, "fixture.txt");

    expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock");
    expect(createElementSpy).toHaveBeenCalledWith("a");
    expect(appendChildSpy).toHaveBeenCalledTimes(1);
    expect(removeChildSpy).toHaveBeenCalledTimes(1);

    const link = appendChildSpy.mock.calls[0]?.[0] as HTMLAnchorElement;
    expect(link.tagName).toBe("A");
    expect(link.download).toBe("fixture.txt");
    expect(link.href).toBe("blob:mock");
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it("cleans up the temporary link and blob URL when clicking fails", () => {
    const blob = new Blob(["hello"], { type: "text/plain" });
    const removeChildSpy = vi.spyOn(document.body, "removeChild");
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {
      throw new Error("download blocked");
    });

    expect(() =>
      browserDownloadPort.downloadBlob(blob, "fixture.txt"),
    ).toThrow("download blocked");

    expect(removeChildSpy).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock");
  });
});
