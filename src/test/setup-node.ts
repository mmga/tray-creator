import { afterEach, beforeEach, vi } from "vitest";

beforeEach(() => {
  if (typeof crypto.randomUUID === "function") {
    vi.spyOn(crypto, "randomUUID").mockImplementation(() => "test-uuid");
  }
});

afterEach(() => {
  vi.restoreAllMocks();
});
