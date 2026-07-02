import type { Geom3 } from "@jscad/modeling/src/geometries/types";
import type {
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

export interface GridWorkerPort extends STLExportWorkerPort {
  generateGrid: (
    params: TrayParams,
  ) => Promise<{ geometry: Geom3; volume: number }>;
}

export interface CustomWorkerPort extends STLExportWorkerPort {
  generateCustom: (
    params: CustomLayoutParams,
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
}

export interface SteppedCadWorkerPort
  extends STLExportWorkerPort,
    SteppedOutlinePreviewPort {
  generateSteppedCad: (
    params: SteppedLayoutParams,
  ) => Promise<{ geometry: Geom3; volume: number }>;
  generateSteppedCadSplitParts: (
    params: SteppedLayoutParams,
  ) => Promise<{ parts: SteppedSplitPartResult[] }>;
}
