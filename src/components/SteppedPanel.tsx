"use client";

import type { SplitGrooveType, SteppedLayoutParams } from "@/types/custom-tray";
import type { BridgeWarning } from "@/lib/stepped-connectivity";
import type { SteppedOptimizationProposal } from "@/lib/stepped-global-optimize";
import {
    BASE_PRESETS,
    getBaseHoleMinBaseThickness,
    getBaseHolePreset,
} from "@/lib/config";
import type { BaseHolePresetKey } from "@/types/tray";
import { STEPPED_LIMITS } from "@/lib/stepped-config";
import {
    getSteppedGroupMinBottomHeight,
    getSteppedGroupResolvedBaseHoleSize,
} from "@/lib/stepped-base-hole";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    useCallback,
    useEffect,
    useMemo,
    useState,
    type Dispatch,
    type ReactNode,
    type SetStateAction,
} from "react";
import {
    RotateCcw,
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
    AlertTriangle,
    Circle,
} from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ParamSlider } from "@/components/ui/ParamSlider";
import { useToast } from "@/hooks/useToast";
import { isPerfEnabled, resetPerfMetrics } from "@/lib/perf";
import {
    buildSteppedPerfFixture,
    STEPPED_PERF_FIXTURE_SIZES,
    type SteppedPerfFixtureSize,
} from "@/lib/stepped-perf-fixtures";
import { PanelShell } from "@/components/PanelShell";
import { TrayResultSummary } from "@/components/TrayResultSummary";
import {
    projectSteppedTrayResult,
    type SteppedTrayResultProjection,
} from "@/lib/tray-result-projection";

type SteppedGroup = SteppedLayoutParams["groups"][number];

/**
 * 普通阶梯与 CAD 阶梯共享的 props（不含任何 CAD 专属字段）。
 */
interface SteppedPanelSharedProps {
    params: SteppedLayoutParams;
    effectiveDimensions: { width: number; depth: number };
    isPreviewStale: boolean;
    updateParam: <K extends keyof SteppedLayoutParams>(key: K, value: SteppedLayoutParams[K]) => void;
    setParams: Dispatch<SetStateAction<SteppedLayoutParams>>;
    actions: ReactNode;
    onAddSlot: (width: number) => void;
    isGenerating: boolean;
    volume: number;
    selectedSlotIds: string[];
    // 分组管理
    onAddGroup: () => void;
    onRemoveGroup: (groupId: string) => void;
    onUpdateGroupHeight: (groupId: string, height: number) => void;
    onUpdateGroupSmoothingOverride: (groupId: string, enabled: boolean) => void;
    onUpdateGroupSmoothingRadius: (groupId: string, radius: number) => void;
    onUpdateGroupDisconnectOverride: (groupId: string, enabled: boolean) => void;
    onUpdateGroupDisconnectDistance: (groupId: string, distance: number) => void;
    onSetActiveGroup: (groupId: string) => void;
    onMoveSelectedSlotsToGroup: (ids: string[], targetGroupId: string) => void;
    onReorderGroups: (fromIndex: number, toIndex: number) => void;
    previewGroupId: string | null;
    onPreviewGroupChange: (groupId: string | null) => void;
    bridgeWarning: BridgeWarning | null;
    optimizationProposals: SteppedOptimizationProposal[];
    isOptimizingLayout: boolean;
    onGenerateOptimizationProposals: () => void;
    onApplyOptimizationProposal: (proposalId: SteppedOptimizationProposal["id"]) => void;
    onClearOptimizationProposals: () => void;
}

export type SteppedLayoutPanelProps = SteppedPanelSharedProps;

export interface SteppedCadPanelProps extends SteppedPanelSharedProps {
    // CAD 专属：必填
    onUpdateGroupSplitPartTarget: (groupId: string, targetGroupId: string | null) => void;
}

