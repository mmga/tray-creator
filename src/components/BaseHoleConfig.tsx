"use client";

import { BASE_HOLE_CONFIG } from "@/lib/config";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Circle, type LucideIcon } from "lucide-react";

interface BaseHoleConfigProps {
  enableBaseHole: boolean;
  baseHoleSize: "19.5" | "25";
  baseThickness: number;
  updateParam: (key: any, value: any) => void;
}

function SectionHeader({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <div className="relative pb-3 mb-1">
      <div className="flex items-center gap-2.5">
        <div className="flex items-center justify-center w-6 h-6 border border-primary/40 bg-[#1c1a16]">
          <Icon className="w-3.5 h-3.5 text-primary" />
        </div>
        <h3 className="text-xs font-bold text-primary/90 tracking-[0.2em] uppercase parchment-glow">
          {title}
        </h3>
      </div>
      {/* Gold underline */}
      <div className="absolute bottom-0 left-0 right-0 h-px gold-trim opacity-40" />
    </div>
  );
}

export function BaseHoleConfig({ enableBaseHole, baseHoleSize, baseThickness, updateParam }: BaseHoleConfigProps) {
  return (
    <div className="iron-panel rounded-sm p-4 space-y-4">
      <SectionHeader icon={Circle} title="底板孔位" />

      {/* 切换按钮组 */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => updateParam("enableBaseHole", false)}
          className={`px-3 py-2 text-xs font-bold tracking-wider uppercase border transition-all duration-200 cursor-pointer ${!enableBaseHole
            ? 'bg-primary/15 text-primary border-primary/50 shadow-inner'
            : 'bg-[#1c1a16] text-muted-foreground border-[#2e2a24] hover:border-[#3d372e]'
            }`}
        >
          普通托盘
        </button>
        <button
          type="button"
          onClick={() => {
            updateParam("enableBaseHole", true);
            // 磁吸孔模式下底板厚度存在最小限制
            if (baseThickness < BASE_HOLE_CONFIG.minBaseThickness) {
              updateParam("baseThickness", BASE_HOLE_CONFIG.minBaseThickness);
            }
          }}
          className={`px-3 py-2 text-xs font-bold tracking-wider uppercase border transition-all duration-200 cursor-pointer ${enableBaseHole
            ? 'bg-primary/15 text-primary border-primary/50 shadow-inner'
            : 'bg-[#1c1a16] text-muted-foreground border-[#2e2a24] hover:border-[#3d372e]'
            }`}
        >
          磁吸孔
        </button>
      </div>

      {/* 磁吸孔规格选择 */}
      {enableBaseHole && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">孔位规格</Label>
            <Select
              value={baseHoleSize}
              onValueChange={(v: "19.5" | "25") => updateParam("baseHoleSize", v)}
            >
              <SelectTrigger className="h-8 bg-[#1c1a16] border-[#2e2a24] text-xs text-foreground hover:border-primary/40 cursor-pointer transition-all duration-200">
                <SelectValue placeholder="选择规格" />
              </SelectTrigger>
              <SelectContent className="bg-[#16140f] border-[#2e2a24]">
                <SelectItem value="25" className="text-xs text-foreground/90 cursor-pointer focus:bg-primary/10 focus:text-primary">
                  ⌀25.0mm × 1.2mm (推荐)
                </SelectItem>
                <SelectItem value="19.5" className="text-xs text-foreground/90 cursor-pointer focus:bg-primary/10 focus:text-primary">
                  ⌀19.5mm × 0.8mm
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 磁吸孔详情 */}
          <div className="space-y-1.5 text-[11px] font-mono text-muted-foreground/70 bg-[#1c1a16] border border-[#2e2a24] p-2.5">
            <div className="flex justify-between">
              <span>磁铁孔</span>
              <span className="text-foreground/80">
                ⌀{BASE_HOLE_CONFIG.presets[baseHoleSize].diameter}mm × {BASE_HOLE_CONFIG.presets[baseHoleSize].depth}mm
              </span>
            </div>
            <div className="flex justify-between">
              <span>顶壁</span>
              <span className="text-foreground/80">{BASE_HOLE_CONFIG.topWall}mm</span>
            </div>
            <div className="flex justify-between">
              <span>底壁</span>
              <span className="text-foreground/80">
                {(baseThickness - BASE_HOLE_CONFIG.topWall - BASE_HOLE_CONFIG.presets[baseHoleSize].depth).toFixed(1)}mm
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
