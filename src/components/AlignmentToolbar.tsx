import { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlignLeft, AlignCenterHorizontal, AlignRight,
  AlignStartVertical, AlignCenterVertical, AlignEndVertical,
  Rows2,
  Columns2,
  FlipHorizontal,
  FlipVertical,
  Copy,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { FreeSlot, type SteppedSlot } from "@/types/custom-tray";
import { getSlotTolerance } from "@/lib/config";
import { getEllipsePolygon, polygonsIntersect } from "@/lib/collision";
import { useToast } from "@/hooks/useToast";
import {
  buildMirrorInsertSlots,
  buildMirrorMoveUpdates,
  countOutOfBoundsSlots,
  type SymmetryInsertSlot,
  type SymmetryAxisSource,
  type SymmetryMode,
  type SymmetrySlot,
} from "@/lib/layout-symmetry";

// ── 常量与工具 ──────────────────────────────
const STEP = 0.2; // 对齐步长 mm
const roundToStep = (val: number) => Math.round(val / STEP) * STEP;

type AlignType = 'left' | 'center-x' | 'right' | 'top' | 'center-y' | 'bottom';
type ArrangeType = 'row' | 'column';
type Update = { id: string; x: number; y: number; rotation?: number };
const GEOMETRY_EPSILON = 0.05;

function buildCollisionPolygon(
  slot: Pick<FreeSlot, "x" | "y" | "width" | "height" | "rotation">,
  spacing: number,
) {
  const margin = spacing / 2 + getSlotTolerance(slot.width) / 2;
  return getEllipsePolygon(
    slot.x,
    slot.y,
    slot.width,
    slot.height,
    slot.rotation,
    margin,
    12,
  );
}

function isSameGeometry(
  left: Pick<FreeSlot, "x" | "y" | "width" | "height" | "rotation" | "shape">,
  right: Pick<FreeSlot, "x" | "y" | "width" | "height" | "rotation" | "shape">,
) {
  const within = (a: number, b: number) => Math.abs(a - b) < GEOMETRY_EPSILON;
  return (
    left.shape === right.shape &&
    within(left.x, right.x) &&
    within(left.y, right.y) &&
    within(left.width, right.width) &&
    within(left.height, right.height) &&
    within(left.rotation, right.rotation)
  );
}

function hasSpacingCollision(
  candidate: SymmetryInsertSlot,
  others: Array<FreeSlot | SteppedSlot | SymmetryInsertSlot>,
  spacing: number,
) {
  const candidatePolygon = buildCollisionPolygon(candidate, spacing);
  return others.some((other) => {
    const otherPolygon = buildCollisionPolygon(other, spacing);
    return polygonsIntersect(candidatePolygon, otherPolygon);
  });
}

/** 计算旋转椭圆的 AABB 半尺寸（含公差） */
function getSlotBounds(slot: FreeSlot) {
  const rad = ((slot.rotation || 0) * Math.PI) / 180;
  const a = (slot.width + getSlotTolerance(slot.width)) / 2;
  const b = (slot.height + getSlotTolerance(slot.height)) / 2;
  return {
    halfW: Math.sqrt((a * Math.cos(rad)) ** 2 + (b * Math.sin(rad)) ** 2),
    halfH: Math.sqrt((a * Math.sin(rad)) ** 2 + (b * Math.cos(rad)) ** 2),
  };
}

// ── 组件 ──────────────────────────────

interface AlignmentToolbarProps {
  selectedIds: Set<string>;
  slots: Array<FreeSlot | SteppedSlot>;
  onUpdateSlots: (updates: Update[]) => void;
  onInsertSlots?: (slots: SymmetryInsertSlot[]) => void;
  enableCopyPreview: boolean;
  axisSource: SymmetryAxisSource;
  onAxisSourceChange: (source: SymmetryAxisSource) => void;
  spacing: number;
  trayWidth: number;
  trayDepth: number;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function AlignmentToolbar({ selectedIds, slots, onUpdateSlots, onInsertSlots, enableCopyPreview, axisSource, onAxisSourceChange, spacing, trayWidth, trayDepth, collapsed = false, onToggleCollapse }: AlignmentToolbarProps) {
  const { toast } = useToast();
  const [sectionOpen, setSectionOpen] = useState({
    align: true,
    mirror: true,
  });
  const [copyPreviews, setCopyPreviews] = useState<{
    mirrorX: ReturnType<typeof evaluateMirrorCopy> | null;
    mirrorY: ReturnType<typeof evaluateMirrorCopy> | null;
  }>({ mirrorX: null, mirrorY: null });
  const selected = useMemo(
    () => slots.filter((slot) => selectedIds.has(slot.id)) as SymmetrySlot[],
    [selectedIds, slots],
  );
  const unselected = useMemo(
    () => slots.filter((slot) => !selectedIds.has(slot.id)),
    [selectedIds, slots],
  );
  const hasSelection = selected.length > 0;
  const hasMultiple = selected.length > 1;

  /** 获取选中项的总包围盒 */
  const getSelectionBounds = (selected: FreeSlot[]) => {
    if (selected.length === 0) return null;

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    selected.forEach(s => {
      const { halfW, halfH } = getSlotBounds(s);
      minX = Math.min(minX, s.x - halfW);
      maxX = Math.max(maxX, s.x + halfW);
      minY = Math.min(minY, s.y - halfH);
      maxY = Math.max(maxY, s.y + halfH);
    });

    return { minX, maxX, minY, maxY };
  };

  const getSelectionCenter = (selected: FreeSlot[]) => {
    const bounds = getSelectionBounds(selected);
    if (!bounds) return null;
    return {
      cx: (bounds.minX + bounds.maxX) / 2,
      cy: (bounds.minY + bounds.maxY) / 2,
    };
  };

  // ── 选中项之间的相对对齐 ──────────

  const handleAlign = (type: AlignType) => {
    if (selected.length < 2) return;

    // 仅在需要时计算完整包围盒
    const bounds = getSelectionBounds(selected);
    if (!bounds) return;
    const { minX, maxX, minY, maxY } = bounds;

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const updates: Update[] = [];

    switch (type) {
      case 'left':
        selected.forEach(s => {
          const { halfW } = getSlotBounds(s);
          updates.push({ id: s.id, x: roundToStep(minX + halfW), y: s.y });
        });
        break;
      case 'center-x':
        selected.forEach(s => {
          updates.push({ id: s.id, x: roundToStep(centerX), y: s.y });
        });
        break;
      case 'right':
        selected.forEach(s => {
          const { halfW } = getSlotBounds(s);
          updates.push({ id: s.id, x: roundToStep(maxX - halfW), y: s.y });
        });
        break;
      case 'top':
        selected.forEach(s => {
          const { halfH } = getSlotBounds(s);
          updates.push({ id: s.id, x: s.x, y: roundToStep(maxY - halfH) });
        });
        break;
      case 'center-y':
        selected.forEach(s => {
          updates.push({ id: s.id, x: s.x, y: roundToStep(centerY) });
        });
        break;
      case 'bottom':
        selected.forEach(s => {
          const { halfH } = getSlotBounds(s);
          updates.push({ id: s.id, x: s.x, y: roundToStep(minY + halfH) });
        });
        break;
    }

    if (updates.length > 0) onUpdateSlots(updates);
  };

  const handleArrange = (type: ArrangeType) => {
    if (selected.length < 2) return;

    const center = getSelectionCenter(selected);
    if (!center) return;
    const updates: Update[] = [];

    if (type === 'row') {
      const sorted = [...selected].sort((a, b) => a.x - b.x);
      const totalWidth = sorted.reduce((sum, slot) => sum + getSlotBounds(slot).halfW * 2, 0);
      const totalGap = spacing * (sorted.length - 1);
      const totalSpan = totalWidth + totalGap;

      let cursor = center.cx - totalSpan / 2;
      sorted.forEach((slot) => {
        const { halfW } = getSlotBounds(slot);
        const x = cursor + halfW;
        updates.push({ id: slot.id, x: roundToStep(x), y: roundToStep(center.cy) });
        cursor += halfW * 2 + spacing;
      });
    } else {
      const sorted = [...selected].sort((a, b) => a.y - b.y);
      const totalHeight = sorted.reduce((sum, slot) => sum + getSlotBounds(slot).halfH * 2, 0);
      const totalGap = spacing * (sorted.length - 1);
      const totalSpan = totalHeight + totalGap;

      let cursor = center.cy - totalSpan / 2;
      sorted.forEach((slot) => {
        const { halfH } = getSlotBounds(slot);
        const y = cursor + halfH;
        updates.push({ id: slot.id, x: roundToStep(center.cx), y: roundToStep(y) });
        cursor += halfH * 2 + spacing;
      });
    }

    if (updates.length > 0) onUpdateSlots(updates);
  };

  const handleMirrorMove = (mode: SymmetryMode) => {
    if (selected.length === 0) return;

    const updates = buildMirrorMoveUpdates(
      selected,
      trayWidth,
      trayDepth,
      axisSource,
      mode,
    );

    if (updates.length > 0) {
      onUpdateSlots(updates);

      const nextSlots = updates
        .map((update) => {
          const original = selected.find((slot) => slot.id === update.id);
          if (!original) return null;

          return {
            ...original,
            x: update.x,
            y: update.y,
            rotation: update.rotation ?? original.rotation,
          };
        })
        .filter((slot): slot is SymmetrySlot => slot !== null);

      const outOfBoundsCount = countOutOfBoundsSlots(
        nextSlots,
        trayWidth,
        trayDepth,
      );
      const collisionCount = nextSlots.reduce((count, nextSlot) => {
        return count + (hasSpacingCollision(nextSlot, unselected, spacing) ? 1 : 0);
      }, 0);

      if (outOfBoundsCount > 0) {
        toast(
          "info",
          `镜像后有 ${outOfBoundsCount} 个槽位超出托盘边界，请继续调整。`,
        );
      }

      if (collisionCount > 0) {
        toast(
          "info",
          `镜像后有 ${collisionCount} 个槽位会与现有布局产生间距冲突。`,
        );
      }
    }
  };

  const evaluateMirrorCopy = useCallback(
    (mode: SymmetryMode) => {
      const inserts = buildMirrorInsertSlots(
        selected,
        trayWidth,
        trayDepth,
        axisSource,
        mode,
      );

      const acceptedInserts: SymmetryInsertSlot[] = [];
      let skippedDuplicateCount = 0;
      let skippedCollisionCount = 0;

      inserts.forEach((insertSlot) => {
        const isDuplicate =
          slots.some((existing) => isSameGeometry(insertSlot, existing)) ||
          acceptedInserts.some((existing) => isSameGeometry(insertSlot, existing));

        if (isDuplicate) {
          skippedDuplicateCount += 1;
          return;
        }

        if (hasSpacingCollision(insertSlot, [...slots, ...acceptedInserts], spacing)) {
          skippedCollisionCount += 1;
          return;
        }

        acceptedInserts.push(insertSlot);
      });

      return {
        acceptedInserts,
        skippedDuplicateCount,
        skippedCollisionCount,
        outOfBoundsCount: countOutOfBoundsSlots(
          acceptedInserts,
          trayWidth,
          trayDepth,
        ),
      };
    },
    [axisSource, selected, slots, spacing, trayDepth, trayWidth],
  );

  const handleMirrorCopy = (mode: SymmetryMode) => {
    if (!onInsertSlots) return;
    if (selected.length === 0) return;

    const {
      acceptedInserts,
      skippedDuplicateCount,
      skippedCollisionCount,
      outOfBoundsCount,
    } = evaluateMirrorCopy(mode);

    if (acceptedInserts.length === 0) {
      toast("info", "镜像复制没有生成新的有效槽位。");
      return;
    }

    onInsertSlots(acceptedInserts);

    if (skippedDuplicateCount > 0 || skippedCollisionCount > 0) {
      const parts = [];
      if (skippedDuplicateCount > 0) {
        parts.push(`${skippedDuplicateCount} 个副本与现有槽位重合`);
      }
      if (skippedCollisionCount > 0) {
        parts.push(`${skippedCollisionCount} 个副本会产生间距冲突`);
      }
      toast("info", `镜像复制已自动跳过：${parts.join("，")}。`);
    }

    if (outOfBoundsCount > 0) {
      toast(
        "info",
        `镜像副本中有 ${outOfBoundsCount} 个槽位超出托盘边界，请继续调整。`,
      );
    }
  };

  // ── UI ──────────

  const sectionTitleClass = "text-[11px] font-semibold tracking-[0.18em] text-[#d6c6a5] uppercase";
  const sectionSummaryClass = "text-[10px] text-muted-foreground/70";
  const actionBtnClass = "flex h-9 items-center justify-center gap-1.5 rounded-sm border border-[#3a352c] bg-[#1a1813] px-3 text-xs text-[#d8d1c5] transition-colors hover:border-[#5d5547] hover:bg-[#252119] hover:text-white disabled:cursor-not-allowed disabled:opacity-35";
  const axisBtnClass = "h-8 rounded-sm border border-[#3a352c] bg-[#181611] px-3 text-[11px] text-[#c8bda8] transition-colors hover:border-[#5d5547] hover:text-white disabled:cursor-not-allowed disabled:opacity-35";
  const previewTagClass = "inline-flex items-center rounded-sm border border-[#3a352c] bg-[#181611] px-2.5 py-1 text-[10px] text-[#cbbfa9]";

  const toggleSection = (key: "align" | "mirror") => {
    setSectionOpen((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  useEffect(() => {
    if (!enableCopyPreview || !hasSelection || collapsed) {
      startTransition(() => {
        setCopyPreviews({ mirrorX: null, mirrorY: null });
      });
      return;
    }

    startTransition(() => {
      setCopyPreviews({
        mirrorX: evaluateMirrorCopy("mirror-x"),
        mirrorY: evaluateMirrorCopy("mirror-y"),
      });
    });
  }, [collapsed, enableCopyPreview, evaluateMirrorCopy, hasSelection]);

  const formatCopyPreview = (
    label: string,
    preview: ReturnType<typeof evaluateMirrorCopy> | null,
  ) => {
    if (!preview) return `${label}预检`;

    const parts: string[] = [];
    if (preview.skippedDuplicateCount > 0) {
      parts.push(`重合${preview.skippedDuplicateCount}`);
    }
    if (preview.skippedCollisionCount > 0) {
      parts.push(`冲突${preview.skippedCollisionCount}`);
    }
    if (preview.outOfBoundsCount > 0) {
      parts.push(`越界${preview.outOfBoundsCount}`);
    }

    return parts.length > 0 ? `${label}${parts.join("/")}` : `${label}安全`;
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#120f0c] text-foreground">
      <div className="border-b border-[#30291f] bg-[linear-gradient(180deg,rgba(97,75,43,0.18),rgba(18,15,12,0.95))] px-3 py-3">
        <div className={`flex items-start justify-between gap-3 ${collapsed ? "min-h-0" : "min-h-12"}`}>
          {collapsed ? (
            <div className="flex flex-1 flex-col items-center gap-3 py-1">
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#d8c29a] [writing-mode:vertical-rl]">
                编辑辅助
              </div>
              <div className="border border-[#4b4032] bg-[#1a1611] px-1.5 py-1 text-[10px] font-mono text-[#ccbda4]">
                {selected.length > 0 ? selected.length : "-"}
              </div>
            </div>
          ) : (
            <>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#d8c29a]">编辑辅助</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {selected.length > 0 ? `当前选中 ${selected.length} 个凹槽` : "先框选或点选凹槽，再使用对齐与镜像"}
                </div>
              </div>
              <div className="border border-[#4b4032] bg-[#1a1611] px-2 py-1 text-[11px] font-mono text-[#ccbda4]">
                {selected.length > 0 ? `${selected.length} selected` : "idle"}
              </div>
            </>
          )}
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-[#40372b] bg-[#17120f] text-[#d8c29a] transition-colors hover:border-[#6e5a3b] hover:text-white"
              title={collapsed ? "展开编辑面板" : "收起编辑面板"}
            >
              {collapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>

      {!collapsed && (
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
          <section className="border border-[#312a21] bg-[#17130f] p-2.5">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-1.5 py-1 text-left"
              onClick={() => toggleSection("align")}
            >
              <div>
                <div className={sectionTitleClass}>对齐</div>
                <div className={sectionSummaryClass}>边缘对齐与等距排布</div>
              </div>
              <ChevronDown className={`h-4 w-4 text-[#9f927c] transition-transform ${sectionOpen.align ? "rotate-0" : "-rotate-90"}`} />
            </button>

            {sectionOpen.align && (
              <div className="mt-2 space-y-3">
                <div>
                  <div className="mb-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70">边缘对齐</div>
                  <div className="grid grid-cols-3 gap-2">
                    <button className={actionBtnClass} disabled={!hasMultiple} onClick={() => handleAlign("left")}>
                      <AlignLeft size={15} /> 左
                    </button>
                    <button className={actionBtnClass} disabled={!hasMultiple} onClick={() => handleAlign("center-x")}>
                      <AlignCenterHorizontal size={15} /> 中
                    </button>
                    <button className={actionBtnClass} disabled={!hasMultiple} onClick={() => handleAlign("right")}>
                      <AlignRight size={15} /> 右
                    </button>
                    <button className={actionBtnClass} disabled={!hasMultiple} onClick={() => handleAlign("top")}>
                      <AlignStartVertical size={15} /> 上
                    </button>
                    <button className={actionBtnClass} disabled={!hasMultiple} onClick={() => handleAlign("center-y")}>
                      <AlignCenterVertical size={15} /> 中
                    </button>
                    <button className={actionBtnClass} disabled={!hasMultiple} onClick={() => handleAlign("bottom")}>
                      <AlignEndVertical size={15} /> 下
                    </button>
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70">自动排布</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button className={actionBtnClass} disabled={!hasMultiple} onClick={() => handleArrange("row")}>
                      <Rows2 size={15} /> 一排
                    </button>
                    <button className={actionBtnClass} disabled={!hasMultiple} onClick={() => handleArrange("column")}>
                      <Columns2 size={15} /> 一列
                    </button>
                  </div>
                  <div className="mt-2 text-[10px] text-muted-foreground/70">排布间距自动使用当前槽距 {spacing} mm。</div>
                </div>
              </div>
            )}
          </section>

          <section className="border border-[#312a21] bg-[#17130f] p-2.5">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-1.5 py-1 text-left"
              onClick={() => toggleSection("mirror")}
            >
              <div>
                <div className={sectionTitleClass}>镜像</div>
                <div className={sectionSummaryClass}>按选区轴或托盘轴做翻转与复制</div>
              </div>
              <ChevronDown className={`h-4 w-4 text-[#9f927c] transition-transform ${sectionOpen.mirror ? "rotate-0" : "-rotate-90"}`} />
            </button>

            {sectionOpen.mirror && (
              <div className="mt-2 space-y-3">
                <div>
                  <div className="mb-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70">镜像轴</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      className={`${axisBtnClass} ${axisSource === "selection" ? "border-[#8a6d3f] bg-[#2a2115] text-[#f0d8b8]" : ""}`}
                      onClick={() => onAxisSourceChange("selection")}
                      disabled={!hasSelection}
                    >
                      选区轴
                    </button>
                    <button
                      className={`${axisBtnClass} ${axisSource === "tray" ? "border-[#8a6d3f] bg-[#2a2115] text-[#f0d8b8]" : ""}`}
                      onClick={() => onAxisSourceChange("tray")}
                    >
                      托盘轴
                    </button>
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70">镜像移动</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button className={actionBtnClass} disabled={!hasSelection} onClick={() => handleMirrorMove("mirror-x")}>
                      <FlipHorizontal size={15} /> 左右镜
                    </button>
                    <button className={actionBtnClass} disabled={!hasSelection} onClick={() => handleMirrorMove("mirror-y")}>
                      <FlipVertical size={15} /> 上下镜
                    </button>
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70">镜像复制</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button className={actionBtnClass} disabled={!hasSelection || !onInsertSlots} onClick={() => handleMirrorCopy("mirror-x")}>
                      <Copy size={15} /> 左右复
                    </button>
                    <button className={actionBtnClass} disabled={!hasSelection || !onInsertSlots} onClick={() => handleMirrorCopy("mirror-y")}>
                      <Copy size={15} /> 上下复
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <span className={previewTagClass} data-symmetry-preview="mirror-x">
                    {formatCopyPreview("左右", copyPreviews.mirrorX)}
                  </span>
                  <span className={previewTagClass} data-symmetry-preview="mirror-y">
                    {formatCopyPreview("上下", copyPreviews.mirrorY)}
                  </span>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
