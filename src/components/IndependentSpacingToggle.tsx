"use client";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ParamSlider } from "@/components/ui/ParamSlider";

interface IndependentSpacingToggleProps {
  /** Switch 的 html id */
  htmlId: string;
  /** Switch 标签文案 */
  label?: string;
  /** 是否已启用独立间距 */
  independent: boolean;
  /** Switch 变更回调 */
  onIndependentChange: (checked: boolean) => void;
  /** 独立间距滑块的当前值 */
  value: number;
  /** 滑块的 min/max/step 配置 */
  config: { min: number; max: number; step: number; unit?: string };
  /** 滑块变更回调 */
  onValueChange: (value: number) => void;
  /** 滑块标签文案 */
  sliderLabel?: string;
}

/**
 * "边界间距独立调整" Switch + 条件 ParamSlider。
 *
 * 提取自多个参数面板中的重复交互
 * 复制的同构结构。参数名（boundarySpacing vs outerMargin）通过 props
 * 参数化，调用方传入具体的值和回调。
 */
export function IndependentSpacingToggle({
  htmlId,
  label = "边界间距独立调整",
  independent,
  onIndependentChange,
  value,
  config,
  onValueChange,
  sliderLabel = "边界间距",
}: IndependentSpacingToggleProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between p-3 rounded border border-[#2e2a24] bg-[#1c1a16]">
        <Label htmlFor={htmlId} className="text-sm cursor-pointer text-[#f0d8b8]">
          {label}
        </Label>
        <Switch
          id={htmlId}
          checked={independent}
          onCheckedChange={onIndependentChange}
          className="data-[state=checked]:bg-[#8cb880]"
        />
      </div>
      {independent && (
        <ParamSlider
          label={sliderLabel}
          value={value}
          config={config}
          onChange={onValueChange}
          unit={config.unit}
        />
      )}
    </div>
  );
}