interface UseSteppedPanelStateOptions {
    mode: "stepped" | "stepped-cad";
    params: SteppedLayoutParams;
    effectiveDimensions: { width: number; depth: number };
    volume: number;
    isGenerating: boolean;
    isPreviewStale: boolean;
    previewGroupId: string | null;
    onPreviewGroupChange: (groupId: string | null) => void;
    setParams: Dispatch<SetStateAction<SteppedLayoutParams>>;
}

interface UseSteppedPanelStateReturn {
    result: SteppedTrayResultProjection;
    pressedPreviewGroupId: string | null;
    lockedPreviewGroupId: string | null;
    activePressedPreviewGroupId: string | null;
    activeLockedPreviewGroupId: string | null;
    validGroupIds: Set<string>;
    groupSlotCounts: Map<string, number>;
    activeGroup: SteppedGroup | null;
    activeGroupBaseHoleSize: BaseHolePresetKey;
    activeGroupBaseHolePreset: ReturnType<typeof getBaseHolePreset>;
    activeGroupMinBottomHeight: number;
    activeGroupSupportThickness: number;
    perfEnabled: boolean;
    currentArea: number;
    handlePreviewGroupStart: (groupId: string) => void;
    handlePreviewGroupEnd: () => void;
    toggleLockedPreviewGroup: (groupId: string) => void;
    handleLoadPerfFixture: (size: SteppedPerfFixtureSize) => void;
    handleResetPerfSamples: () => void;
    formatAreaDelta: (proposalArea: number) => string;
}

