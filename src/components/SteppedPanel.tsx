"use client";

import type { SteppedLayoutParams } from "@/types/custom-tray";
import { BASE_PRESETS, STEPPED_LIMITS, MAX_BUILD_SIZE, STEPPED_LAYOUT_DEFAULTS } from "@/lib/config";
import { calculateSteppedTrayDimensions } from "@/lib/stepped-tray-model";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import {
    Download,
    RotateCcw,
    Play,
    Loader2,
    Plus,
    Wrench,
    Ruler,
    BoxSelect,
    Layers,
    Trash2,
    ArrowRight,
    ChevronUp,
    ChevronDown,
    Eye,
} from "lucide-react";
import { ParamIOButtons } from "@/components/ParamIOButtons";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ParamSlider } from "@/components/ui/ParamSlider";
import { calculateWeight, calculateSteppedPrice } from "@/lib/pricing";

interface SteppedPanelProps {
    params: SteppedLayoutParams;
    effectiveDimensions: { width: number; depth: number };
    isPreviewStale: boolean;
    updateParam: <K extends keyof SteppedLayoutParams>(key: K, value: SteppedLayoutParams[K]) => void;
    setParams: React.Dispatch<React.SetStateAction<SteppedLayoutParams>>;
    onAddSlot: (width: number) => void;
    onGenerate: () => void;
    onExportSTL: () => void;
    isGenerating: boolean;
    volume: number;
    selectedSlotIds: string[];
    // 分组管理
    onAddGroup: () => void;
    onRemoveGroup: (groupId: string) => void;
    onUpdateGroupHeight: (groupId: string, height: number) => void;
    onSetActiveGroup: (groupId: string) => void;
    onMoveSelectedSlotsToGroup: (ids: string[], targetGroupId: string) => void;
    onReorderGroups: (fromIndex: number, toIndex: number) => void;
    previewGroupId: string | null;
    onPreviewGroupChange: (groupId: string | null) => void;
}

