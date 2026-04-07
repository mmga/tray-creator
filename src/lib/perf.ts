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

interface PerfStore {
  enabled: boolean;
  initialized: boolean;
  metrics: Map<PerfMetricName, PerfMetricSnapshot>;
  listeners: Set<() => void>;
}

const PERF_STORAGE_KEY = "tray-creator:perf";

const store: PerfStore = {
  enabled: false,
  initialized: false,
  metrics: new Map(),
  listeners: new Set(),
};

function notifyPerfListeners() {
  store.listeners.forEach((listener) => listener());
}

function resolvePerfEnabled() {
  if (typeof window === "undefined") {
    return false;
  }

  const params = new URLSearchParams(window.location.search);
  const queryValue = params.get("perf");
  if (queryValue === "1") {
    window.localStorage.setItem(PERF_STORAGE_KEY, "1");
    return true;
  }

  if (queryValue === "0") {
    window.localStorage.removeItem(PERF_STORAGE_KEY);
    return false;
  }

  return window.localStorage.getItem(PERF_STORAGE_KEY) === "1";
}

export function isPerfEnabled() {
  if (!store.initialized) {
    store.enabled = resolvePerfEnabled();
    store.initialized = true;
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
  notifyPerfListeners();
}

export function subscribePerfMetrics(listener: () => void) {
  store.listeners.add(listener);
  return () => {
    store.listeners.delete(listener);
  };
}

export function getPerfMetricsSnapshot() {
  const enabled = isPerfEnabled();
  return {
    enabled,
    metrics: enabled ? Array.from(store.metrics.values()) : [],
  };
}

export function resetPerfMetrics() {
  store.metrics.clear();
  notifyPerfListeners();
}
