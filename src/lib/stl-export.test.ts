import { beforeEach, describe, expect, it, vi } from "vitest";
import { exportToSTL, generateCustomSTLFilename, generateSTLFilename } from "@/lib/stl-export";

const { serializeMock } = vi.hoisted(() => ({
  serializeMock: vi.fn(),
}));

vi.mock("@jscad/stl-serializer", () => ({
  default: {
    serialize: serializeMock,
  },
}));

describe("stl export", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    serializeMock.mockReset();
  });

  it("serializes geometry, triggers download, and revokes the blob URL", () => {
    const click = vi.fn();
    const link = { click, href: "", download: "" };
    const createElementSpy = vi
      .spyOn(document, "createElement")
      .mockReturnValue(link as unknown as HTMLAnchorElement);
    const createUrlSpy = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:test-url");
    const revokeUrlSpy = vi.spyOn(URL, "revokeObjectURL");

    serializeMock.mockReturnValue([new Uint8Array([1, 2, 3])]);

    exportToSTL({ id: "geom" } as never, "tray.stl");

    expect(serializeMock).toHaveBeenCalledWith(
      { binary: true },
      { id: "geom" },
    );
    expect(createElementSpy).toHaveBeenCalledWith("a");
    expect(link.href).toBe("blob:test-url");
    expect(link.download).toBe("tray.stl");
    expect(click).toHaveBeenCalledTimes(1);
    expect(createUrlSpy).toHaveBeenCalledWith(expect.any(Blob));

    vi.advanceTimersByTime(1000);
    expect(revokeUrlSpy).toHaveBeenCalledWith("blob:test-url");

    vi.useRealTimers();
  });

  it("generates stable filenames for grid and custom exports", () => {
    expect(generateSTLFilename(4, 3, 32)).toBe("tray_3x4_32mm.stl");
    expect(generateCustomSTLFilename(120, 90, 5)).toBe(
      "tray_custom_120x90_5slots.stl",
    );
  });
});
