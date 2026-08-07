"use client";

import dynamic from "next/dynamic";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TrayViewer = dynamic(() => import("@/components/TrayViewer"), {
  ssr: false,
  loading: () => (
    <div
      role="status"
      aria-live="polite"
      className="w-full h-full min-h-0 flex items-center justify-center bg-[#0a0908] md:min-h-[400px]"
    >
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <div aria-hidden="true" className="w-8 h-8 border-2 border-muted-foreground/40 border-t-primary rounded-full animate-spin" />
        <p className="text-sm font-mono tracking-wider">正在加载锻造视图…</p>
      </div>
    </div>
  ),
});

interface ViewportTabsProps {
  rightView: "2d" | "3d";
  onRightViewChange: (next: "2d" | "3d") => void;
  canvas: React.ReactNode;
  threeGeometry: React.ComponentProps<typeof TrayViewer>["geometry"];
  splitParts?: React.ComponentProps<typeof TrayViewer>["splitParts"];
  isGeneratingSplitPreview?: boolean;
  isPreviewStale: boolean;
  isGenerating?: boolean;
  onGenerate: () => void;
  onGenerateSplitPreview?: () => void;
  minimumCameraDistance?: React.ComponentProps<
    typeof TrayViewer
  >["minimumCameraDistance"];
}

export function ViewportTabs({
  rightView,
  onRightViewChange,
  canvas,
  threeGeometry,
  splitParts,
  isGeneratingSplitPreview,
  isPreviewStale,
  isGenerating,
  onGenerate,
  onGenerateSplitPreview,
  minimumCameraDistance,
}: ViewportTabsProps) {
  return (
    <Tabs
      value={rightView}
      onValueChange={(value) => {
        const nextView = value as "2d" | "3d";
        onRightViewChange(nextView);
        if (nextView === "3d" && isPreviewStale) {
          onGenerate();
        }
      }}
      className="flex-1 flex flex-col relative"
    >
      <div className="absolute top-3 left-5 z-20">
        <TabsList
          className="bg-[#1c1a16] border border-[#2e2a24]"
          onKeyDownCapture={(event) => {
            if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
              event.preventDefault();
              event.stopPropagation();
            }
          }}
        >
          <TabsTrigger value="2d" className="text-xs">
            2D 编辑
          </TabsTrigger>
          <TabsTrigger value="3d" className="text-xs">
            3D 预览
          </TabsTrigger>
        </TabsList>
      </div>

      <div
        aria-hidden={rightView === "2d" ? undefined : "true"}
        inert={rightView === "2d" ? undefined : true}
        className={`absolute inset-0 m-0 p-0 transition-opacity duration-150 ${
          rightView === "2d" ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div className="w-full h-full border-t border-[#2e2a24]">{canvas}</div>
      </div>

      <div
        className={`absolute inset-0 m-0 transition-opacity duration-150 ${
          rightView === "3d" ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        {rightView === "3d" ? (
          <TrayViewer
            geometry={threeGeometry}
            splitParts={splitParts}
            isStale={isPreviewStale}
            isGenerating={isGenerating}
            isGeneratingSplitPreview={isGeneratingSplitPreview}
            onRegenerate={onGenerate}
            onGenerateSplitPreview={onGenerateSplitPreview}
            minimumCameraDistance={minimumCameraDistance}
          />
        ) : null}
      </div>
    </Tabs>
  );
}
