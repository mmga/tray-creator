import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export const EDIT_SIDEBAR_RAIL_WIDTH = 68;

export interface EditSidebarTab {
  id: string;
  label: string;
  summary: string;
  icon: LucideIcon;
  content: ReactNode;
}

interface EditSidebarProps {
  tabs: EditSidebarTab[];
  activeTabId: string | null;
  onTabChange: (tabId: string | null) => void;
  selectionCount: number;
}

export default function EditSidebar({
  tabs,
  activeTabId,
  onTabChange,
  selectionCount,
}: EditSidebarProps) {
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? null;

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#120f0c] text-foreground lg:flex-row">
      <nav aria-label="布局工具分类" className="flex h-14 w-full shrink-0 flex-row border-b border-[#2e2a24] bg-[linear-gradient(180deg,rgba(97,75,43,0.16),rgba(18,15,12,0.96))] px-2 py-1.5 lg:h-auto lg:w-[68px] lg:flex-col lg:border-b-0 lg:border-r lg:py-3">
        <div className="flex min-h-0 flex-1 flex-row gap-2 lg:flex-col">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.id === activeTabId;

            return (
              <button
                key={tab.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => onTabChange(isActive ? null : tab.id)}
                className={`group flex min-h-0 flex-1 flex-row items-center justify-center gap-2 rounded-sm border px-2 py-2 text-center transition-colors lg:min-h-[108px] lg:flex-none lg:flex-col lg:justify-start lg:gap-3 lg:py-3 ${isActive
                  ? "border-[#8e6f3a] bg-[#241b11] text-[#f3dfb6] shadow-[inset_0_0_0_1px_rgba(216,194,154,0.08)]"
                  : "border-[#3a3025] bg-[#15110d] text-[#ccbda4] hover:border-[#5a4b36] hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span
                  className="text-[11px] font-semibold uppercase tracking-[0.22em] [writing-mode:horizontal-tb] lg:[writing-mode:vertical-rl]"
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-3 hidden rounded-sm border border-[#3d372e] bg-[#15110d] px-1.5 py-2 text-center text-[9px] uppercase tracking-[0.2em] text-muted-foreground/60 lg:block">
          更多
        </div>
      </nav>

      {activeTab && (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="border-b border-[#30291f] bg-[linear-gradient(180deg,rgba(97,75,43,0.18),rgba(18,15,12,0.95))] px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#d8c29a]">
                  {activeTab.label}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{activeTab.summary}</div>
              </div>
              <div className="rounded-sm border border-[#4b4032] bg-[#1a1611] px-2 py-1 text-[11px] font-mono text-[#ccbda4]">
                {selectionCount > 0 ? `${selectionCount} selected` : "idle"}
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {activeTab.content}
          </div>
        </div>
      )}
    </div>
  );
}
