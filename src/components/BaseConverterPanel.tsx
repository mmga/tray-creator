"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import {
  ArrowRightLeft,
  Library,
  Pencil,
  SlidersHorizontal,
  Trash2,
  Undo2,
} from "lucide-react";
import type {
  BaseConverterParams,
  ConversionSourceGeometrySnapshot,
  ConversionTargetGeometrySnapshot,
} from "@/types/custom-tray";
import {
  BASE_CONVERTER_LIMITS,
  SOURCE_BASE_STANDARDS,
  TARGET_BASE_STANDARDS,
  getConversionRecessDimensions,
  getMaxBaseConverterSideBevelWidth,
  normalizeBaseConverterParams,
  snapshotSourceStandard,
  snapshotTargetStandard,
  validateBaseConverterParams,
} from "@/lib/base-converter-config";
import { DEFAULT_ELLIPSE_PROFILE_EXPONENT } from "@/lib/slot-definitions";
import {
  createPersonalSpecificationId,
  deletePersonalBaseSpecification,
  loadPersonalBaseSpecifications,
  savePersonalBaseSpecification,
  type PersonalBaseSpecification,
} from "@/lib/personal-base-specifications";
import { Button } from "@/components/ui/button";
import { DraftNumberInput } from "@/components/ui/DraftNumberInput";
import { useToast } from "@/hooks/useToast";
import { Input } from "@/components/ui/input";
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
import { RoundBaseConfig } from "@/components/RoundBaseConfig";

interface BaseConverterPanelProps {
  params: BaseConverterParams;
  updateParam: <K extends keyof BaseConverterParams>(
    key: K,
    value: BaseConverterParams[K],
  ) => void;
  updateParams: (
    mutate: (params: BaseConverterParams) => BaseConverterParams,
  ) => void;
  beginContinuousEdit: () => boolean;
  previewParam: <K extends keyof BaseConverterParams>(
    key: K,
    value: BaseConverterParams[K],
  ) => void;
  commitContinuousEdit: () => void;
  cancelContinuousEdit: () => void;
  undo: () => void;
  canUndo: boolean;
  actions: ReactNode;
  isGenerating: boolean;
  isPreviewStale: boolean;
  volume: number;
}

interface SourceDraft {
  name: string;
  nominalShort: number;
  nominalLong: number;
  fitShort: number;
  fitLong: number;
  cornerRadius: number;
}

interface TargetDraft {
  name: string;
  shortAxis: number;
  longAxis: number;
  profileExponent: number;
}

const INITIAL_SOURCE_DRAFT: SourceDraft = {
  name: "我的矩形底盘",
  nominalShort: 25,
  nominalLong: 50,
  fitShort: 25,
  fitLong: 50,
  cornerRadius: 0,
};

const INITIAL_TARGET_DRAFT: TargetDraft = {
  name: "我的椭圆底盘",
  shortAxis: 42,
  longAxis: 75,
  profileExponent: DEFAULT_ELLIPSE_PROFILE_EXPONENT,
};

function NumericField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const inputId = useId();
  return (
    <div className="space-y-1">
      <Label htmlFor={inputId} className="text-xs text-muted-foreground">{label}</Label>
      <DraftNumberInput
        id={inputId}
        step="any"
        value={value}
        onValueChange={onChange}
        className="h-8 bg-[#1c1a16] border-[#2e2a24] font-mono"
      />
    </div>
  );
}

function customSourceSnapshot(
  draft: SourceDraft,
  id: string,
): ConversionSourceGeometrySnapshot {
  const nominalShort = Math.min(draft.nominalShort, draft.nominalLong);
  const nominalLong = Math.max(draft.nominalShort, draft.nominalLong);
  const fitShort = Math.min(draft.fitShort, draft.fitLong);
  const fitLong = Math.max(draft.fitShort, draft.fitLong);
  return {
    customId: id,
    name: draft.name.trim() || "未命名矩形底盘",
    shape: "rectangle",
    nominalWidth: nominalShort,
    nominalDepth: nominalLong,
    fitWidth: fitShort,
    fitDepth: fitLong,
    cornerRadius: draft.cornerRadius,
  };
}

