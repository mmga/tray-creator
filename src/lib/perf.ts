"use client";

export type PerfMetricName =
  | "canvas.pointermove"
  | "canvas.collision"
  | "stepped.outline";

export interface PerfMetricSnapshot {
  name: PerfMetricName;
  count: number;
  last: number;
  avg: number;
  max: number;
  updatedAt: number;
}

export interface PerfMetricsSnapshot {
  enabled: boolean;
  metrics: PerfMetricSnapshot[];
}

interface PerfStore {
  enabled: boolean;
  initialized: boolean;
  metrics: Map<PerfMetricName, PerfMetricSnapshot>;
  listeners: Set<() => void>;
  pendingNotifyFrame: number | null;
  snapshot: PerfMetricsSnapshot;
}

const PERF_STORAGE_KEY = "tray-creator:perf";
const PERF_METRIC_ORDER: PerfMetricName[] = [
  "canvas.pointermove",
  "canvas.collision",
  "stepped.outline",
];

const store: PerfStore = {
  enabled: false,
  initialized: false,
  metrics: new Map(),
  listeners: new Set(),
  pendingNotifyFrame: null,
  snapshot: {
    enabled: false,
    metrics: [],
  },
};

function updatePerfSnapshot() {
  store.snapshot = {
    enabled: store.enabled,
    metrics: store.enabled
      ? PERF_METRIC_ORDER.flatMap((name) => {
          const metric = store.metrics.get(name);
          return metric ? [metric] : [];
        })
      : [],
  };
}

function emitPerfListeners() {
  store.listeners.forEach((listener) => listener());
}

function schedulePerfListeners() {
  if (store.listeners.size === 0) {
    return;
  }

  if (
    typeof window === "undefined" ||
    typeof window.requestAnimationFrame !== "function"
  ) {
    emitPerfListeners();
    return;
  }

  if (store.pendingNotifyFrame !== null) {
    return;
  }

  store.pendingNotifyFrame = window.requestAnimationFrame(() => {
    store.pendingNotifyFrame = null;
    emitPerfListeners();
  });
}

function persistPerfEnabled(enabled: boolean) {
  try {
    if (enabled) {
      window.localStorage.setItem(PERF_STORAGE_KEY, "1");
    } else {
      window.localStorage.removeItem(PERF_STORAGE_KEY);
    }
  } catch {
    // 性能诊断是可选能力，存储不可用时仍保留当前页面的查询参数语义。
  }
}

function readPersistedPerfEnabled() {
  try {
    return window.localStorage.getItem(PERF_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function resolvePerfEnabled() {
  if (typeof window === "undefined") {
    return false;
  }

  const params = new URLSearchParams(window.location.search);
  const queryValue = params.get("perf");
  if (queryValue === "1") {
    persistPerfEnabled(true);
    return true;
  }

  if (queryValue === "0") {
    persistPerfEnabled(false);
    return false;
  }

  return readPersistedPerfEnabled();
}

export function isPerfEnabled() {
  if (!store.initialized) {
    store.enabled = resolvePerfEnabled();
    store.initialized = true;
    updatePerfSnapshot();
  }

  return store.enabled;
}

export function measurePerf<T>(name: PerfMetricName, fn: () => T): T {
  if (!isPerfEnabled() || typeof performance === "undefined") {
    return fn();
  }

  const start = performance.now();
  try {
    return fn();
  } finally {
    recordPerfSample(name, performance.now() - start);
  }
}

export function recordPerfSample(name: PerfMetricName, duration: number) {
  if (!isPerfEnabled()) {
    return;
  }

  const previous = store.metrics.get(name);
  const count = (previous?.count ?? 0) + 1;
  const next: PerfMetricSnapshot = {
    name,
    count,
    last: duration,
    avg: previous ? previous.avg + (duration - previous.avg) / count : duration,
    max: previous ? Math.max(previous.max, duration) : duration,
    updatedAt: Date.now(),
  };

  store.metrics.set(name, next);
  updatePerfSnapshot();
  schedulePerfListeners();
}

export function subscribePerfMetrics(listener: () => void) {
  store.listeners.add(listener);
  return () => {
    store.listeners.delete(listener);
  };
}

export function getPerfMetricsSnapshot() {
  isPerfEnabled();
  return store.snapshot;
}

export function resetPerfMetrics() {
  store.metrics.clear();
  updatePerfSnapshot();
  schedulePerfListeners();
}
