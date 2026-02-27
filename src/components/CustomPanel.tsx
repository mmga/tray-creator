"use client";

import type { CustomLayoutParams } from "@/types/custom-tray";
import { BASE_PRESETS, ELLIPSE_PRESETS, CUSTOM_LIMITS, PARAM_CONFIG, MAX_BUILD_SIZE } from "@/lib/config";
import { calculateCustomTrayDimensions } from "@/lib/custom-tray-model";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
  Share2,
  Send,
} from "lucide-react";
import { BaseHoleConfig } from "@/components/BaseHoleConfig";
import { ParamIOButtons } from "@/components/ParamIOButtons";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ParamSlider } from "@/components/ui/ParamSlider";
import { isAdmin } from "@/lib/permissions";
import { exportParams } from "@/lib/param-io";
import { calculateWeight, calculateCustomPrice } from "@/lib/pricing";
import { sendConfigToKV, buildPayload, serializePayload } from "@/lib/edgeone-kv";
import { useToast } from "@/hooks/useToast";
import { ConfirmSendDialog } from "@/components/ConfirmSendDialog";

// ── Props ──────────────────────────────

interface CustomPanelProps {
  params: CustomLayoutParams;
  effectiveDimensions: { width: number; depth: number };
  updateParam: <K extends keyof CustomLayoutParams>(key: K, value: CustomLayoutParams[K]) => void;
  setParams: React.Dispatch<React.SetStateAction<CustomLayoutParams>>;
  onAddSlot: (width: number, height?: number) => void;
  onGenerate: () => void;
  onExportSTL: () => void;
  isGenerating: boolean;
  volume: number;
}

