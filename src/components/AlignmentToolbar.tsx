import { useMemo } from "react";
import { AlignCenterHorizontal, FlipHorizontal } from "lucide-react";
import type { FreeSlot, SteppedSlot } from "@/types/custom-tray";
import type { SymmetryInsertSlot, SymmetrySlot } from "@/lib/layout-symmetry";
import AlignPanel from "./canvas/AlignPanel";
import EditSidebar from "./canvas/EditSidebar";
import MirrorPanel from "./canvas/MirrorPanel";

interface AlignmentToolbarProps {
  selectedIds: Set<string>;
  slots: Array<FreeSlot | SteppedSlot>;
  selectedSlots?: SymmetrySlot[];
  unselectedSlots?: Array<FreeSlot | SteppedSlot>;
  onUpdateSlots: (updates: Update[]) => void;
  onInsertSlots?: (slots: SymmetryInsertSlot[]) => void;
  enableCopyPreview: boolean;
  spacing: number;
  trayWidth: number;
  trayDepth: number;
  activeTabId: string | null;
  onActiveTabChange: (tabId: string | null) => void;
  variant?: "desktop" | "mobile";
}

type Update = { id: string; x: number; y: number; rotation?: number };

export default function AlignmentToolbar({
  selectedIds,
  slots,
  selectedSlots,
  unselectedSlots,
  onUpdateSlots,
  onInsertSlots,
  enableCopyPreview,
  spacing,
  trayWidth,
  trayDepth,
  activeTabId,
  onActiveTabChange,
  variant = "desktop",
}: AlignmentToolbarProps) {
  const selected = useMemo(
    () => selectedSlots ?? (slots.filter((slot) => selectedIds.has(slot.id)) as SymmetrySlot[]),
    [selectedIds, selectedSlots, slots],
  );
  const unselected = useMemo(
    () => unselectedSlots ?? slots.filter((slot) => !selectedIds.has(slot.id)),
    [selectedIds, slots, unselectedSlots],
  );
  const tabs = [
    {
      id: "align",
      label: "对齐",
      summary: "边缘对齐与等距排布",
      icon: AlignCenterHorizontal,
      content: <AlignPanel selectedSlots={selected} onUpdateSlots={onUpdateSlots} spacing={spacing} />,
    },
    {
      id: "mirror",
      label: "镜像",
      summary: "按托盘中心轴翻转或复制选区",
      icon: FlipHorizontal,
      content: (
        <MirrorPanel
          allSlots={slots}
          selectedSlots={selected}
          unselectedSlots={unselected}
          onUpdateSlots={onUpdateSlots}
          onInsertSlots={onInsertSlots}
          enableCopyPreview={enableCopyPreview}
          spacing={spacing}
          trayWidth={trayWidth}
          trayDepth={trayDepth}
        />
      ),
    },
  ];

  return (
    <EditSidebar
      tabs={tabs}
      activeTabId={activeTabId}
      onTabChange={onActiveTabChange}
      selectionCount={selected.length}
      variant={variant}
    />
  );
}
