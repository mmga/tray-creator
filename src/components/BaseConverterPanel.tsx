"use client";

import type { ReactNode } from "react";
import { ArrowRightLeft, SlidersHorizontal } from "lucide-react";
import type { BaseConverterParams } from "@/types/custom-tray";
import {
  BASE_CONVERTER_LIMITS,
  CONVERSION_CLEARANCE_PER_SIDE,
  SOURCE_BASE_STANDARDS,
  TARGET_BASE_STANDARDS,
  findSourceBaseStandard,
  findTargetBaseStandard,
  getConversionRecessDimensions,
  isBaseConversionCompatible,
} from "@/lib/base-converter-config";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ParamSlider } from "@/components/ui/ParamSlider";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { PanelShell } from "@/components/PanelShell";
import { TrayResultSummary } from "@/components/TrayResultSummary";
import { projectBaseConverterResult } from "@/lib/tray-result-projection";

interface BaseConverterPanelProps {
  params: BaseConverterParams;
  updateParam: <K extends keyof BaseConverterParams>(
    key: K,
    value: BaseConverterParams[K],
  ) => void;
  actions: ReactNode;
  isGenerating: boolean;
  isPreviewStale: boolean;
  volume: number;
}

export default function BaseConverterPanel({
  params,
  updateParam,
  actions,
  isGenerating,
  isPreviewStale,
  volume,
}: BaseConverterPanelProps) {
  const source = findSourceBaseStandard(params.sourceStandardId)
    ?? SOURCE_BASE_STANDARDS[0];
  const target = findTargetBaseStandard(params.targetStandardId)
    ?? TARGET_BASE_STANDARDS[0];
  const recess = getConversionRecessDimensions(source);
  const result = projectBaseConverterResult(params, {
    volume,
    isGenerating,
    isPreviewStale,
  });

  return (
    <PanelShell summary={<TrayResultSummary result={result} />} actions={actions}>
      <div className="flex flex-col gap-4 animate-fade-in">
        <div className="iron-panel rounded-sm p-4">
          <SectionHeader
            icon={ArrowRightLeft}
            title="标准转换"
            collapsible
            defaultOpen
            summary={`${source.name} → ${target.name}`}
          >
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-sm text-muted-foreground">原方形 / 矩形底盘</Label>
                <Select
                  value={source.id}
                  onValueChange={(value) => updateParam("sourceStandardId", value)}
                >
                  <SelectTrigger className="bg-[#1c1a16] border-[#2e2a24]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#16140f] border-[#2e2a24]">
                    {SOURCE_BASE_STANDARDS.map((standard) => (
                      <SelectItem key={standard.id} value={standard.id}>
                        {standard.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm text-muted-foreground">目标圆形 / 椭圆底盘</Label>
                <Select
                  value={target.id}
                  onValueChange={(value) => updateParam("targetStandardId", value)}
                >
                  <SelectTrigger className="bg-[#1c1a16] border-[#2e2a24]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#16140f] border-[#2e2a24]">
                    {TARGET_BASE_STANDARDS.map((standard) => {
                      const compatible = isBaseConversionCompatible(source, standard);
                      return (
                        <SelectItem
                          key={standard.id}
                          value={standard.id}
                          disabled={!compatible}
                        >
                          {standard.shape === "circle" ? "圆形" : "椭圆"} · {standard.name}
                          {!compatible ? "（尺寸不足）" : ""}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-2 rounded-sm border border-[#2e2a24] bg-[#1c1a16] p-3 text-xs">
                <div>
                  <div className="text-muted-foreground">固定单边间隙</div>
                  <div className="mt-1 font-mono text-primary">{CONVERSION_CLEARANCE_PER_SIDE.toFixed(1)} mm</div>
                </div>
                <div>
                  <div className="text-muted-foreground">最终凹槽</div>
                  <div className="mt-1 font-mono text-primary">{recess.width.toFixed(1)} × {recess.depth.toFixed(1)} mm</div>
                </div>
              </div>
            </div>
          </SectionHeader>
        </div>

        <div className="iron-panel rounded-sm p-4">
          <SectionHeader
            icon={SlidersHorizontal}
            title="结构参数"
            collapsible
            defaultOpen
            summary={`底厚 ${params.floorThickness}mm / 挡边 ${params.recessDepth}mm`}
          >
            <div className="space-y-4">
              <ParamSlider
                label={BASE_CONVERTER_LIMITS.floorThickness.label}
                value={params.floorThickness}
                config={BASE_CONVERTER_LIMITS.floorThickness}
                onChange={(value) => updateParam("floorThickness", value)}
                unit="mm"
              />
              <ParamSlider
                label={BASE_CONVERTER_LIMITS.recessDepth.label}
                value={params.recessDepth}
                config={BASE_CONVERTER_LIMITS.recessDepth}
                onChange={(value) => updateParam("recessDepth", value)}
                unit="mm"
              />
            </div>
          </SectionHeader>
        </div>
      </div>
    </PanelShell>
  );
}