function useSteppedPanelState(options: UseSteppedPanelStateOptions): UseSteppedPanelStateReturn {
    const {
        mode,
        params,
        effectiveDimensions,
        volume,
        isGenerating,
        isPreviewStale,
        previewGroupId,
        onPreviewGroupChange,
        setParams,
    } = options;
    const { toast } = useToast();
    const result = useMemo(
        () => projectSteppedTrayResult(mode, params, effectiveDimensions, {
            volume,
            isGenerating,
            isPreviewStale,
        }),
        [effectiveDimensions, isGenerating, isPreviewStale, mode, params, volume],
    );
    const [pressedPreviewGroupId, setPressedPreviewGroupId] = useState<string | null>(null);
    const [lockedPreviewGroupId, setLockedPreviewGroupId] = useState<string | null>(null);
    const validGroupIds = useMemo(
        () => new Set(params.groups.map((group) => group.id)),
        [params.groups],
    );
    const activePressedPreviewGroupId =
        pressedPreviewGroupId && validGroupIds.has(pressedPreviewGroupId)
            ? pressedPreviewGroupId
            : null;
    const activeLockedPreviewGroupId =
        lockedPreviewGroupId && validGroupIds.has(lockedPreviewGroupId)
            ? lockedPreviewGroupId
            : null;
    const groupSlotCounts = useMemo(() => {
        const counts = new Map<string, number>();
        params.slots.forEach((slot) => {
            counts.set(slot.groupId, (counts.get(slot.groupId) ?? 0) + 1);
        });
        return counts;
    }, [params.slots]);
    const activeGroup = useMemo(
        () => params.groups.find((group) => group.id === params.activeGroupId) ?? null,
        [params.activeGroupId, params.groups],
    );
    const activeGroupBaseHoleSize = useMemo(
        () => activeGroup
            ? getSteppedGroupResolvedBaseHoleSize(params, activeGroup.id)
            : params.baseHoleSize,
        [activeGroup, params],
    );
    const activeGroupBaseHolePreset = useMemo(
        () => getBaseHolePreset(activeGroupBaseHoleSize),
        [activeGroupBaseHoleSize],
    );
    const activeGroupMinBottomHeight = useMemo(
        () => activeGroup
            ? getSteppedGroupMinBottomHeight(params, activeGroup.id)
            : STEPPED_LIMITS.bottomHeight.min,
        [activeGroup, params],
    );
    const activeGroupSupportThickness = useMemo(
        () => activeGroup
            ? Math.max(activeGroup.bottomHeight - params.holeDepth, 0)
            : 0,
        [activeGroup, params.holeDepth],
    );
    const perfEnabled = useMemo(() => isPerfEnabled(), []);
    const currentArea = result.dimensions.width * result.dimensions.depth;

    useEffect(() => {
        if (!activePressedPreviewGroupId) {
            return;
        }

        const clearPreview = () => {
            setPressedPreviewGroupId(null);
            onPreviewGroupChange(activeLockedPreviewGroupId);
        };

        window.addEventListener("blur", clearPreview);

        return () => {
            window.removeEventListener("blur", clearPreview);
        };
    }, [activeLockedPreviewGroupId, activePressedPreviewGroupId, onPreviewGroupChange]);

    useEffect(() => {
        if (previewGroupId && !validGroupIds.has(previewGroupId)) {
            onPreviewGroupChange(null);
        }
    }, [onPreviewGroupChange, previewGroupId, validGroupIds]);

    const handlePreviewGroupStart = (groupId: string) => {
        setPressedPreviewGroupId(groupId);
        onPreviewGroupChange(groupId);
    };

    const handlePreviewGroupEnd = () => {
        setPressedPreviewGroupId(null);
        onPreviewGroupChange(activeLockedPreviewGroupId);
    };

    const toggleLockedPreviewGroup = (groupId: string) => {
        const nextGroupId = activeLockedPreviewGroupId === groupId ? null : groupId;
        setLockedPreviewGroupId(nextGroupId);

        if (!activePressedPreviewGroupId) {
            onPreviewGroupChange(nextGroupId);
        }
    };

    const handleLoadPerfFixture = useCallback((size: SteppedPerfFixtureSize) => {
        setPressedPreviewGroupId(null);
        setLockedPreviewGroupId(null);
        onPreviewGroupChange(null);
        resetPerfMetrics();
        setParams(buildSteppedPerfFixture(size));
        toast("success", `已载入 ${size} 槽位性能样本，采样已清零`);
    }, [onPreviewGroupChange, setParams, toast]);

    const handleResetPerfSamples = useCallback(() => {
        resetPerfMetrics();
        toast("success", "性能采样已清零");
    }, [toast]);

    const formatAreaDelta = useCallback((proposalArea: number) => {
        if (currentArea <= 0) {
            return "较当前 0.0%";
        }
        const deltaPercent = ((proposalArea - currentArea) / currentArea) * 100;
        const sign = deltaPercent > 0 ? "+" : "";
        return `较当前 ${sign}${deltaPercent.toFixed(1)}%`;
    }, [currentArea]);

    return {
        result,
        pressedPreviewGroupId,
        lockedPreviewGroupId,
        activePressedPreviewGroupId,
        activeLockedPreviewGroupId,
        validGroupIds,
        groupSlotCounts,
        activeGroup,
        activeGroupBaseHoleSize,
        activeGroupBaseHolePreset,
        activeGroupMinBottomHeight,
        activeGroupSupportThickness,
        perfEnabled,
        currentArea,
        handlePreviewGroupStart,
        handlePreviewGroupEnd,
        toggleLockedPreviewGroup,
        handleLoadPerfFixture,
        handleResetPerfSamples,
        formatAreaDelta,
    };
}

/**
 * 模块内部共享展示组件。两个入口（SteppedLayoutPanel / SteppedCadPanel）
 * 都把公共 props 透传给它，并通过可选注入点提供 CAD 专属内容。
 */
interface SteppedPanelBodyProps extends SteppedPanelSharedProps {
    mode: "stepped" | "stepped-cad";
    actions: ReactNode;
    structureSummary: string;
    structureExtras?: ReactNode;
    renderGroupSplitAssembly?: (group: SteppedGroup) => ReactNode;
}

