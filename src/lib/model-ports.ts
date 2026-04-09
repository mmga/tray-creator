import type { Geom3 } from "@jscad/modeling/src/geometries/types";
import type { TrayParams } from "@/types/tray";

export interface STLExportResult {
  blob: Blob;
  filename: string;
}

export interface DownloadPort {
  downloadBlob: (blob: Blob, filename: string) => void;
}

export interface GridWorkerPort {
  generateGrid: (
    params: TrayParams,
  ) => Promise<{ geometry: Geom3; volume: number }>;
  exportSTL: (
    geometry: Geom3,
    filename: string,
  ) => Promise<STLExportResult>;
}