export default function SteppedPanel({
    params,
    effectiveDimensions,
    isPreviewStale,
    updateParam,
    setParams,
    onAddSlot,
    onGenerate,
    onExportSTL,
    isGenerating,
    volume,
    selectedSlotIds,
    onAddGroup,
    onRemoveGroup,
    onUpdateGroupHeight,
    onSetActiveGroup,
    onMoveSelectedSlotsToGroup,
    onReorderGroups,
    previewGroupId,
    onPreviewGroupChange,
}: SteppedPanelProps) {
    const dimensions = calculateSteppedTrayDimensions(params);
    const effectiveWidth = effectiveDimensions.width;
    const effectiveDepth = effectiveDimensions.depth;
    const isOversized = effectiveWidth > MAX_BUILD_SIZE || effectiveDepth > MAX_BUILD_SIZE;
    const [pressedPreviewGroupId, setPressedPreviewGroupId] = useState<string | null>(null);
    const [lockedPreviewGroupId, setLockedPreviewGroupId] = useState<string | null>(null);

    useEffect(() => {
        if (!pressedPreviewGroupId) {
            return;
        }

        const clearPreview = () => {
            setPressedPreviewGroupId(null);
            onPreviewGroupChange(lockedPreviewGroupId);
        };

        window.addEventListener("blur", clearPreview);

        return () => {
            window.removeEventListener("blur", clearPreview);
        };
    }, [lockedPreviewGroupId, onPreviewGroupChange, pressedPreviewGroupId]);

    useEffect(() => {
        const validGroupIds = new Set(params.groups.map((group) => group.id));

        if (lockedPreviewGroupId && !validGroupIds.has(lockedPreviewGroupId)) {
            setLockedPreviewGroupId(null);
        }

        if (pressedPreviewGroupId && !validGroupIds.has(pressedPreviewGroupId)) {
            setPressedPreviewGroupId(null);
        }

        if (previewGroupId && !validGroupIds.has(previewGroupId)) {
            onPreviewGroupChange(null);
        }
    }, [lockedPreviewGroupId, onPreviewGroupChange, params.groups, pressedPreviewGroupId, previewGroupId]);

    const handleReset = () => {
        setParams(STEPPED_LAYOUT_DEFAULTS);
    };

    const handlePreviewGroupStart = (groupId: string) => {
        setPressedPreviewGroupId(groupId);
        onPreviewGroupChange(groupId);
    };

    const handlePreviewGroupEnd = () => {
        setPressedPreviewGroupId(null);
        onPreviewGroupChange(lockedPreviewGroupId);
    };

    const toggleLockedPreviewGroup = (groupId: string) => {
        const nextGroupId = lockedPreviewGroupId === groupId ? null : groupId;
        setLockedPreviewGroupId(nextGroupId);

        if (!pressedPreviewGroupId) {
            onPreviewGroupChange(nextGroupId);
        }
    };

    return (
        <div className="flex flex-col gap-4 animate-fade-in">

            {/* 分组管理 */}
            <div className="iron-panel rounded-sm p-3">
                <SectionHeader icon={Layers} title="分组管理" collapsible defaultOpen={true}
                    summary={`${params.groups.length} 组 / ${params.slots.length} 个凹槽`}>
                    <div className="space-y-1.5 mt-1">
                        {params.groups
                            .map((group, groupIndex) => {
                                const groupSlotCount = params.slots.filter(s => s.groupId === group.id).length;
                                const isActive = params.activeGroupId === group.id;
                                const isPreviewing = previewGroupId === group.id;
                                return (
                                    <div
                                        key={group.id}
                                        onClick={() => onSetActiveGroup(group.id)}
                                        className={`rounded cursor-pointer transition-all duration-150 border ${isActive ? "bg-[#1c1a16]" : "border-transparent hover:bg-[#1c1a16]/50"
                                            }`}
                                        style={isActive ? { borderColor: group.color + "50" } : {}}
                                    >
                                        {/* 分组行顶部 */}
                                        <div className="flex items-center gap-2 px-2 pt-2 pb-1">
                                            <div
                                                className={`w-2 h-2 rounded-full shrink-0 transition-opacity ${isActive ? "" : "opacity-25"}`}
                                                style={{ background: group.color }}
                                            />
                                            <div className="w-3 h-3 rounded-sm shrink-0" style={{ background: group.color }} />
                                            <span className="text-xs font-medium text-foreground/90 flex-1 truncate">{group.name}</span>
                                            <span className="text-[10px] text-muted-foreground shrink-0">{groupSlotCount} 个凹槽</span>
                                            <button
                                                onClick={(e) => e.stopPropagation()}
                                                onPointerDown={(e) => {
                                                    e.stopPropagation();
                                                    if (e.pointerType === "touch") {
                                                        toggleLockedPreviewGroup(group.id);
                                                        return;
                                                    }
                                                    e.currentTarget.setPointerCapture(e.pointerId);
                                                    handlePreviewGroupStart(group.id);
                                                }}
                                                onPointerUp={(e) => {
                                                    e.stopPropagation();
                                                    if (e.pointerType === "touch") {
                                                        return;
                                                    }
                                                    handlePreviewGroupEnd();
                                                }}
                                                onPointerCancel={(e) => {
                                                    e.stopPropagation();
                                                    handlePreviewGroupEnd();
                                                }}
                                                onLostPointerCapture={(e) => {
                                                    e.stopPropagation();
                                                    if (pressedPreviewGroupId === group.id) {
                                                        handlePreviewGroupEnd();
                                                    }
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key !== "Enter" && e.key !== " ") {
                                                        return;
                                                    }
                                                    if (e.repeat) {
                                                        return;
                                                    }
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    toggleLockedPreviewGroup(group.id);
                                                }}
                                                aria-pressed={isPreviewing}
                                                className={`w-6 h-6 shrink-0 flex items-center justify-center rounded transition-colors ${isPreviewing ? "bg-[#2a2115] text-[#f0d8b8]" : "text-muted-foreground/50 hover:text-foreground hover:bg-[#1c1a16]"}`}
                                                title="按住仅查看当前组"
                                            >
                                                <Eye className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onReorderGroups(groupIndex, groupIndex - 1); }}
                                                disabled={groupIndex === 0}
                                                className="w-5 h-5 shrink-0 flex items-center justify-center text-muted-foreground/40 hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed rounded transition-colors"
                                                title="上移"
                                            >
                                                <ChevronUp className="w-3 h-3" />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onReorderGroups(groupIndex, groupIndex + 1); }}
                                                disabled={groupIndex === params.groups.length - 1}
                                                className="w-5 h-5 shrink-0 flex items-center justify-center text-muted-foreground/40 hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed rounded transition-colors"
                                                title="下移"
                                            >
                                                <ChevronDown className="w-3 h-3" />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onRemoveGroup(group.id); }}
                                                disabled={params.groups.length <= 1}
                                                className="w-5 h-5 shrink-0 flex items-center justify-center text-muted-foreground/40 hover:text-red-400 disabled:opacity-20 disabled:cursor-not-allowed rounded transition-colors"
                                                title="删除组（同时删除组内所有凹槽）"
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        </div>
                                        {/* 高度滑杆（仅激活组展开） */}
                                        {isActive ? (
                                            <div className="px-2 pb-2">
                                                <ParamSlider
                                                    label={STEPPED_LIMITS.bottomHeight.label}
                                                    value={group.bottomHeight}
                                                    config={STEPPED_LIMITS.bottomHeight}
                                                    onChange={(v) => onUpdateGroupHeight(group.id, v)}
                                                    unit={STEPPED_LIMITS.bottomHeight.unit}
                                                />
                                            </div>
                                        ) : (
                                            <div className="px-2 pb-1.5">
                                                <div className="text-[10px] font-mono" style={{ color: group.color + "cc" }}>
                                                    ↑ {group.bottomHeight} mm
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onAddGroup}
                            className="w-full mt-1 h-8 text-xs border-dashed border-[#3d372e] text-muted-foreground hover:text-foreground hover:border-[#5a5040] transition-all"
                        >
                            <Plus className="w-3 h-3 mr-1" />
                            新建组
                        </Button>
                    </div>
                </SectionHeader>
            </div>

            {/* 选中凹槽操作：移动到组 */}
            {selectedSlotIds.length > 0 && (
                <div className="iron-panel rounded-sm p-3">
                    <SectionHeader icon={ArrowRight} title="选中凹槽" collapsible defaultOpen={true}
                        summary={`${selectedSlotIds.length} 个已选中，移动到组`}>
                        <div className="space-y-2 mt-1">
                            <div className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">移动到</div>
                            <div className="flex flex-wrap gap-1.5">
                                {params.groups.map((group) => (
                                    <Button
                                        key={group.id}
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onMoveSelectedSlotsToGroup(selectedSlotIds, group.id)}
                                        className="h-7 text-xs gap-1.5 transition-all"
                                        style={{ borderColor: group.color + "60", color: group.color }}
                                    >
                                        <div className="w-2 h-2 rounded-sm shrink-0" style={{ background: group.color }} />
                                        {group.name}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </SectionHeader>
                </div>
            )}

            {/* 添加凹槽 */}
            <div className="iron-panel rounded-sm p-3">
                <SectionHeader icon={BoxSelect} title="添加凹槽" collapsible defaultOpen={true}
                    summary={`已有 ${params.slots.length} 个凹槽`}>
                    <div className="space-y-2">
                        {(() => {
                            const activeGroup = params.groups.find(g => g.id === params.activeGroupId);
                            if (!activeGroup) return null;
                            return (
                                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70">
                                    <span>新凹槽将加入</span>
                                    <div className="w-2 h-2 rounded-sm" style={{ background: activeGroup.color }} />
                                    <span style={{ color: activeGroup.color }}>{activeGroup.name}</span>
                                </div>
                            );
                        })()}
                        <div className="text-[10px] text-muted-foreground/70 font-bold tracking-wider uppercase mb-0.5">圆形</div>
                        <div className="grid grid-cols-3 gap-1.5">
                            {BASE_PRESETS.map((preset, i) => (
                                <Button
                                    key={i}
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onAddSlot(preset.diameter)}
                                    className="h-10 lg:h-7 text-xs lg:text-[11px] border-[#2e2a24] bg-[#1c1a16] hover:bg-[#2e2a24] hover:text-primary transition-all"
                                >
                                    <Plus className="w-3 h-3 mr-1" />
                                    {preset.diameter}
                                </Button>
                            ))}
                        </div>
                    </div>
                </SectionHeader>
            </div>

            {/* 结构参数 */}
            <div className="iron-panel rounded-sm p-4">
                <SectionHeader icon={Wrench} title="结构参数" collapsible defaultOpen={false}
                    summary={`槽距${params.spacing}mm / 凹槽深度${params.holeDepth}mm / 断连${params.disconnectDistance}mm`}>
                    <div className="space-y-4">
                        <ParamSlider
                            label={STEPPED_LIMITS.spacing.label}
                            value={params.spacing}
                            config={STEPPED_LIMITS.spacing}
                            onChange={(v) => updateParam("spacing", v)}
                            unit={STEPPED_LIMITS.spacing.unit}
                        />
                        <ParamSlider
                            label={STEPPED_LIMITS.holeDepth.label}
                            value={params.holeDepth}
                            config={STEPPED_LIMITS.holeDepth}
                            onChange={(v) => updateParam("holeDepth", v)}
                            unit={STEPPED_LIMITS.holeDepth.unit}
                        />
                        <ParamSlider
                            label={STEPPED_LIMITS.smoothingRadius.label}
                            value={params.smoothingRadius}
                            config={STEPPED_LIMITS.smoothingRadius}
                            onChange={(v) => updateParam("smoothingRadius", v)}
                            unit={STEPPED_LIMITS.smoothingRadius.unit}
                        />
                        <ParamSlider
                            label={STEPPED_LIMITS.disconnectDistance.label}
                            value={params.disconnectDistance}
                            config={STEPPED_LIMITS.disconnectDistance}
                            onChange={(v) => updateParam("disconnectDistance", v)}
                            unit={STEPPED_LIMITS.disconnectDistance.unit}
                        />
                    </div>
                </SectionHeader>
            </div>

            {/* 统计信息 */}
            <div className={`iron-panel rounded-sm p-4 transition-all duration-300 ${isOversized ? 'border-[#8b1a1a] animate-forge-pulse' : ''}`}>
                <SectionHeader icon={Ruler} title="统计信息" collapsible defaultOpen={false}
                    summary={`${params.slots.length}个凹槽 / ${effectiveWidth.toFixed(0)}×${effectiveDepth.toFixed(0)}mm`}>
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2 mb-2">
                            <div className="text-center p-2 bg-[#1c1a16] border border-[#2e2a24]">
                                <span className="text-[10px] text-muted-foreground block">凹槽数量</span>
                                <span className="text-lg font-mono font-bold text-primary">{params.slots.length}</span>
                            </div>
                            <div className="text-center p-2 bg-[#1c1a16] border border-[#2e2a24]">
                                <span className="text-[10px] text-muted-foreground block">预估报价 & 耗材参考</span>
                                <div className="flex flex-col items-center mt-0.5">
                                    <span className="text-sm font-mono font-bold text-[#eab308]">
                                        ¥{calculateSteppedPrice(params, volume).toFixed(1)}
                                    </span>
                                    {volume > 0 ? (
                                        <span className="text-[9px] text-muted-foreground">
                                            估重: {calculateWeight(volume).toFixed(1)}g
                                        </span>
                                    ) : (
                                        <span className="text-[9px] text-muted-foreground">
                                            {isGenerating ? "图纸生成中..." : ""}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* 分组槽位统计 */}
                        {params.groups.length > 1 && (
                            <div className="space-y-1">
                                {params.groups
                                    .map((group) => {
                                        const count = params.slots.filter(s => s.groupId === group.id).length;
                                        return (
                                            <div key={group.id} className="flex items-center gap-2 text-[11px]">
                                                <div className="w-2 h-2 rounded-sm shrink-0" style={{ background: group.color }} />
                                                <span className="text-muted-foreground">{group.name}</span>
                                                <span className="font-mono" style={{ color: group.color }}>↑{group.bottomHeight}mm</span>
                                                <span className="ml-auto text-muted-foreground">{count} 个</span>
                                            </div>
                                        );
                                    })}
                            </div>
                        )}

                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { label: "宽度", value: effectiveWidth, warn: effectiveWidth > MAX_BUILD_SIZE },
                                { label: "深度", value: effectiveDepth, warn: effectiveDepth > MAX_BUILD_SIZE },
                                { label: "高度", value: dimensions.height, warn: false },
                            ].map(({ label, value, warn }) => (
                                <div
                                    key={label}
                                    className={`relative text-center p-2.5 transition-colors duration-200 ${warn
                                        ? 'bg-[#8b1a1a15] border border-[#8b1a1a50]'
                                        : 'bg-[#1c1a16] border border-[#2e2a24]'
                                        }`}
                                >
                                    <p className="text-[11px] text-muted-foreground/60 mb-0.5">{label}</p>
                                    <p className={`text-sm font-mono font-semibold tabular-nums ${warn ? 'text-[#c04040]' : 'text-foreground'}`}>
                                        {value.toFixed(1)}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground/40 font-mono">mm</p>
                                </div>
                            ))}
                        </div>
                        {isOversized && (
                            <div className="flex items-center justify-center gap-1.5 text-xs text-[#c04040] animate-fade-in">
                                <span>超过锻造极限</span>
                            </div>
                        )}
                        <div className="text-[11px] text-muted-foreground/80 text-center pt-1">
                            有效底板尺寸: {effectiveWidth.toFixed(0)} × {effectiveDepth.toFixed(0)} mm
                        </div>
                    </div>
                </SectionHeader>
            </div>

            <div className="wh-divider" />

            {/* 操作按钮 */}
            <div className="flex flex-col gap-2.5 pb-4">
                {isPreviewStale && (
                    <div className="rounded border border-[#5a4a2a] bg-[#2a2518]/90 px-3 py-2 text-xs text-[#c8a84e]">
                        当前预览已过期，请点击“开始锻造”生成最新模型。
                    </div>
                )}
                <Button
                    onClick={onGenerate}
                    disabled={isGenerating || isOversized}
                    className="w-full h-11 blood-red text-sm text-[#f0d8b8] font-bold tracking-wider cursor-pointer border border-[#a02020] shadow-lg shadow-[#8b1a1a30] hover:shadow-xl hover:shadow-[#8b1a1a50] hover:brightness-125 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isGenerating ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                        <Play className="w-4 h-4 mr-2" />
                    )}
                    {isGenerating ? "锻造中..." : isOversized ? "尺寸超限" : "开始锻造"}
                </Button>
                <Button
                    onClick={onExportSTL}
                    className="w-full h-10 bg-[#2a3528] hover:bg-[#354530] text-sm text-[#8cb880] font-semibold tracking-wider cursor-pointer border border-[#4a6741] shadow-lg shadow-[#2a352830]"
                >
                    <Download className="w-4 h-4 mr-2" />
                    导出 STL
                </Button>
                <Button
                    variant="outline"
                    onClick={handleReset}
                    className="w-full h-11 lg:h-9 text-sm border-[#2e2a24] text-muted-foreground tracking-wider cursor-pointer hover:bg-[#1c1a16] hover:text-foreground/80 hover:border-[#3d372e]"
                >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    重置参数
                </Button>
                <ParamIOButtons
                    mode="stepped"
                    params={params}
                    onImport={(p) => setParams(p as SteppedLayoutParams)}
                />
            </div>
        </div>
    );
}
