import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, vi } from "vitest";

function defineWritableValue(
  target: object,
  key: PropertyKey,
  value: unknown,
) {
  if (!(key in target)) {
    Object.defineProperty(target, key, {
      configurable: true,
      writable: true,
      value,
    });
  }
}

class MockWorker {
  onmessage: ((event: MessageEvent) => unknown) | null = null;
  onerror: ((event: ErrorEvent) => unknown) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  dispatchEvent = vi.fn(() => false);
}

class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

class MockIntersectionObserver {
  root: Element | Document | null = null;
  rootMargin = "";
  thresholds: number[] = [];
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn(() => []);
}

beforeAll(() => {
  defineWritableValue(URL, "createObjectURL", vi.fn(() => "blob:mock"));
  defineWritableValue(URL, "revokeObjectURL", vi.fn());
  defineWritableValue(
    window,
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
  defineWritableValue(window, "scrollTo", vi.fn());
  defineWritableValue(globalThis, "Worker", MockWorker);
  defineWritableValue(globalThis, "ResizeObserver", MockResizeObserver);
  defineWritableValue(
    globalThis,
    "IntersectionObserver",
    MockIntersectionObserver,
  );
});

beforeEach(() => {
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    writable: true,
    value: vi.fn(() => "blob:mock"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });

  if (typeof crypto.randomUUID === "function") {
    vi.spyOn(crypto, "randomUUID").mockImplementation(() => "test-uuid");
  }
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
