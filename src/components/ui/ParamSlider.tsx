"use client";

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
    return (
        <div className="space-y-2 group">
            <div className="flex items-center justify-between">
                <Label className="text-sm text-muted-foreground group-hover:text-foreground/80 transition-colors duration-200">
                    {label}
                </Label>
                <div className="flex items-center gap-1.5">
                    <Input
                        type="number"
                        value={value}
                        min={config.min}
                        max={config.max}
                        step={config.step}
                        onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            if (!isNaN(v) && v >= config.min && v <= config.max) {
                                onChange(v);
                            }
                        }}
                        className="w-18 h-7 text-right text-sm font-mono bg-[#1c1a16] border-[#2e2a24] text-foreground focus:border-primary/50 focus:ring-primary/20 transition-colors duration-200 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <span className="text-[11px] text-muted-foreground/60 w-6 font-mono">{unit}</span>
                </div>
            </div>
            <Slider
                value={[value]}
                min={config.min}
                max={config.max}
                step={config.step}
                onValueChange={([v]) => onChange(v)}
                className="py-1"
            />
        </div>
    );
}
