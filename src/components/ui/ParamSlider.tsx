"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ARROW_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

interface ParamSliderProps {
    label: string;
    value: number;
    config: { min: number; max: number; step: number };
    onChange: (v: number) => void;
    onContinuousChangeStart?: () => boolean | void;
    onContinuousChange?: (v: number) => void;
    onContinuousChangeCommit?: () => void;
    onContinuousChangeCancel?: () => void;
    /** 允许数字输入超出滑块常用范围，由调用方执行几何有效性校验。 */
    allowOutOfRangeInput?: boolean;
    unit?: string;
}

/** 参数滑块：带数字输入框和单位显示 */
export function ParamSlider({
    label,
    value,
    config,
    onChange,
    onContinuousChangeStart,
    onContinuousChange,
    onContinuousChangeCommit,
    onContinuousChangeCancel,
    allowOutOfRangeInput = false,
    unit = "mm",
}: ParamSliderProps) {
    // 防御 undefined：确保 input/slider 始终为受控状态
    const safeValue = Number.isFinite(value) ? value : config.min;
    const effectiveMin = Math.min(config.min, safeValue);
    const effectiveMax = Math.max(config.max, safeValue);
    const [inputDraft, setInputDraft] = useState(() => String(safeValue));
    const [isInputFocused, setIsInputFocused] = useState(false);
    const skipNextBlurCommitRef = useRef(false);
    const continuousEditActiveRef = useRef(false);
    const sliderValue = useMemo(() => [safeValue], [safeValue]);
    const displayedInputValue = isInputFocused ? inputDraft : String(safeValue);
    const handleValueChange = useCallback(
        (nextValue: number) => {
            if (nextValue !== safeValue) {
                onChange(nextValue);
            }
        },
        [onChange, safeValue],
    );
    const beginContinuousChange = useCallback((): boolean => {
        if (!onContinuousChange) return false;
        if (continuousEditActiveRef.current) return true;
        if (onContinuousChangeStart?.() === false) return false;
        continuousEditActiveRef.current = true;
        return true;
    }, [onContinuousChange, onContinuousChangeStart]);
    const previewContinuousChange = useCallback((nextValue: number) => {
        if (!onContinuousChange) {
            handleValueChange(nextValue);
            return;
        }
        if (!beginContinuousChange()) return;
        if (nextValue !== safeValue) onContinuousChange(nextValue);
    }, [beginContinuousChange, handleValueChange, onContinuousChange, safeValue]);
    const commitContinuousChange = useCallback(() => {
        if (!continuousEditActiveRef.current) return;
        continuousEditActiveRef.current = false;
        onContinuousChangeCommit?.();
    }, [onContinuousChangeCommit]);
    const cancelContinuousChange = useCallback(() => {
        if (!continuousEditActiveRef.current) return;
        continuousEditActiveRef.current = false;
        onContinuousChangeCancel?.();
    }, [onContinuousChangeCancel]);
    const cancelContinuousChangeRef = useRef(cancelContinuousChange);
    useEffect(() => {
        cancelContinuousChangeRef.current = cancelContinuousChange;
    }, [cancelContinuousChange]);
    useEffect(
        () => () => cancelContinuousChangeRef.current(),
        [],
    );
    const blockArrowKeyParamAdjust = useCallback(
        (event: React.KeyboardEvent<HTMLElement>) => {
            if (!ARROW_KEYS.has(event.key)) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();
        },
        [],
    );
    const commitInputDraft = useCallback(() => {
        const nextValue = Number(inputDraft);
        if (
            inputDraft.trim() !== "" &&
            Number.isFinite(nextValue) &&
            (
                allowOutOfRangeInput
                || (nextValue >= effectiveMin && nextValue <= effectiveMax)
            )
        ) {
            handleValueChange(nextValue);
            return;
        }

        setInputDraft(String(safeValue));
    }, [
        allowOutOfRangeInput,
        effectiveMax,
        effectiveMin,
        handleValueChange,
        inputDraft,
        safeValue,
    ]);
    const handleInputKeyDown = useCallback(
        (event: React.KeyboardEvent<HTMLInputElement>) => {
            if (event.key === "Enter") {
                event.preventDefault();
                skipNextBlurCommitRef.current = true;
                commitInputDraft();
                event.currentTarget.blur();
                return;
            }

            blockArrowKeyParamAdjust(event);
        },
        [blockArrowKeyParamAdjust, commitInputDraft],
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
                        value={displayedInputValue}
                        min={allowOutOfRangeInput ? undefined : effectiveMin}
                        max={allowOutOfRangeInput ? undefined : effectiveMax}
                        step="any"
                        onFocus={() => {
                            setInputDraft(String(safeValue));
                            setIsInputFocused(true);
                        }}
                        onBlur={() => {
                            setIsInputFocused(false);
                            if (skipNextBlurCommitRef.current) {
                                skipNextBlurCommitRef.current = false;
                                return;
                            }
                            commitInputDraft();
                        }}
                        onKeyDown={handleInputKeyDown}
                        onChange={(event) => {
                            setIsInputFocused(true);
                            setInputDraft(event.target.value);
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
                onPointerDownCapture={beginContinuousChange}
                onPointerCancel={cancelContinuousChange}
                onKeyDownCapture={(event) => {
                    if (event.key === "Escape") cancelContinuousChange();
                    blockArrowKeyParamAdjust(event);
                }}
                onValueChange={([v]) => previewContinuousChange(v)}
                onValueCommit={commitContinuousChange}
                className="py-1"
            />
        </div>
    );
}
