import { startTransition, useCallback, useEffect, useState } from "react";
import { Copy, FlipHorizontal, FlipVertical } from "lucide-react";
import type { FreeSlot, SteppedSlot } from "@/types/custom-tray";
import { getEllipsePolygon, polygonsIntersect } from "@/lib/collision";
import { getFreeSlotProfileGeometry } from "@/lib/slot-definitions";
import { useToast } from "@/hooks/useToast";
import {
  buildMirrorInsertSlots,
  buildMirrorMoveUpdates,
  countOutOfBoundsSlots,
  type SymmetryInsertSlot,
  type SymmetryMode,
  type SymmetrySlot,
} from "@/lib/layout-symmetry";

type SlotUpdate = { id: string; x: number; y: number; rotation?: number };

const GEOMETRY_EPSILON = 0.05;

interface MirrorPanelProps {
  allSlots: Array<FreeSlot | SteppedSlot>;
  selectedSlots: SymmetrySlot[];
  unselectedSlots: Array<FreeSlot | SteppedSlot>;
  onUpdateSlots: (updates: SlotUpdate[]) => void;
  onInsertSlots?: (slots: SymmetryInsertSlot[]) => void;
  enableCopyPreview: boolean;
  spacing: number;
  trayWidth: number;
  trayDepth: number;
  ellipseProfileExponent?: number;
}

