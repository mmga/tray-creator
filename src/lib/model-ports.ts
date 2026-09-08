import type { Geom3 } from "@jscad/modeling/src/geometries/types";
import type {
  BaseConverterParams,
  CustomLayoutParams,
  GroupOutlinePreview,
  SteppedLayoutParams,
} from "@/types/custom-tray";
import type { TrayParams } from "@/types/tray";

export interface STLExportResult {
  blob: Blob;
  filename: string;
}

export interface SteppedSplitPartResult {
  index: number;
  filenameLabel: string;
  label: string;
  fromHeight: number;
  toHeight: number;
  geometry: Geom3;
}

export interface IdFactory {
  createId: () => string;
}

export interface DownloadPort {
  downloadBlob: (blob: Blob, filename: string) => void;
}

export interface STLExportWorkerPort {
  exportSTL: (
    geometry: Geom3,
    filename: string,
  ) => Promise<STLExportResult>;
}

/** 盒体与盖子的打印几何（未旁移）。 */
export interface BoxPartsResult {
  body: Geom3;
  lid: Geom3;
  bodyVolume: number;
  lidVolume: number;
}

export interface GridWorkerPort extends STLExportWorkerPort {
  generateGrid: (
    params: TrayParams,
  ) => Promise<{
    geometry: Geom3;
    volume: number;
    bodyVolume?: number;
    lidVolume?: number;
  }>;
  /** 盒体专用：返回未旁移的盒体与盖子打印几何。 */
  generateGridBoxParts?: (params: TrayParams) => Promise<BoxPartsResult>;
}

export interface CustomWorkerPort extends STLExportWorkerPort {
  generateCustom: (
    params: CustomLayoutParams,
  ) => Promise<{
    geometry: Geom3;
    volume: number;
    bodyVolume?: number;
    lidVolume?: number;
  }>;
  /** 盒体专用：返回未旁移的盒体与盖子打印几何。 */
  generateCustomBoxParts?: (params: CustomLayoutParams) => Promise<BoxPartsResult>;
}

export interface BaseConverterWorkerPort extends STLExportWorkerPort {
  generateBaseConverter: (
    params: BaseConverterParams,
  ) => Promise<{ geometry: Geom3; volume: number }>;
}

export interface SteppedOutlinePreviewPort {
  generateSteppedOutlinePreview: (
    params: SteppedLayoutParams,
  ) => Promise<{
    outlinePreview: GroupOutlinePreview[] | null;
    durationMs: number;
  }>;
}

export interface SteppedWorkerPort
  extends STLExportWorkerPort,
    SteppedOutlinePreviewPort {
  generateStepped: (
    params: SteppedLayoutParams,
  ) => Promise<{ geometry: Geom3; volume: number }>;
  generateSteppedSplitParts: (
    params: SteppedLayoutParams,
  ) => Promise<{ parts: SteppedSplitPartResult[] }>;
}
