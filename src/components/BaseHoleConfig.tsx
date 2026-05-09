"use client";

import { useEffect } from "react";
import {
  BASE_HOLE_CONFIG,
  getBaseHoleMinBaseThickness,
  getBaseHoleMinBottomWall,
  getBaseHolePreset,
} from "@/lib/config";
import type { BaseHolePresetKey } from "@/types/tray";
import { Circle } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";

interface BaseHoleConfigFields {
  enableBaseHole: boolean;
  baseThickness: number;
}

interface BaseHoleConfigProps<TParams extends BaseHoleConfigFields>
  extends BaseHoleConfigFields {
  resolvedBaseHoleSize: BaseHolePresetKey;
  updateParam: <K extends keyof TParams>(
    key: K,
    value: TParams[K],
  ) => void;
  collapsible?: boolean;
  defaultOpen?: boolean;
}

export function BaseHoleConfig<TParams extends BaseHoleConfigFields>({
  enableBaseHole,
  resolvedBaseHoleSize,
  baseThickness,
  updateParam,
  collapsible = false,
  defaultOpen = true,
}: BaseHoleConfigProps<TParams>) {
  const preset = getBaseHolePreset(resolvedBaseHoleSize);
  const minBaseThickness = getBaseHoleMinBaseThickness(resolvedBaseHoleSize);
  const minBottomWall = getBaseHoleMinBottomWall(resolvedBaseHoleSize);

  useEffect(() => {
    if (!enableBaseHole || baseThickness >= minBaseThickness) {
      return;
    }

    updateParam("baseThickness", minBaseThickness as TParams["baseThickness"]);
  }, [baseThickness, enableBaseHole, minBaseThickness, updateParam]);

  return (
    <div className="iron-panel rounded-sm p-4">
      <SectionHeader
        icon={Circle}
        title="底板孔位"
        collapsible={collapsible}
        defaultOpen={defaultOpen}
        summary={
          enableBaseHole
            ? `磁吸孔 自动匹配 ⌀${preset.diameter}mm × ${preset.depth}mm`
            : "普通托盘"
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => updateParam("enableBaseHole", false as TParams["enableBaseHole"])}
              className={`px-3 py-2 text-xs font-bold tracking-wider uppercase border transition-all duration-200 cursor-pointer ${
                !enableBaseHole
                  ? "bg-primary/15 text-primary border-primary/50 shadow-inner"
                  : "bg-[#1c1a16] text-muted-foreground border-[#2e2a24] hover:border-[#3d372e]"
              }`}
            >
              普通托盘
            </button>
            <button
              type="button"
              onClick={() => updateParam("enableBaseHole", true as TParams["enableBaseHole"])}
              className={`px-3 py-2 text-xs font-bold tracking-wider uppercase border transition-all duration-200 cursor-pointer ${
                enableBaseHole
                  ? "bg-primary/15 text-primary border-primary/50 shadow-inner"
                  : "bg-[#1c1a16] text-muted-foreground border-[#2e2a24] hover:border-[#3d372e]"
              }`}
            >
              磁吸孔
            </button>
          </div>

          {enableBaseHole ? (
            <div className="space-y-3">
              <div className="rounded border border-dashed border-[#3d372e] px-3 py-2 text-[11px] text-muted-foreground/70">
                规格按配置自动匹配，大底座会自动切换到更大更厚的磁吸孔。
              </div>

              <div className="space-y-1.5 text-[11px] font-mono text-muted-foreground/70 bg-[#1c1a16] border border-[#2e2a24] p-2.5">
                <div className="flex justify-between">
                  <span>自动规格</span>
                  <span className="text-foreground/80">
                    {preset.label}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>磁铁孔</span>
                  <span className="text-foreground/80">
                    ⌀{preset.diameter}mm × {preset.depth}mm
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>顶壁</span>
                  <span className="text-foreground/80">{BASE_HOLE_CONFIG.topWall}mm</span>
                </div>
                <div className="flex justify-between">
                  <span>底壁</span>
                  <span className="text-foreground/80">
                    {(baseThickness - BASE_HOLE_CONFIG.topWall - preset.depth).toFixed(1)}mm
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>最小底厚</span>
                  <span className="text-foreground/80">{minBaseThickness.toFixed(1)}mm</span>
                </div>
                <div className="flex justify-between">
                  <span>最小底壁</span>
                  <span className="text-foreground/80">{minBottomWall.toFixed(1)}mm</span>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </SectionHeader>
    </div>
  );
}
