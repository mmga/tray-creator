import stlSerializer from "@jscad/stl-serializer";
import type { Geom3 } from "@jscad/modeling/src/geometries/types";

/**
 * 将 JSCAD 几何体导出为 STL 并触发浏览器下载
 */
export function exportToSTL(geometry: Geom3, filename: string): void {
  const rawData = stlSerializer.serialize({ binary: true }, geometry);
  const blob = new Blob(rawData as BlobPart[], {
    type: "application/octet-stream",
  });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();

  // 清理
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * 根据托盘参数生成 STL 文件名
 */
export function generateSTLFilename(
  rows: number,
  columns: number,
  holeDiameter: number
): string {
  return `tray_${columns}x${rows}_${holeDiameter}mm.stl`;
}