function SteppedPanelBody({
    mode,
    params,
    effectiveDimensions,
    isPreviewStale,
    updateParam,
    setParams,
    onAddSlot,
    isGenerating,
    volume,
    selectedSlotIds,
    onAddGroup,
    onRemoveGroup,
    onUpdateGroupHeight,
    onUpdateGroupSmoothingOverride,
    onUpdateGroupSmoothingRadius,
    onUpdateGroupDisconnectOverride,
    onUpdateGroupDisconnectDistance,
    onSetActiveGroup,
    onMoveSelectedSlotsToGroup,
    onReorderGroups,
    previewGroupId,
    onPreviewGroupChange,
    bridgeWarning,
    optimizationProposals,
    isOptimizingLayout,
    onGenerateOptimizationProposals,
    onApplyOptimizationProposal,
    onClearOptimizationProposals,
    actions,
    structureSummary,
    structureExtras,
    renderGroupSplitAssembly,
}: SteppedPanelBodyProps) {
    const state = useSteppedPanelState({
        mode,
        params,
        effectiveDimensions,
        volume,
        isGenerating,
        isPreviewStale,
        previewGroupId,
        onPreviewGroupChange,
        setParams,
    });
    const {
        result,
        activePressedPreviewGroupId,
        groupSlotCounts,
        activeGroup,
        activeGroupBaseHolePreset,
        activeGroupMinBottomHeight,
        activeGroupSupportThickness,
        activeGroupBaseHoleSize,
        perfEnabled,
        handlePreviewGroupStart,
        handlePreviewGroupEnd,
        toggleLockedPreviewGroup,
        handleLoadPerfFixture,
        handleResetPerfSamples,
        formatAreaDelta,
    } = state;

    return (
        <PanelShell summary={<TrayResultSummary result={result} />} actions={actions}>
        <div className="flex flex-col gap-4 animate-fade-in">

            {/* 添加凹槽 */}
            <div className="iron-panel rounded-sm p-3">
                <SectionHeader icon={BoxSelect} title="添加凹槽" collapsible defaultOpen={true}
                    summary={`已有 ${params.slots.length} 个凹槽`}>
                    <div className="space-y-2">
                        {activeGroup && (
                            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70">
                                <span>新凹槽将加入</span>
                                <div className="w-2 h-2 rounded-sm" style={{ background: activeGroup.color }} />
                                <span style={{ color: activeGroup.color }}>{activeGroup.name}</span>
                            </div>
                        )}
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

            {/* 分组管理 */}
            <div className="iron-panel rounded-sm p-3">
                <SectionHeader icon={Layers} title="分组管理" collapsible defaultOpen={true}
                    summary={`${params.groups.length} 组 / ${params.slots.length} 个凹槽`}>
                    <div className="space-y-1.5 mt-1">
                        {params.groups
                            .map((group, groupIndex) => {
                                const groupSlotCount = groupSlotCounts.get(group.id) ?? 0;
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
                                                    if (activePressedPreviewGroupId === group.id) {
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
                                            <div className="px-2 pb-2 space-y-3">
                                                <ParamSlider
                                                    label={STEPPED_LIMITS.bottomHeight.label}
                                                    value={group.bottomHeight}
                                                    config={{
                                                        ...STEPPED_LIMITS.bottomHeight,
                                                        min: params.enableBaseHole
                                                            ? getSteppedGroupMinBottomHeight(params, group.id)
                                                            : STEPPED_LIMITS.bottomHeight.min,
                                                    }}
                                                    onChange={(v) => onUpdateGroupHeight(group.id, v)}
                                                    unit={STEPPED_LIMITS.bottomHeight.unit}
                                                />
                                                <div className="rounded border border-[#2e2a24] bg-[#171511] px-2.5 py-2 space-y-2">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div>
                                                            <div className="text-[11px] font-medium text-foreground/90">平滑半径</div>
                                                            <div className="text-[10px] text-muted-foreground">
                                                                {group.useGroupSmoothingRadius
                                                                    ? `独立设置: ${group.groupSmoothingRadius} mm`
                                                                    : `跟随全局: ${params.smoothingRadius} mm`}
                                                            </div>
                                                        </div>
                                                        <Switch
                                                            size="sm"
                                                            checked={group.useGroupSmoothingRadius}
                                                            onCheckedChange={(checked) => onUpdateGroupSmoothingOverride(group.id, checked)}
                                                            onClick={(e) => e.stopPropagation()}
                                                            aria-label={`${group.name} 平滑半径独立设置`}
                                                        />
                                                    </div>
                                                    {group.useGroupSmoothingRadius ? (
                                                        <ParamSlider
                                                            label={STEPPED_LIMITS.smoothingRadius.label}
                                                            value={group.groupSmoothingRadius}
                                                            config={STEPPED_LIMITS.smoothingRadius}
                                                            onChange={(v) => onUpdateGroupSmoothingRadius(group.id, v)}
                                                            unit={STEPPED_LIMITS.smoothingRadius.unit}
                                                        />
                                                    ) : null}
                                                </div>
                                                <div className="rounded border border-[#2e2a24] bg-[#171511] px-2.5 py-2 space-y-2">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div>
                                                            <div className="text-[11px] font-medium text-foreground/90">槽群断连距离</div>
                                                            <div className="text-[10px] text-muted-foreground">
                                                                {group.useGroupDisconnectDistance
                                                                    ? `独立设置: ${group.groupDisconnectDistance} mm`
                                                                    : `跟随全局: ${params.disconnectDistance} mm`}
                                                            </div>
                                                        </div>
                                                        <Switch
                                                            size="sm"
                                                            checked={group.useGroupDisconnectDistance}
                                                            onCheckedChange={(checked) => onUpdateGroupDisconnectOverride(group.id, checked)}
                                                            onClick={(e) => e.stopPropagation()}
                                                            aria-label={`${group.name} 槽群断连距离独立设置`}
                                                        />
                                                    </div>
                                                    {group.useGroupDisconnectDistance ? (
                                                        <ParamSlider
                                                            label={STEPPED_LIMITS.disconnectDistance.label}
                                                            value={group.groupDisconnectDistance}
                                                            config={STEPPED_LIMITS.disconnectDistance}
                                                            onChange={(v) => onUpdateGroupDisconnectDistance(group.id, v)}
                                                            unit={STEPPED_LIMITS.disconnectDistance.unit}
                                                        />
                                                    ) : null}
                                                </div>
                                                {renderGroupSplitAssembly?.(group) ?? null}
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

            {/* 结构参数 */}
            <div className="iron-panel rounded-sm p-4">
                <SectionHeader icon={Wrench} title="阶梯结构" collapsible defaultOpen={false}
                    summary={structureSummary}>
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
                        {structureExtras ?? null}
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
                        {bridgeWarning ? (
                            <div className="rounded border border-[#7c5a1c] bg-[#2a2115]/70 px-3 py-2 text-[11px] text-[#f0d8b8]">
                                <div className="flex items-start gap-2">
                                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#eab308]" />
                                    <div className="space-y-1">
                                        <div>
                                            {bridgeWarning.groupName} 当前参数可能会将 {bridgeWarning.separatedClusterCount} 个槽群连接为 {bridgeWarning.mergedClusterCount} 个整体。
                                        </div>
                                        <div className="text-[#d9c3a3]/80">
                                            可以尝试增大“槽群断连距离”、减小“平滑半径”，或调整槽位位置。
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : null}
                    </div>
                </SectionHeader>
            </div>

            <div className="iron-panel rounded-sm p-4">
                <SectionHeader icon={Circle} title="底板孔位" collapsible defaultOpen={false}
                    summary={params.enableBaseHole ? "磁吸孔 按各组最大槽径自动匹配" : "普通托盘"}>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => updateParam("enableBaseHole", false)}
                                className={`px-3 py-2 text-xs font-bold tracking-wider uppercase border transition-all duration-200 cursor-pointer ${
                                    !params.enableBaseHole
                                        ? "bg-primary/15 text-primary border-primary/50 shadow-inner"
                                        : "bg-[#1c1a16] text-muted-foreground border-[#2e2a24] hover:border-[#3d372e]"
                                }`}
                            >
                                普通托盘
                            </button>
                            <button
                                type="button"
                                onClick={() => updateParam("enableBaseHole", true)}
                                className={`px-3 py-2 text-xs font-bold tracking-wider uppercase border transition-all duration-200 cursor-pointer ${
                                    params.enableBaseHole
                                        ? "bg-primary/15 text-primary border-primary/50 shadow-inner"
                                        : "bg-[#1c1a16] text-muted-foreground border-[#2e2a24] hover:border-[#3d372e]"
                                }`}
                            >
                                磁吸孔
                            </button>
                        </div>

                        {params.enableBaseHole ? (
                            <div className="space-y-3">
                                <div className="rounded border border-dashed border-[#3d372e] px-3 py-2 text-[11px] text-muted-foreground/70">
                                    各组会按本组最大槽径自动匹配磁吸孔规格，并自动抬高圆柱高度以保留足够底厚。
                                </div>

                                <div className="space-y-1.5 text-[11px] font-mono text-muted-foreground/70 bg-[#1c1a16] border border-[#2e2a24] p-2.5">
                                    <div className="flex justify-between">
                                        <span>当前组</span>
                                        <span className="text-foreground/80">
                                            {activeGroup?.name ?? "未选择"}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>自动规格</span>
                                        <span className="text-foreground/80">
                                            {activeGroupBaseHolePreset.label}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>磁铁孔</span>
                                        <span className="text-foreground/80">
                                            ⌀{activeGroupBaseHolePreset.diameter}mm × {activeGroupBaseHolePreset.depth}mm
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>当前支撑厚度</span>
                                        <span className="text-foreground/80">
                                            {activeGroupSupportThickness.toFixed(1)}mm
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>当前组最小圆柱高度</span>
                                        <span className="text-foreground/80">
                                            {activeGroupMinBottomHeight.toFixed(1)}mm
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>最小支撑厚度</span>
                                        <span className="text-foreground/80">
                                            {getBaseHoleMinBaseThickness(activeGroupBaseHoleSize).toFixed(1)}mm
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ) : null}
                    </div>
                </SectionHeader>
            </div>

            {/* 操作按钮 */}
            <div className="flex flex-col gap-2.5 pb-4">
                <Button
                    variant="outline"
                    onClick={onGenerateOptimizationProposals}
                    disabled={params.slots.length < 2 || isOptimizingLayout}
                    className="w-full h-10 border-[#5a4a2a] text-[#c8a84e] cursor-pointer hover:bg-[#2a2518] hover:text-[#e0c870] hover:border-[#7a6a3a] disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {isOptimizingLayout ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                        <BoxSelect className="w-4 h-4 mr-2" />
                    )}
                    {isOptimizingLayout ? "优化中..." : "全局优化"}
                </Button>
                {optimizationProposals.length > 0 ? (
                    <div className="iron-panel rounded-sm p-3">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <div className="text-xs font-semibold tracking-wide text-[#f3dfb6]">
                                    优化建议
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                    基于当前阶梯布局生成的紧凑对称重排建议
                                </div>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onClearOptimizationProposals}
                                className="h-7 border-[#2e2a24] text-muted-foreground hover:bg-[#1c1a16] hover:text-foreground/80 hover:border-[#3d372e]"
                            >
                                关闭建议
                            </Button>
                        </div>
                        <div className="mt-3 space-y-2">
                            {optimizationProposals.map((proposal) => (
                                <div
                                    key={proposal.id}
                                    className="rounded border border-[#2e2a24] bg-[#171511] p-3"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="text-sm font-semibold text-foreground">
                                                {proposal.label}
                                            </div>
                                            <div className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                                                {proposal.description}
                                            </div>
                                        </div>
                                        <Button
                                            size="sm"
                                            onClick={() => onApplyOptimizationProposal(proposal.id)}
                                            className="h-8 shrink-0 blood-red border border-[#a02020] px-3 text-xs font-semibold tracking-wide text-[#f0d8b8] hover:brightness-125"
                                        >
                                            应用此方案
                                        </Button>
                                    </div>
                                    <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                                        <div className="rounded border border-[#2e2a24] bg-[#1c1a16] px-2.5 py-2">
                                            <div className="text-muted-foreground">宽 x 深</div>
                                            <div className="mt-1 font-mono text-foreground">
                                                {proposal.metrics.width.toFixed(0)} x {proposal.metrics.depth.toFixed(0)} mm
                                            </div>
                                        </div>
                                        <div className="rounded border border-[#2e2a24] bg-[#1c1a16] px-2.5 py-2">
                                            <div className="text-muted-foreground">面积</div>
                                            <div className="mt-1 font-mono text-foreground">
                                                {proposal.metrics.area.toFixed(0)} mm²
                                            </div>
                                            <div className="mt-1 text-[10px] text-muted-foreground">
                                                {formatAreaDelta(proposal.metrics.area)}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                                        <span
                                            className={`rounded border px-2 py-1 ${proposal.metrics.isOversized
                                                ? "border-[#8b1a1a50] bg-[#8b1a1a15] text-[#d27777]"
                                                : "border-[#2a3528] bg-[#1c2a1a] text-[#8cb880]"
                                                }`}
                                        >
                                            {proposal.metrics.isOversized ? "尺寸超限" : "尺寸正常"}
                                        </span>
                                        <span
                                            className={`rounded border px-2 py-1 ${proposal.metrics.hasBridgeWarning
                                                ? "border-[#7c5a1c] bg-[#2a2115] text-[#f0d8b8]"
                                                : "border-[#2a3528] bg-[#1c2a1a] text-[#8cb880]"
                                                }`}
                                        >
                                            {proposal.metrics.hasBridgeWarning ? "有桥接预警" : "无桥接预警"}
                                        </span>
                                        <span className="rounded border border-[#2e2a24] bg-[#1c1a16] px-2 py-1 text-muted-foreground">
                                            位移 {proposal.metrics.displacement.toFixed(1)} mm
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : null}
                {perfEnabled && (
                    <div className="iron-panel rounded-sm p-3">
                        <SectionHeader
                            icon={Ruler}
                            title="性能测量"
                            collapsible
                            defaultOpen={true}
                            summary="20 / 50 / 100 槽位压力样本"
                        >
                            <div className="space-y-2 mt-1">
                                <div className="text-[11px] leading-relaxed text-muted-foreground/75">
                                    加载样本后在 2D 视图里拖拽中心区域 3 到 5 秒，观察右下角的 MOVE / COLL / OUTL。
                                </div>
                                <div className="grid grid-cols-3 gap-1.5">
                                    {STEPPED_PERF_FIXTURE_SIZES.map((size) => (
                                        <Button
                                            key={size}
                                            variant="outline"
                                            onClick={() => handleLoadPerfFixture(size)}
                                            className="h-8 text-xs border-[#5a4a2a] text-[#c8a84e] hover:bg-[#2a2518] hover:text-[#e0c870] hover:border-[#7a6a3a]"
                                        >
                                            {size} 槽位
                                        </Button>
                                    ))}
                                </div>
                                <Button
                                    variant="outline"
                                    onClick={handleResetPerfSamples}
                                    className="w-full h-8 text-xs border-[#2e2a24] text-muted-foreground hover:bg-[#1c1a16] hover:text-foreground/80 hover:border-[#3d372e]"
                                >
                                    <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                                    清空采样
                                </Button>
                            </div>
                        </SectionHeader>
                    </div>
                )}

            </div>

        </div>
        </PanelShell>
    );
}

export function SteppedLayoutPanel(props: SteppedLayoutPanelProps) {
    const {
        params,
        actions,
    } = props;

    const structureSummary = `槽距${params.spacing}mm / 凹槽深度${params.holeDepth}mm / 断连${params.disconnectDistance}mm`;

    return (
        <SteppedPanelBody
            {...props}
            mode="stepped"
            actions={actions}
            structureSummary={structureSummary}
        />
    );
}

export function SteppedCadPanel(props: SteppedCadPanelProps) {
    const {
        params,
        updateParam,
        actions,
        onUpdateGroupSplitPartTarget,
    } = props;

    const splitGrooveType = params.splitGrooveType ?? "profile";
    const splitGrooveLabel = params.enableSplitRecess
        ? splitGrooveType === "inset" ? "内缩凹槽" : "轮廓凹槽"
        : "关";
    const splitFeatureSummary = ` / 装配:${splitGrooveLabel} / 定位柱${params.enableSplitLocators ? "开" : "关"}`;

    const handleSplitGrooveTypeChange = useCallback((type: SplitGrooveType | "off") => {
        if (type === "off") {
            updateParam("enableSplitRecess", false);
            return;
        }

        updateParam("enableSplitRecess", true);
        updateParam("splitGrooveType", type);
    }, [updateParam]);

    const structureSummary = `槽距${params.spacing}mm / 凹槽深度${params.holeDepth}mm / 装配槽${params.splitGrooveDepth}mm${splitFeatureSummary} / 断连${params.disconnectDistance}mm`;

    const structureExtras = (
        <>
            <ParamSlider
                label={STEPPED_LIMITS.splitGrooveDepth.label}
                value={params.splitGrooveDepth}
                config={STEPPED_LIMITS.splitGrooveDepth}
                onChange={(v) => updateParam("splitGrooveDepth", v)}
                unit={STEPPED_LIMITS.splitGrooveDepth.unit}
            />
            <div className="grid gap-2 rounded border border-border/60 bg-card/40 p-3">
                <div className="grid grid-cols-3 gap-1">
                    {[
                        ["off", "关"],
                        ["profile", "轮廓凹槽"],
                        ["inset", "内缩凹槽"],
                    ].map(([value, label]) => {
                        const selected = value === "off"
                            ? params.enableSplitRecess !== true
                            : params.enableSplitRecess === true && splitGrooveType === value;
                        return (
                            <Button
                                key={value}
                                type="button"
                                size="xs"
                                variant={selected ? "default" : "outline"}
                                aria-pressed={selected}
                                onClick={() =>
                                    handleSplitGrooveTypeChange(value as SplitGrooveType | "off")
                                }>
                                {label}
                            </Button>
                        );
                    })}
                </div>
                <label className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span>定位柱</span>
                    <Switch
                        checked={params.enableSplitLocators === true}
                        onCheckedChange={(checked) =>
                            updateParam("enableSplitLocators", checked)
                        }
                    />
                </label>
            </div>
        </>
    );

    const renderGroupSplitAssembly = useCallback((group: SteppedGroup) => (
        <div className="rounded border border-[#2e2a24] bg-[#171511] px-2.5 py-2 space-y-2">
            <div>
                <div className="text-[11px] font-medium text-foreground/90">拆件归并</div>
                <div className="text-[10px] text-muted-foreground">
                    可将不同高度的组导出为同一个分件 STL
                </div>
            </div>
            <Select
                value={group.splitPartGroupId ?? "__solo__"}
                onValueChange={(value) =>
                    onUpdateGroupSplitPartTarget(
                        group.id,
                        value === "__solo__" ? null : value,
                    )
                }
            >
                <SelectTrigger
                    size="sm"
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="w-full border-[#2e2a24] bg-[#0f0e0c] text-xs"
                    aria-label={`${group.name} 拆件归并目标`}
                >
                    <SelectValue placeholder="单独导出" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="__solo__">单独导出</SelectItem>
                    {params.groups
                        .filter((targetGroup) => targetGroup.id !== group.id)
                        .map((targetGroup) => (
                            <SelectItem key={targetGroup.id} value={targetGroup.id}>
                                并入 {targetGroup.name} ({targetGroup.bottomHeight}mm)
                            </SelectItem>
                        ))}
                </SelectContent>
            </Select>
        </div>
    ), [onUpdateGroupSplitPartTarget, params.groups]);

    return (
        <SteppedPanelBody
            {...props}
            mode="stepped-cad"
            actions={actions}
            structureSummary={structureSummary}
            structureExtras={structureExtras}
            renderGroupSplitAssembly={renderGroupSplitAssembly}
        />
    );
}