export default function CustomPanel({
  params,
  effectiveDimensions,
  updateParam,
  setParams,
  onAddSlot,
  onGenerate,
  onExportSTL,
  isGenerating,
  volume,
}: CustomPanelProps) {
  const dimensions = calculateCustomTrayDimensions(params);
  const effectiveWidth = effectiveDimensions.width;
  const effectiveDepth = effectiveDimensions.depth;
  const isOversized = effectiveWidth > MAX_BUILD_SIZE || effectiveDepth > MAX_BUILD_SIZE;
  const [autoPreview, setAutoPreview] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingJson, setPendingJson] = useState("");
  const { toast } = useToast();

  // Auto-preview debouncing logic
  useEffect(() => {
    if (!autoPreview || isGenerating || isOversized) return;

    // Check if right view is 3d, optional but we assume the user might be looking at either.
    const handler = setTimeout(() => {
      onGenerate();
    }, 500); // 500ms debounce

    return () => clearTimeout(handler);
  }, [params, autoPreview, isOversized]);

  const handleReset = () => {
    // Reset to defaults but keep current logic if needed
    // For now, simpler to reload or re-init state in parent, 
    // but here we can just reset specific params if we want.
    // However, CustomPanelProps passes setParams which expects full object.
    // We'll trust the parent or import default.
    // Let's import default to be safe.
    const { CUSTOM_LAYOUT_DEFAULTS } = require("@/lib/config");
    setParams(CUSTOM_LAYOUT_DEFAULTS);
  };

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      {/* 添加凹槽 — 移动端默认展开 */}
      <div className="iron-panel rounded-sm p-3">
        <SectionHeader icon={BoxSelect} title="添加凹槽" collapsible defaultOpen={true}
          summary={`已有 ${params.slots.length} 个凹槽`}>
          <div className="space-y-2">
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

            <div className="text-[10px] text-muted-foreground/70 font-bold tracking-wider uppercase mb-0.5 mt-1.5">椭圆</div>
            <div className="grid grid-cols-2 gap-1.5">
              {ELLIPSE_PRESETS.map((preset, i) => (
                <Button
                  key={i}
                  variant="outline"
                  size="sm"
                  onClick={() => onAddSlot(preset.width, preset.height)}
                  className="h-10 lg:h-7 text-xs lg:text-[11px] border-[#2e2a24] bg-[#1c1a16] hover:bg-[#2e2a24] hover:text-primary transition-all"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  {preset.name.replace('mm', '')}
                </Button>
              ))}
            </div>
          </div>
        </SectionHeader>
      </div>

      {/* 结构参数 — 移动端默认折叠 */}
      <div className="iron-panel rounded-sm p-4">
        <SectionHeader icon={Wrench} title="结构参数" collapsible defaultOpen={false}
          summary={`槽距${params.spacing}mm / 边距${(params.boundarySpacingIndependent ? params.boundarySpacing : params.spacing)}mm / 底厚${params.baseThickness}mm`}>
          <div className="space-y-4">
            <ParamSlider
              label={CUSTOM_LIMITS.spacing.label}
              value={params.spacing}
              config={CUSTOM_LIMITS.spacing}
              onChange={(v) => updateParam("spacing", v)}
              unit={CUSTOM_LIMITS.spacing.unit}
            />
            <div className="flex items-center justify-between p-3 rounded bg-[#1c1a16] border border-[#2e2a24]">
              <Label htmlFor="custom-boundary-spacing-independent" className="text-sm cursor-pointer text-[#f0d8b8]">
                边界间距独立调整
              </Label>
              <Switch
                id="custom-boundary-spacing-independent"
                checked={params.boundarySpacingIndependent}
                onCheckedChange={(checked) => updateParam("boundarySpacingIndependent", checked)}
                className="data-[state=checked]:bg-[#8cb880]"
              />
            </div>
            {params.boundarySpacingIndependent && (
              <ParamSlider
                label={CUSTOM_LIMITS.boundarySpacing.label}
                value={params.boundarySpacing}
                config={CUSTOM_LIMITS.boundarySpacing}
                onChange={(v) => updateParam("boundarySpacing", v)}
                unit={CUSTOM_LIMITS.boundarySpacing.unit}
              />
            )}
            <ParamSlider
              label={PARAM_CONFIG.baseThickness.label}
              value={params.baseThickness}
              config={CUSTOM_LIMITS.baseThickness}
              onChange={(v) => updateParam("baseThickness", v)}
              unit={PARAM_CONFIG.baseThickness.unit}
            />
            <ParamSlider
              label={PARAM_CONFIG.holeDepth.label}
              value={params.holeDepth}
              config={CUSTOM_LIMITS.holeDepth}
              onChange={(v) => updateParam("holeDepth", v)}
              unit={PARAM_CONFIG.holeDepth.unit}
            />
            <ParamSlider
              label={PARAM_CONFIG.cornerRadius.label}
              value={params.cornerRadius}
              config={CUSTOM_LIMITS.cornerRadius}
              onChange={(v) => updateParam("cornerRadius", v)}
              unit={PARAM_CONFIG.cornerRadius.unit}
            />
          </div>
        </SectionHeader>
      </div>

      {/* 底板孔位 — 移动端默认折叠 */}
      <BaseHoleConfig
        enableBaseHole={params.enableBaseHole}
        baseHoleSize={params.baseHoleSize}
        baseThickness={params.baseThickness}
        updateParam={updateParam}
        collapsible
        defaultOpen={false}
      />

      {/* 统计信息 — 移动端默认折叠 */}
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
                    ¥{calculateCustomPrice(params, volume).toFixed(1)}
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

      {/* 自动预览与操作按钮 — 始终展开 */}
      <div className="flex flex-col gap-2.5 pb-4">
        <div className="flex items-center justify-between p-3 rounded bg-[#1c1a16] border border-[#2e2a24]">
          <Label htmlFor="custom-auto-preview" className="text-sm cursor-pointer text-[#f0d8b8]">
            启用自动预览
          </Label>
          <Switch
            id="custom-auto-preview"
            checked={autoPreview}
            onCheckedChange={setAutoPreview}
            className="data-[state=checked]:bg-[#8cb880]"
          />
        </div>

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
        {isAdmin ? (
          <Button
            onClick={onExportSTL}
            className="w-full h-10 bg-[#2a3528] hover:bg-[#354530] text-sm text-[#8cb880] font-semibold tracking-wider cursor-pointer border border-[#4a6741] shadow-lg shadow-[#2a352830]"
          >
            <Download className="w-4 h-4 mr-2" />
            导出 STL
          </Button>
        ) : (
          <>
            <Button
              onClick={() => exportParams("custom", params as any)}
              className="w-full h-10 bg-[#2a3528] hover:bg-[#354530] text-sm text-[#8cb880] font-semibold tracking-wider cursor-pointer border border-[#4a6741] shadow-lg shadow-[#2a352830]"
            >
              <Share2 className="w-4 h-4 mr-2" />
              导出参数
            </Button>
            <Button
              onClick={() => {
                const payload = buildPayload("custom", params);
                setPendingJson(serializePayload(payload));
                setDialogOpen(true);
              }}
              className="w-full h-10 bg-[#1e2a3a] hover:bg-[#283848] text-sm text-[#7eb8d8] font-semibold tracking-wider cursor-pointer transition-all duration-200 border border-[#3a5a7a] shadow-lg shadow-[#1e2a3a30]"
            >
              <Send className="w-4 h-4 mr-2" />
              发送配置
            </Button>
          </>
        )}
        <Button
          variant="outline"
          onClick={handleReset}
          className="w-full h-11 lg:h-9 text-sm border-[#2e2a24] text-muted-foreground tracking-wider cursor-pointer hover:bg-[#1c1a16] hover:text-foreground/80 hover:border-[#3d372e]"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          重置参数
        </Button>
        <ParamIOButtons
          mode="custom"
          params={params as unknown as Record<string, unknown>}
          onImport={(p) => setParams(p as CustomLayoutParams)}
        />
      </div>

      <ConfirmSendDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        jsonData={pendingJson}
        isSending={isSending}
        onConfirm={async () => {
          setIsSending(true);
          const result = await sendConfigToKV("custom", params);
          setIsSending(false);
          setDialogOpen(false);
          if (result.success) {
            toast("success", `配置已发送 (${result.orderId})`);
          } else {
            toast("error", `发送失败：${result.error}`);
          }
        }}
      />
    </div>
  );
}
