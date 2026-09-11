"use client";

import { useId } from "react";
import { Square } from "lucide-react";
import type { BaseConverterParams } from "@/types/custom-tray";
import { SQUARE_BASE_STANDARDS } from "@/lib/base-converter-config";
import { ROUND_BASE_SHELL_THICKNESS } from "@/lib/round-base-profile";
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

interface SquareBaseConfigProps {
  params: BaseConverterParams;
  updateParams: (
    mutate: (params: BaseConverterParams) => BaseConverterParams,
  ) => void;
}

function SquareBaseNumberField({
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

export function SquareBaseConfig({
  params,
  updateParams,
}: SquareBaseConfigProps) {
  const snapshot = params.squareBaseSnapshot;
  const selectStandard = (standardId: string) => {
    const standard = SQUARE_BASE_STANDARDS.find(
      (entry) => entry.standardId === standardId,
    );
    if (!standard) return;
    updateParams((previous) => ({
      ...previous,
      squareBaseStandardId: standard.standardId,
      squareBaseSnapshot: { ...standard },
    }));
  };
  const updateProfile = (
    key: "height" | "topInset" | "cornerRadius",
    value: number,
  ) => updateParams((previous) => ({
    ...previous,
    squareBaseSnapshot: { ...previous.squareBaseSnapshot, [key]: value },
  }));

  return (
    <div className="iron-panel rounded-sm p-4">
      <SectionHeader
        icon={Square}
        title="普通底盘参数"
        collapsible
        defaultOpen
        summary={`${snapshot.name} / 高 ${snapshot.height}mm`}
      >
        <div className="space-y-4">
          <div className="rounded-sm border border-primary/25 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-semibold text-primary">首版参考值</span>
            <span> · 宽深锁定网格预设的标称尺寸，可按实测修改总高、内缩与圆角。</span>
            <div className="mt-1 font-mono text-[#d8d1c5]">
              底部开腔 · 顶板/侧壁 {ROUND_BASE_SHELL_THICKNESS}mm
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="square-base-standard" className="text-sm text-muted-foreground">
              战锤方形 / 矩形底盘规格
            </Label>
            <Select value={params.squareBaseStandardId} onValueChange={selectStandard}>
              <SelectTrigger
                id="square-base-standard"
                aria-label="战锤方形 / 矩形底盘规格"
                className="w-full bg-[#1c1a16] border-[#2e2a24]"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#16140f] border-[#2e2a24]">
                {SQUARE_BASE_STANDARDS.map((standard) => (
                  <SelectItem key={standard.standardId} value={standard.standardId}>
                    {standard.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <SquareBaseNumberField
              label="底盘总高 mm"
              value={snapshot.height}
              onChange={(value) => updateProfile("height", value)}
            />
            <SquareBaseNumberField
              label="顶部单边内缩 mm"
              value={snapshot.topInset}
              onChange={(value) => updateProfile("topInset", value)}
            />
            <SquareBaseNumberField
              label="圆角半径 mm"
              value={snapshot.cornerRadius}
              onChange={(value) => updateProfile("cornerRadius", value)}
            />
          </div>
        </div>
      </SectionHeader>
    </div>
  );
}
