"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  Loader2,
  X,
  BarChart3,
  Download,
  Eye,
  Users,
  Zap,
  Globe,
  Smartphone,
  Monitor,
  Tablet,
} from "lucide-react";

// ── 类型 ──────────────────────────────────

interface StatsData {
  pv_total: number;
  uv_today: number;
  daily: { date: string; pv: number; uv: number }[];
  actions: Record<string, number>;
  referrers: Record<string, number>;
  devices: Record<string, number>;
}

interface StatsPanelProps {
  open: boolean;
  onClose: () => void;
}

// ── 工具函数 ──────────────────────────────

function formatNumber(n: number): string {
  if (n >= 10000) return (n / 1000).toFixed(1) + "k";
  return n.toLocaleString();
}

/** 漏斗转化率 */
function funnelRate(from: number, to: number): string {
  if (from <= 0) return "—";
  return ((to / from) * 100).toFixed(1) + "%";
}

/** 导出 CSV */
function exportCSV(data: StatsData) {
  const rows = [
    ["Date", "PV", "UV"],
    ...data.daily.map((d) => [d.date, String(d.pv), String(d.uv)]),
    [],
    ["Action", "Count"],
    ...Object.entries(data.actions).map(([k, v]) => [k, String(v)]),
    [],
    ["Referrer", "Count"],
    ...Object.entries(data.referrers).map(([k, v]) => [k, String(v)]),
    [],
    ["Device", "Count"],
    ...Object.entries(data.devices).map(([k, v]) => [k, String(v)]),
  ];
  const csv = rows.map((r) => (r as string[]).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `stats_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ── SVG 折线图 ────────────────────────────

function TrendChart({
  daily,
}: {
  daily: { date: string; pv: number; uv: number }[];
}) {
  const W = 520;
  const H = 160;
  const PAD = { top: 16, right: 16, bottom: 28, left: 40 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  if (daily.length === 0) {
    return (
      <div className="flex items-center justify-center h-[160px] text-xs text-muted-foreground">
        暂无趋势数据
      </div>
    );
  }

  const maxPV = Math.max(...daily.map((d) => d.pv), 1);
  const maxUV = Math.max(...daily.map((d) => d.uv), 1);
  const maxY = Math.max(maxPV, maxUV);
  const step = daily.length > 1 ? plotW / (daily.length - 1) : 0;

  const pvPoints = daily.map(
    (d, i) =>
      `${PAD.left + i * step},${PAD.top + plotH - (d.pv / maxY) * plotH}`,
  );
  const uvPoints = daily.map(
    (d, i) =>
      `${PAD.left + i * step},${PAD.top + plotH - (d.uv / maxY) * plotH}`,
  );

  // Y 轴刻度 (3 条)
  const yTicks = [0, Math.round(maxY / 2), maxY];

  // X 轴标签 (最多显示 7 个)
  const labelInterval = Math.ceil(daily.length / 7);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ maxHeight: 180 }}
    >
      {/* 网格线 */}
      {yTicks.map((tick, i) => {
        const y = PAD.top + plotH - (tick / maxY) * plotH;
        return (
          <g key={i}>
            <line
              x1={PAD.left}
              y1={y}
              x2={PAD.left + plotW}
              y2={y}
              stroke="#2e2a24"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 6}
              y={y + 3}
              textAnchor="end"
              fill="#666"
              fontSize={9}
              fontFamily="monospace"
            >
              {tick}
            </text>
          </g>
        );
      })}

      {/* X 标签 */}
      {daily.map((d, i) => {
        if (i % labelInterval !== 0 && i !== daily.length - 1) return null;
        return (
          <text
            key={i}
            x={PAD.left + i * step}
            y={H - 4}
            textAnchor="middle"
            fill="#666"
            fontSize={8}
            fontFamily="monospace"
          >
            {d.date.slice(5)}
          </text>
        );
      })}

      {/* UV 折线 (底层) */}
      <polyline
        fill="none"
        stroke="#4a7a8a"
        strokeWidth={1.5}
        strokeLinejoin="round"
        points={uvPoints.join(" ")}
        opacity={0.7}
      />
      {/* PV 折线 (顶层) */}
      <polyline
        fill="none"
        stroke="#b8963a"
        strokeWidth={2}
        strokeLinejoin="round"
        points={pvPoints.join(" ")}
      />

      {/* 数据点 */}
      {daily.map((d, i) => (
        <g key={i}>
          <circle
            cx={PAD.left + i * step}
            cy={PAD.top + plotH - (d.pv / maxY) * plotH}
            r={2.5}
            fill="#b8963a"
          />
          <circle
            cx={PAD.left + i * step}
            cy={PAD.top + plotH - (d.uv / maxY) * plotH}
            r={2}
            fill="#4a7a8a"
          />
        </g>
      ))}

      {/* 图例 */}
      <circle cx={PAD.left} cy={H - 16} r={3} fill="#b8963a" />
      <text
        x={PAD.left + 8}
        y={H - 13}
        fill="#b8963a"
        fontSize={9}
        fontFamily="monospace"
      >
        PV
      </text>
      <circle cx={PAD.left + 40} cy={H - 16} r={3} fill="#4a7a8a" />
      <text
        x={PAD.left + 48}
        y={H - 13}
        fill="#4a7a8a"
        fontSize={9}
        fontFamily="monospace"
      >
        UV
      </text>
    </svg>
  );
}

// ── 百分比条 ──────────────────────────────

function PercentBar({
  items,
}: {
  items: { label: string; value: number; color: string }[];
}) {
  const total = items.reduce((s, it) => s + it.value, 0);
  if (total <= 0) {
    return (
      <div className="text-xs text-muted-foreground text-center py-3">
        暂无数据
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {items.map(({ label, value, color }) => {
        const pct = (value / total) * 100;
        return (
          <div key={label} className="flex items-center gap-2 text-xs">
            <span className="w-16 text-muted-foreground truncate text-right">
              {label}
            </span>
            <div className="flex-1 bg-[#1c1a16] rounded-full h-3.5 overflow-hidden border border-[#2e2a2480]">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: color }}
              />
            </div>
            <span className="w-14 text-right font-mono text-foreground/70">
              {pct.toFixed(1)}%
            </span>
            <span className="w-8 text-right font-mono text-muted-foreground">
              {value}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── 主组件 ────────────────────────────────

export default function StatsPanel({ open, onClose }: StatsPanelProps) {
  const [data, setData] = useState<StatsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<"7d" | "30d">("7d");
  const hasFetched = useRef(false);

  // ESC 关闭
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, handleKeyDown]);

  // 获取数据
  const fetchData = useCallback(async (r: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/stats?range=${r}`);
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      } else {
        setError(json.error || "获取统计数据失败");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "网络错误");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 打开时自动加载
  useEffect(() => {
    if (open && !hasFetched.current) {
      hasFetched.current = true;
      fetchData(range);
    }
  }, [open, fetchData, range]);

  // 切换范围
  const handleRangeChange = (r: "7d" | "30d") => {
    setRange(r);
    fetchData(r);
  };

  if (!open) return null;

  const pvToday = data?.daily?.length
    ? data.daily[data.daily.length - 1]?.pv || 0
    : 0;
  const uvToday = data?.uv_today || 0;
  const pvTotal = data?.pv_total || 0;

  const actions = data?.actions || {};
  const referrers = data?.referrers || {};
  const devices = data?.devices || {};

  // 来源排名 Top 10
  const topReferrers = Object.entries(referrers)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // 设备分布
  const deviceItems = [
    {
      label: "Desktop",
      value: devices.desktop || 0,
      color: "#b8963a",
    },
    {
      label: "Mobile",
      value: devices.mobile || 0,
      color: "#4a7a8a",
    },
    {
      label: "Tablet",
      value: devices.tablet || 0,
      color: "#7a5a3a",
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div className="relative w-[90vw] max-w-[680px] max-h-[85vh] flex flex-col bg-[#0e0d0b] border border-[#2e2a24] shadow-2xl shadow-black/50 rounded-sm animate-fade-in">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#2e2a24]">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold tracking-wider text-primary font-[family-name:var(--font-cinzel)]">
              访问统计
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {/* 范围切换 */}
            <div className="flex items-center bg-[#1c1a16] border border-[#2e2a24] rounded-sm overflow-hidden">
              {(["7d", "30d"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => handleRangeChange(r)}
                  className={`px-2.5 py-1 text-[10px] font-mono tracking-wider transition-colors cursor-pointer ${
                    range === r
                      ? "bg-primary/20 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {r === "7d" ? "7天" : "30天"}
                </button>
              ))}
            </div>
            {data && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportCSV(data)}
                className="h-7 text-xs border-[#2e2a24] text-muted-foreground hover:bg-[#1c1a16] cursor-pointer"
              >
                <Download className="w-3 h-3 mr-1" />
                CSV
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchData(range)}
              disabled={isLoading}
              className="h-7 text-xs border-[#2e2a24] text-muted-foreground hover:bg-[#1c1a16] cursor-pointer"
            >
              {isLoading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <RefreshCw className="w-3 h-3" />
              )}
            </Button>
            <button
              onClick={onClose}
              className="p-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {error && (
            <div className="text-xs text-[#c04040] text-center p-2 bg-[#8b1a1a15] border border-[#8b1a1a50] rounded-sm">
              {error}
            </div>
          )}

          {isLoading && !data && (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              <span className="text-xs">加载统计数据...</span>
            </div>
          )}

          {data && (
            <>
              {/* ── PV/UV 概览 ── */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  {
                    icon: Eye,
                    label: "总 PV",
                    value: pvTotal,
                    color: "#b8963a",
                  },
                  {
                    icon: Eye,
                    label: "今日 PV",
                    value: pvToday,
                    color: "#eab308",
                  },
                  {
                    icon: Users,
                    label: "今日 UV",
                    value: uvToday,
                    color: "#4a7a8a",
                  },
                ].map(({ icon: Icon, label, value, color }) => (
                  <div
                    key={label}
                    className="bg-[#1c1a16] border border-[#2e2a24] rounded-sm p-3 text-center"
                  >
                    <Icon
                      className="w-4 h-4 mx-auto mb-1"
                      style={{ color }}
                    />
                    <div
                      className="text-xl font-mono font-bold"
                      style={{ color }}
                    >
                      {formatNumber(value)}
                    </div>
                    <div className="text-[10px] text-muted-foreground tracking-wider mt-0.5">
                      {label}
                    </div>
                  </div>
                ))}
              </div>

              {/* ── 趋势图 ── */}
              <div className="bg-[#1c1a16] border border-[#2e2a24] rounded-sm p-3">
                <div className="text-[10px] text-muted-foreground font-bold tracking-wider uppercase mb-2">
                  日访问趋势
                </div>
                <TrendChart daily={data.daily} />
              </div>

              {/* ── 操作事件 + 漏斗 ── */}
              <div className="bg-[#1c1a16] border border-[#2e2a24] rounded-sm p-3">
                <div className="text-[10px] text-muted-foreground font-bold tracking-wider uppercase mb-2">
                  <Zap className="w-3 h-3 inline mr-1 -mt-0.5" />
                  操作事件
                </div>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[
                    {
                      key: "generate_3d",
                      label: "生成 3D",
                      emoji: "🔨",
                    },
                    {
                      key: "export_stl",
                      label: "导出 STL",
                      emoji: "📦",
                    },
                    {
                      key: "submit_order",
                      label: "提交订单",
                      emoji: "📮",
                    },
                  ].map(({ key, label, emoji }) => (
                    <div
                      key={key}
                      className="bg-[#0e0d0b] border border-[#2e2a2480] rounded-sm p-2 text-center"
                    >
                      <div className="text-sm mb-0.5">{emoji}</div>
                      <div className="text-base font-mono font-bold text-foreground/80">
                        {formatNumber(actions[key] || 0)}
                      </div>
                      <div className="text-[9px] text-muted-foreground">
                        {label}
                      </div>
                    </div>
                  ))}
                </div>
                {/* 漏斗转化率 */}
                <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground font-mono">
                  <span>访问</span>
                  <span className="text-primary">→</span>
                  <span>
                    生成({funnelRate(pvTotal, actions.generate_3d || 0)})
                  </span>
                  <span className="text-primary">→</span>
                  <span>
                    导出(
                    {funnelRate(
                      actions.generate_3d || 0,
                      actions.export_stl || 0,
                    )}
                    )
                  </span>
                  <span className="text-primary">→</span>
                  <span>
                    下单(
                    {funnelRate(
                      actions.export_stl || 0,
                      actions.submit_order || 0,
                    )}
                    )
                  </span>
                </div>
              </div>

              {/* ── 来源分布 + 设备分布 ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 来源 */}
                <div className="bg-[#1c1a16] border border-[#2e2a24] rounded-sm p-3">
                  <div className="text-[10px] text-muted-foreground font-bold tracking-wider uppercase mb-2">
                    <Globe className="w-3 h-3 inline mr-1 -mt-0.5" />
                    来源分布
                  </div>
                  {topReferrers.length > 0 ? (
                    <div className="space-y-1">
                      {topReferrers.map(([domain, count], i) => {
                        const totalRef = Object.values(referrers).reduce(
                          (s, v) => s + v,
                          0,
                        );
                        const pct = totalRef > 0 ? (count / totalRef) * 100 : 0;
                        return (
                          <div
                            key={domain}
                            className="flex items-center gap-2 text-[11px]"
                          >
                            <span className="w-4 text-right text-muted-foreground/60 font-mono">
                              {i + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1">
                                <span className="truncate text-foreground/80">
                                  {domain}
                                </span>
                              </div>
                              <div className="bg-[#0e0d0b] rounded-full h-1.5 mt-0.5 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-[#4a7a8a]"
                                  style={{
                                    width: `${Math.max(pct, 3)}%`,
                                  }}
                                />
                              </div>
                            </div>
                            <span className="font-mono text-muted-foreground w-8 text-right">
                              {count}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground text-center py-3">
                      暂无来源数据
                    </div>
                  )}
                </div>

                {/* 设备 */}
                <div className="bg-[#1c1a16] border border-[#2e2a24] rounded-sm p-3">
                  <div className="text-[10px] text-muted-foreground font-bold tracking-wider uppercase mb-3">
                    <Smartphone className="w-3 h-3 inline mr-1 -mt-0.5" />
                    设备分布
                  </div>
                  <PercentBar items={deviceItems} />
                  {/* 设备图标列表 */}
                  <div className="grid grid-cols-3 gap-1.5 mt-3">
                    {[
                      {
                        icon: Monitor,
                        label: "Desktop",
                        value: devices.desktop || 0,
                        color: "#b8963a",
                      },
                      {
                        icon: Smartphone,
                        label: "Mobile",
                        value: devices.mobile || 0,
                        color: "#4a7a8a",
                      },
                      {
                        icon: Tablet,
                        label: "Tablet",
                        value: devices.tablet || 0,
                        color: "#7a5a3a",
                      },
                    ].map(({ icon: Icon, label, value, color }) => (
                      <div
                        key={label}
                        className="flex flex-col items-center gap-0.5 text-center"
                      >
                        <Icon className="w-4 h-4" style={{ color }} />
                        <span className="text-xs font-mono font-semibold text-foreground/80">
                          {value}
                        </span>
                        <span className="text-[9px] text-muted-foreground">
                          {label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {!data && !isLoading && !error && (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-xs">
              点击刷新获取统计数据
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
