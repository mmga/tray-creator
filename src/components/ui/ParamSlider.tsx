"use client";

import { useCallback, useMemo } from "react";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ParamSliderProps {
    label: string;
    value: number;
    config: { min: number; max: number; step: number };
    onChange: (v: number) => void;
    unit?: string;
}

/** 参数滑块：带数字输入框和单位显示 */
export function ParamSlider({
    label,
    value,
    config,
    onChange,
    unit = "mm",
}: ParamSliderProps) {
    // 防御 undefined：确保 input/slider 始终为受控状态
    const safeValue = Number.isFinite(value) ? value : config.min;
    const effectiveMin = Math.min(config.min, safeValue);
    const effectiveMax = Math.max(config.max, safeValue);
    const sliderValue = useMemo(() => [safeValue], [safeValue]);
    const handleValueChange = useCallback(
        (nextValue: number) => {
            if (nextValue !== safeValue) {
                onChange(nextValue);
            }
        },
        [onChange, safeValue],
    );

    return (
        <div className="space-y-2 group">
            <div className="flex items-center justify-between">
                <Label className="text-sm text-muted-foreground group-hover:text-foreground/80 transition-colors duration-200">
                    {label}
                </Label>
                <div className="flex items-center gap-1.5">
                    <Input
                        type="number"
                        value={safeValue}
                        min={effectiveMin}
                        max={effectiveMax}
                        step={config.step}
                        onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            if (!isNaN(v) && v >= effectiveMin && v <= effectiveMax) {
                                handleValueChange(v);
                            }
                        }}
                        className="w-18 h-9 lg:h-7 text-right text-sm font-mono bg-[#1c1a16] border-[#2e2a24] text-foreground focus:border-primary/50 focus:ring-primary/20 transition-colors duration-200 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <span className="text-[11px] text-muted-foreground/60 w-6 font-mono">{unit}</span>
                </div>
            </div>
            <Slider
                value={sliderValue}
                min={effectiveMin}
                max={effectiveMax}
                step={config.step}
                onValueChange={([v]) => handleValueChange(v)}
                className="py-1"
            />
        </div>
    );
}
