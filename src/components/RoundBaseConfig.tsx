"use client";

import { useId } from "react";
import { CircleDot, Hexagon } from "lucide-react";
import type { BaseConverterParams } from "@/types/custom-tray";
import { ROUND_BASE_STANDARDS } from "@/lib/base-converter-config";
import { DraftNumberInput } from "@/components/ui/DraftNumberInput";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SectionHeader } from "@/components/ui/SectionHeader";

interface RoundBaseConfigProps {
  params: BaseConverterParams;
  updateParams: (
    mutate: (params: BaseConverterParams) => BaseConverterParams,
  ) => void;
}

function RoundBaseNumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <DraftNumberInput
        id={id}
        step="any"
        value={value}
        onValueChange={onChange}
        className="h-9 bg-[#1c1a16] border-[#2e2a24] font-mono"
      />
    </div>
  );
}

export function RoundBaseConfig({ params, updateParams }: RoundBaseConfigProps) {
  const selectStandard = (standardId: string) => {
    const standard = ROUND_BASE_STANDARDS.find(
      (entry) => entry.standardId === standardId,
    );
    if (!standard) return;
    updateParams((previous) => ({
      ...previous,
      roundBaseStandardId: standard.standardId,
      roundBaseSnapshot: { ...standard },
    }));
  };
  const updateProfile = (
    key: "height" | "topInset",
    value: number,
  ) => updateParams((previous) => ({
    ...previous,
    roundBaseSnapshot: { ...previous.roundBaseSnapshot, [key]: value },
  }));
  const updateHole = (
    key: "acrossFlats" | "offsetX" | "offsetY",
    value: number,
  ) => updateParams((previous) => ({
    ...previous,
    pushFitHexHole: { ...previous.pushFitHexHole, [key]: value },
  }));

  return (
    <div className="iron-panel rounded-sm p-4">
      <SectionHeader
        icon={params.generationKind === "push-fit" ? Hexagon : CircleDot}
        title={params.generationKind === "push-fit" ? "简版底盘参数" : "普通底盘参数"}
        collapsible
        defaultOpen
        summary={`${params.roundBaseSnapshot.name} / 高 ${params.roundBaseSnapshot.height}mm`}
      >
        <div className="space-y-4">
          <div className="rounded-sm border border-primary/25 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-semibold text-primary">首版参考值</span>
            <span> · 可按实测尺寸继续修改，不会改变原有转换底盘参数。</span>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="round-base-standard" className="text-sm text-muted-foreground">
              战锤圆形底盘规格
            </Label>
            <Select value={params.roundBaseStandardId} onValueChange={selectStandard}>
              <SelectTrigger
                id="round-base-standard"
                aria-label="战锤圆形底盘规格"
                className="w-full bg-[#1c1a16] border-[#2e2a24]"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#16140f] border-[#2e2a24]">
                {ROUND_BASE_STANDARDS.map((standard) => (
                  <SelectItem key={standard.standardId} value={standard.standardId}>
                    {standard.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <RoundBaseNumberField
              label="底盘总高 mm"
              value={params.roundBaseSnapshot.height}
              onChange={(value) => updateProfile("height", value)}
            />
            <RoundBaseNumberField
              label="顶部单边内缩 mm"
              value={params.roundBaseSnapshot.topInset}
              onChange={(value) => updateProfile("topInset", value)}
            />
          </div>

          {params.generationKind === "push-fit" && (
            <div className="space-y-3 border-t border-[#2e2a24] pt-4">
              <div className="text-xs font-semibold tracking-wide text-[#e6ded0]">
                拼插六边孔
              </div>
              <div className="text-[11px] text-muted-foreground">
                以底盘中心为原点：右为 +X，上为 +Y
              </div>
              <RoundBaseNumberField
                label="六边孔对边距 mm"
                value={params.pushFitHexHole.acrossFlats}
                onChange={(value) => updateHole("acrossFlats", value)}
              />
              <div className="grid grid-cols-2 gap-3">
                <RoundBaseNumberField
                  label="孔位 X mm"
                  value={params.pushFitHexHole.offsetX}
                  onChange={(value) => updateHole("offsetX", value)}
                />
                <RoundBaseNumberField
                  label="孔位 Y mm"
                  value={params.pushFitHexHole.offsetY}
                  onChange={(value) => updateHole("offsetY", value)}
                />
              </div>
            </div>
          )}
        </div>
      </SectionHeader>
    </div>
  );
}