function buildCollisionPolygon(
  slot: Pick<
    FreeSlot,
    | "x"
    | "y"
    | "width"
    | "height"
    | "rotation"
    | "shape"
    | "slotWidth"
    | "slotHeight"
    | "outerOffset"
    | "profileExponent"
  >,
  spacing: number,
  ellipseProfileExponent?: number,
) {
  const profile = getFreeSlotProfileGeometry(slot);
  const margin = spacing / 2 + profile.outerOffset;
  return getEllipsePolygon(
    slot.x,
    slot.y,
    profile.width,
    profile.height,
    slot.rotation,
    margin,
    12,
    profile.profileExponent ?? ellipseProfileExponent,
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
  ellipseProfileExponent?: number,
) {
  const candidatePolygon = buildCollisionPolygon(
    candidate,
    spacing,
    ellipseProfileExponent,
  );
  return others.some((other) =>
    polygonsIntersect(
      candidatePolygon,
      buildCollisionPolygon(other, spacing, ellipseProfileExponent),
    ),
  );
}

export default function MirrorPanel({
  allSlots,
  selectedSlots,
  unselectedSlots,
  onUpdateSlots,
  onInsertSlots,
  enableCopyPreview,
  spacing,
  trayWidth,
  trayDepth,
  ellipseProfileExponent,
}: MirrorPanelProps) {
  const { toast } = useToast();
  const hasSelection = selectedSlots.length > 0;
  const [copyPreviews, setCopyPreviews] = useState<{
    mirrorX: ReturnType<typeof evaluateMirrorCopy> | null;
    mirrorY: ReturnType<typeof evaluateMirrorCopy> | null;
  }>({ mirrorX: null, mirrorY: null });
  const actionBtnClass = "flex h-9 items-center justify-center gap-1.5 rounded-sm border border-[#3a352c] bg-[#1a1813] px-3 text-xs text-[#d8d1c5] transition-colors hover:border-[#5d5547] hover:bg-[#252119] hover:text-white disabled:cursor-not-allowed disabled:opacity-35";
  const previewTagSafeClass = "inline-flex items-center rounded-sm border border-[#2a3a25] bg-[#152012] px-2.5 py-1 text-[10px] text-[#6dba62]";
  const previewTagWarnClass = "inline-flex items-center rounded-sm border border-[#3a3520] bg-[#201e12] px-2.5 py-1 text-[10px] text-[#cba84e]";

  const evaluateMirrorCopy = useCallback((mode: SymmetryMode) => {
    const inserts = buildMirrorInsertSlots(selectedSlots, trayWidth, trayDepth, "tray", mode);

    const acceptedInserts: SymmetryInsertSlot[] = [];
    let skippedDuplicateCount = 0;
    let skippedCollisionCount = 0;

    inserts.forEach((insertSlot) => {
      const isDuplicate =
        allSlots.some((existing) => isSameGeometry(insertSlot, existing)) ||
        acceptedInserts.some((existing) => isSameGeometry(insertSlot, existing));

      if (isDuplicate) {
        skippedDuplicateCount += 1;
        return;
      }

      if (
        hasSpacingCollision(
          insertSlot,
          [...allSlots, ...acceptedInserts],
          spacing,
          ellipseProfileExponent,
        )
      ) {
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
        ellipseProfileExponent,
      ),
    };
  }, [allSlots, ellipseProfileExponent, selectedSlots, spacing, trayDepth, trayWidth]);

  useEffect(() => {
    if (!enableCopyPreview || !hasSelection) {
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
  }, [enableCopyPreview, evaluateMirrorCopy, hasSelection]);

  const handleMirrorMove = (mode: SymmetryMode) => {
    if (!hasSelection) {
      return;
    }

    const updates = buildMirrorMoveUpdates(selectedSlots, trayWidth, trayDepth, "tray", mode);
    if (updates.length === 0) {
      return;
    }

    onUpdateSlots(updates);

    const nextSlots = updates
      .map((update) => {
        const original = selectedSlots.find((slot) => slot.id === update.id);
        if (!original) {
          return null;
        }

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
      ellipseProfileExponent,
    );
    const collisionCount = nextSlots.reduce((count, nextSlot) => {
      return (
        count +
        (hasSpacingCollision(
          nextSlot,
          unselectedSlots,
          spacing,
          ellipseProfileExponent,
        )
          ? 1
          : 0)
      );
    }, 0);

    if (outOfBoundsCount > 0) {
      toast("info", `镜像后有 ${outOfBoundsCount} 个槽位超出托盘边界，请继续调整。`);
    }

    if (collisionCount > 0) {
      toast("info", `镜像后有 ${collisionCount} 个槽位会与现有布局产生间距冲突。`);
    }
  };

  const handleMirrorCopy = (mode: SymmetryMode) => {
    if (!onInsertSlots || !hasSelection) {
      return;
    }

    const { acceptedInserts, skippedDuplicateCount, skippedCollisionCount, outOfBoundsCount } = evaluateMirrorCopy(mode);

    if (acceptedInserts.length === 0) {
      toast("info", "镜像复制没有生成新的有效槽位。");
      return;
    }

    onInsertSlots(acceptedInserts);

    if (skippedDuplicateCount > 0 || skippedCollisionCount > 0) {
      const parts: string[] = [];
      if (skippedDuplicateCount > 0) {
        parts.push(`${skippedDuplicateCount} 个副本与现有槽位重合`);
      }
      if (skippedCollisionCount > 0) {
        parts.push(`${skippedCollisionCount} 个副本会产生间距冲突`);
      }
      toast("info", `镜像复制已自动跳过：${parts.join("，")}。`);
    }

    if (outOfBoundsCount > 0) {
      toast("info", `镜像副本中有 ${outOfBoundsCount} 个槽位超出托盘边界，请继续调整。`);
    }
  };

  const formatCopyPreview = (
    label: string,
    preview: ReturnType<typeof evaluateMirrorCopy> | null,
  ) => {
    if (!preview) {
      return { text: `${label}预检`, hasIssue: false };
    }

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

    const hasIssue = parts.length > 0;
    return {
      text: hasIssue ? `${label}${parts.join("/")}` : `${label}安全`,
      hasIssue,
    };
  };

  const previewX = formatCopyPreview("左右", copyPreviews.mirrorX);
  const previewY = formatCopyPreview("上下", copyPreviews.mirrorY);

  return (
    <div className="space-y-4">
      <section className="border border-[#312a21] bg-[#17130f] p-3">
        <div className="mb-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d6c6a5]">镜像移动</div>
          <div className="mt-1 text-[10px] text-muted-foreground/70">以托盘中心轴翻转当前选中的凹槽。</div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button className={actionBtnClass} disabled={!hasSelection} onClick={() => handleMirrorMove("mirror-x")}>
            <FlipHorizontal size={15} /> 左右镜
          </button>
          <button className={actionBtnClass} disabled={!hasSelection} onClick={() => handleMirrorMove("mirror-y")}>
            <FlipVertical size={15} /> 上下镜
          </button>
        </div>
      </section>

      <section className="border border-[#312a21] bg-[#17130f] p-3">
        <div className="mb-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d6c6a5]">镜像复制</div>
          <div className="mt-1 text-[10px] text-muted-foreground/70">生成对称副本，并自动过滤重合或间距冲突。</div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button className={actionBtnClass} disabled={!hasSelection || !onInsertSlots} onClick={() => handleMirrorCopy("mirror-x")}>
            <Copy size={15} /> 左右复
          </button>
          <button className={actionBtnClass} disabled={!hasSelection || !onInsertSlots} onClick={() => handleMirrorCopy("mirror-y")}>
            <Copy size={15} /> 上下复
          </button>
        </div>

        {enableCopyPreview && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <span className={!copyPreviews.mirrorX ? previewTagWarnClass : previewX.hasIssue ? previewTagWarnClass : previewTagSafeClass} data-symmetry-preview="mirror-x">
              {previewX.text}
            </span>
            <span className={!copyPreviews.mirrorY ? previewTagWarnClass : previewY.hasIssue ? previewTagWarnClass : previewTagSafeClass} data-symmetry-preview="mirror-y">
              {previewY.text}
            </span>
          </div>
        )}
      </section>
    </div>
  );
}