function customTargetSnapshot(
  draft: TargetDraft,
  id: string,
): ConversionTargetGeometrySnapshot {
  const shortAxis = Math.min(draft.shortAxis, draft.longAxis);
  const longAxis = Math.max(draft.shortAxis, draft.longAxis);
  const circle = shortAxis === longAxis;
  return {
    customId: id,
    name: draft.name.trim() || "未命名目标底盘",
    shape: circle ? "circle" : "ellipse",
    width: shortAxis,
    depth: longAxis,
    profileExponent: circle ? 2 : draft.profileExponent,
  };
}

export default function BaseConverterPanel({
  params: inputParams,
  updateParam,
  updateParams,
  beginContinuousEdit,
  previewParam,
  commitContinuousEdit,
  cancelContinuousEdit,
  undo,
  canUndo,
  actions,
  isGenerating,
  isPreviewStale,
  volume,
}: BaseConverterPanelProps) {
  const params = normalizeBaseConverterParams(inputParams);
  const { toast } = useToast();
  const [personalSpecifications, setPersonalSpecifications] = useState<
    PersonalBaseSpecification[]
  >(() => loadPersonalBaseSpecifications());
  const [sourceDraft, setSourceDraft] =
    useState<SourceDraft>(INITIAL_SOURCE_DRAFT);
  const [targetDraft, setTargetDraft] =
    useState<TargetDraft>(INITIAL_TARGET_DRAFT);
  const [editingSourceId, setEditingSourceId] = useState<string | null>(null);
  const [editingTargetId, setEditingTargetId] = useState<string | null>(null);
  const source = params.geometrySnapshot.source;
  const target = params.geometrySnapshot.target;
  const recess = getConversionRecessDimensions(
    source,
    params.conversionClearance,
  );
  const validationError = validateBaseConverterParams(params);
  const sideBevelConfig = {
    ...BASE_CONVERTER_LIMITS.sideBevelWidth,
    max: getMaxBaseConverterSideBevelWidth(
      source,
      target,
      params.conversionClearance,
    ),
  };
  const result = projectBaseConverterResult(params, {
    volume,
    isGenerating,
    isPreviewStale,
  });
  const personalSources = useMemo(
    () => personalSpecifications.filter((entry) => entry.role === "source"),
    [personalSpecifications],
  );
  const personalTargets = useMemo(
    () => personalSpecifications.filter((entry) => entry.role === "target"),
    [personalSpecifications],
  );

  const selectSource = (id: string) => {
    const standard = SOURCE_BASE_STANDARDS.find((entry) => entry.id === id);
    const personal = personalSources.find((entry) => entry.id === id);
    const next = standard
      ? snapshotSourceStandard(standard)
      : personal?.geometry;
    if (!next) return;
    updateParams((previous) => ({
      ...previous,
      sourceStandardId: id,
      geometrySnapshot: { ...previous.geometrySnapshot, source: next },
    }));
  };
  const selectTarget = (id: string) => {
    const standard = TARGET_BASE_STANDARDS.find((entry) => entry.id === id);
    const personal = personalTargets.find((entry) => entry.id === id);
    const next = standard
      ? snapshotTargetStandard(standard)
      : personal?.geometry;
    if (!next) return;
    updateParams((previous) => ({
      ...previous,
      targetStandardId: id,
      geometrySnapshot: { ...previous.geometrySnapshot, target: next },
    }));
  };
  const applySourceDraft = (save: boolean) => {
    const id = save && editingSourceId
      ? editingSourceId
      : createPersonalSpecificationId("source");
    const geometry = customSourceSnapshot(sourceDraft, id);
    if (save) {
      try {
        setPersonalSpecifications(savePersonalBaseSpecification({
          id,
          role: "source",
          name: geometry.name,
          geometry,
        }));
      } catch (error) {
        toast(
          "error",
          `个人规格保存失败：${error instanceof Error ? error.message : "浏览器存储不可用"}`,
        );
        return;
      }
      setEditingSourceId(null);
    }
    updateParams((previous) => ({
      ...previous,
      sourceStandardId: id,
      geometrySnapshot: { ...previous.geometrySnapshot, source: geometry },
    }));
  };
  const applyTargetDraft = (save: boolean) => {
    const id = save && editingTargetId
      ? editingTargetId
      : createPersonalSpecificationId("target");
    const geometry = customTargetSnapshot(targetDraft, id);
    if (save) {
      try {
        setPersonalSpecifications(savePersonalBaseSpecification({
          id,
          role: "target",
          name: geometry.name,
          geometry,
        }));
      } catch (error) {
        toast(
          "error",
          `个人规格保存失败：${error instanceof Error ? error.message : "浏览器存储不可用"}`,
        );
        return;
      }
      setEditingTargetId(null);
    }
    updateParams((previous) => ({
      ...previous,
      targetStandardId: id,
      geometrySnapshot: { ...previous.geometrySnapshot, target: geometry },
    }));
  };
  const removePersonal = (id: string) => {
    try {
      setPersonalSpecifications(deletePersonalBaseSpecification(id));
    } catch (error) {
      toast(
        "error",
        `个人规格删除失败：${error instanceof Error ? error.message : "浏览器存储不可用"}`,
      );
      return;
    }
    if (editingSourceId === id) setEditingSourceId(null);
    if (editingTargetId === id) setEditingTargetId(null);
  };
  const editPersonal = (entry: PersonalBaseSpecification) => {
    if (entry.role === "source") {
      setEditingSourceId(entry.id);
      setSourceDraft({
        name: entry.name,
        nominalShort: entry.geometry.nominalWidth,
        nominalLong: entry.geometry.nominalDepth,
        fitShort: entry.geometry.fitWidth,
        fitLong: entry.geometry.fitDepth,
        cornerRadius: entry.geometry.cornerRadius,
      });
      return;
    }
    setEditingTargetId(entry.id);
    setTargetDraft({
      name: entry.name,
      shortAxis: entry.geometry.width,
      longAxis: entry.geometry.depth,
      profileExponent: entry.geometry.profileExponent,
    });
  };
  const sliderProps = <K extends keyof BaseConverterParams>(key: K) => ({
    onChange: (value: number) => updateParam(key, value as BaseConverterParams[K]),
    onContinuousChangeStart: beginContinuousEdit,
    onContinuousChange: (value: number) =>
      previewParam(key, value as BaseConverterParams[K]),
    onContinuousChangeCommit: commitContinuousEdit,
    onContinuousChangeCancel: cancelContinuousEdit,
    allowOutOfRangeInput: true,
  });
  const currentSourceIsEmbedded = !SOURCE_BASE_STANDARDS.some(
    (entry) => entry.id === params.sourceStandardId,
  ) && !personalSources.some((entry) => entry.id === params.sourceStandardId);
  const currentTargetIsEmbedded = !TARGET_BASE_STANDARDS.some(
    (entry) => entry.id === params.targetStandardId,
  ) && !personalTargets.some((entry) => entry.id === params.targetStandardId);

  return (
    <PanelShell summary={<TrayResultSummary result={result} />} actions={actions}>
      <div className="flex flex-col gap-4 animate-fade-in">
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canUndo}
            onClick={undo}
          >
            <Undo2 className="mr-1.5 h-3.5 w-3.5" />
            撤销
          </Button>
        </div>

        <div
          className="grid grid-cols-3 gap-1 rounded-sm border border-[#2e2a24] bg-[#16140f] p-1"
          aria-label="底盘生成类型"
        >
          {([
            ["plain", "普通底盘"],
            ["push-fit", "简版底盘"],
            ["conversion", "转换底盘"],
          ] as const).map(([kind, label]) => (
            <Button
              key={kind}
              type="button"
              size="sm"
              variant={params.generationKind === kind ? "default" : "ghost"}
              aria-pressed={params.generationKind === kind}
              onClick={() => updateParam("generationKind", kind)}
              className="px-2 text-xs"
            >
              {label}
            </Button>
          ))}
        </div>

        {validationError && (
          <div role="alert" className="rounded-sm border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
            {validationError}；仍可编辑、保存草稿和查看 2D。
          </div>
        )}

        {params.generationKind !== "conversion" && (
          <RoundBaseConfig params={params} updateParams={updateParams} />
        )}

        {params.generationKind === "conversion" && (<>

        <div className="iron-panel rounded-sm p-4">
          <SectionHeader
            icon={ArrowRightLeft}
            title="底盘转换"
            collapsible
            defaultOpen
            summary={`${source.name} → ${target.name}`}
          >
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="base-converter-source-standard" className="text-sm text-muted-foreground">
                  原底盘
                </Label>
                <Select value={params.sourceStandardId} onValueChange={selectSource}>
                  <SelectTrigger id="base-converter-source-standard" className="bg-[#1c1a16] border-[#2e2a24]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#16140f] border-[#2e2a24]">
                    {SOURCE_BASE_STANDARDS.map((standard) => (
                      <SelectItem key={standard.id} value={standard.id}>
                        标准 · {standard.shape === "circle" ? "圆形" : "方形 / 矩形"} · {standard.name}
                      </SelectItem>
                    ))}
                    {personalSources.map((entry) => (
                      <SelectItem key={entry.id} value={entry.id}>
                        个人 · {entry.name}
                      </SelectItem>
                    ))}
                    {currentSourceIsEmbedded && (
                      <SelectItem value={params.sourceStandardId}>
                        当前自定义 · {source.name}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="base-converter-target-standard" className="text-sm text-muted-foreground">
                  目标圆形 / 椭圆底盘
                </Label>
                <Select value={params.targetStandardId} onValueChange={selectTarget}>
                  <SelectTrigger id="base-converter-target-standard" className="bg-[#1c1a16] border-[#2e2a24]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#16140f] border-[#2e2a24]">
                    {TARGET_BASE_STANDARDS.map((standard) => (
                      <SelectItem key={standard.id} value={standard.id}>
                        标准 · {standard.shape === "circle" ? "圆形" : "椭圆"} · {standard.name}
                      </SelectItem>
                    ))}
                    {personalTargets.map((entry) => (
                      <SelectItem key={entry.id} value={entry.id}>
                        个人 · {entry.name}
                      </SelectItem>
                    ))}
                    {currentTargetIsEmbedded && (
                      <SelectItem value={params.targetStandardId}>
                        当前自定义 · {target.name}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-2 rounded-sm border border-[#2e2a24] bg-[#1c1a16] p-3 text-xs">
                <div>
                  <div className="text-muted-foreground">单边装配间隙</div>
                  <div className="mt-1 font-mono text-primary">
                    {params.conversionClearance.toFixed(2)} mm
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">最终凹槽</div>
                  <div className="mt-1 font-mono text-primary">
                    {recess.width.toFixed(2)} × {recess.depth.toFixed(2)} mm
                  </div>
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
            summary={`底厚 ${params.floorThickness}mm / 挡边 ${params.recessDepth}mm / 斜面 ${params.sideBevelWidth}mm`}
          >
            <div className="space-y-4">
              <ParamSlider
                label={BASE_CONVERTER_LIMITS.conversionClearance.label}
                value={params.conversionClearance}
                config={BASE_CONVERTER_LIMITS.conversionClearance}
                unit="mm"
                {...sliderProps("conversionClearance")}
              />
              <ParamSlider
                label={BASE_CONVERTER_LIMITS.floorThickness.label}
                value={params.floorThickness}
                config={BASE_CONVERTER_LIMITS.floorThickness}
                unit="mm"
                {...sliderProps("floorThickness")}
              />
              <ParamSlider
                label={BASE_CONVERTER_LIMITS.recessDepth.label}
                value={params.recessDepth}
                config={BASE_CONVERTER_LIMITS.recessDepth}
                unit="mm"
                {...sliderProps("recessDepth")}
              />
              <ParamSlider
                label={BASE_CONVERTER_LIMITS.sideBevelWidth.label}
                value={params.sideBevelWidth}
                config={sideBevelConfig}
                unit="mm"
                {...sliderProps("sideBevelWidth")}
              />
            </div>
          </SectionHeader>
        </div>

        <div className="iron-panel rounded-sm p-4">
          <SectionHeader
            icon={Library}
            title="自定义与个人规格"
            collapsible
            defaultOpen={false}
            summary={`${personalSpecifications.length} 个个人规格`}
          >
            <div className="space-y-5">
              <div className="space-y-3">
                <Label>自定义源底盘</Label>
                <Input
                  value={sourceDraft.name}
                  onChange={(event) =>
                    setSourceDraft((draft) => ({ ...draft, name: event.target.value }))}
                  className="h-8 bg-[#1c1a16] border-[#2e2a24]"
                  aria-label="自定义源规格名称"
                />
                <div className="grid grid-cols-2 gap-2">
                  <NumericField label="标称短轴 mm" value={sourceDraft.nominalShort} onChange={(value) => setSourceDraft((draft) => ({ ...draft, nominalShort: value }))} />
                  <NumericField label="标称长轴 mm" value={sourceDraft.nominalLong} onChange={(value) => setSourceDraft((draft) => ({ ...draft, nominalLong: value }))} />
                  <NumericField label="实测短轴 mm" value={sourceDraft.fitShort} onChange={(value) => setSourceDraft((draft) => ({ ...draft, fitShort: value }))} />
                  <NumericField label="实测长轴 mm" value={sourceDraft.fitLong} onChange={(value) => setSourceDraft((draft) => ({ ...draft, fitLong: value }))} />
                  <NumericField label="源圆角 mm" value={sourceDraft.cornerRadius} onChange={(value) => setSourceDraft((draft) => ({ ...draft, cornerRadius: value }))} />
                </div>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => applySourceDraft(false)}>
                    应用
                  </Button>
                  <Button type="button" size="sm" onClick={() => applySourceDraft(true)}>
                    {editingSourceId ? "更新并应用" : "保存并应用"}
                  </Button>
                </div>
              </div>

              <div className="space-y-3 border-t border-[#2e2a24] pt-4">
                <Label>自定义目标底盘</Label>
                <Input
                  value={targetDraft.name}
                  onChange={(event) =>
                    setTargetDraft((draft) => ({ ...draft, name: event.target.value }))}
                  className="h-8 bg-[#1c1a16] border-[#2e2a24]"
                  aria-label="自定义目标规格名称"
                />
                <div className="grid grid-cols-2 gap-2">
                  <NumericField label="短轴 mm" value={targetDraft.shortAxis} onChange={(value) => setTargetDraft((draft) => ({ ...draft, shortAxis: value }))} />
                  <NumericField label="长轴 mm" value={targetDraft.longAxis} onChange={(value) => setTargetDraft((draft) => ({ ...draft, longAxis: value }))} />
                  {targetDraft.shortAxis !== targetDraft.longAxis && (
                    <NumericField label="丰满度指数" value={targetDraft.profileExponent} onChange={(value) => setTargetDraft((draft) => ({ ...draft, profileExponent: value }))} />
                  )}
                </div>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => applyTargetDraft(false)}>
                    应用
                  </Button>
                  <Button type="button" size="sm" onClick={() => applyTargetDraft(true)}>
                    {editingTargetId ? "更新并应用" : "保存并应用"}
                  </Button>
                </div>
              </div>

              {personalSpecifications.length > 0 && (
                <div className="space-y-2 border-t border-[#2e2a24] pt-4">
                  <Label>个人规格库</Label>
                  {personalSpecifications.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between rounded-sm bg-[#1c1a16] px-2 py-1.5 text-xs">
                      <span>{entry.role === "source" ? "源" : "目标"} · {entry.name}</span>
                      <div className="flex">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          aria-label={`编辑个人规格 ${entry.name}`}
                          onClick={() => editPersonal(entry)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          aria-label={`删除个人规格 ${entry.name}`}
                          onClick={() => removePersonal(entry.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </SectionHeader>
        </div>
        </>)}
      </div>
    </PanelShell>
  );
}
