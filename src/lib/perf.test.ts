// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

async function readPerfEnabled(search = "") {
  window.history.replaceState({}, "", `/${search}`);
  vi.resetModules();
  const { isPerfEnabled } = await import("@/lib/perf");
  return isPerfEnabled();
}

describe("performance diagnostics storage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState({}, "", "/");
  });

  it("keeps explicit query behavior when persistence writes fail", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("storage denied", "SecurityError");
    });

    await expect(readPerfEnabled("?perf=1")).resolves.toBe(true);

    vi.restoreAllMocks();
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new DOMException("storage denied", "SecurityError");
    });

    await expect(readPerfEnabled("?perf=0")).resolves.toBe(false);
  });

  it("defaults to disabled when persisted preference cannot be read", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("storage denied", "SecurityError");
    });

    await expect(readPerfEnabled()).resolves.toBe(false);
  });
});
