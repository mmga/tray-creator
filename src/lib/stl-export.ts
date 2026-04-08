import stlSerializer from "@jscad/stl-serializer";
import type { Geom3 } from "@jscad/modeling/src/geometries/types";

/**
 * 将 JSCAD 几何体导出为 STL 并触发浏览器下载
 */
function exportToSTL(geometry: Geom3, filename: string): void {
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

/**
 * 根据自定义托盘参数生成 STL 文件名
 */
export function generateCustomSTLFilename(
  width: number,
  depth: number,
  slotCount: number
): string {
  return `tray_custom_${width}x${depth}_${slotCount}slots.stl`;
}

/**
 * 根据简易阶梯模式参数生成 STL 文件名
 */
export function generateSimpleSteppedSTLFilename(
  width: number,
  depth: number,
  rowCount: number,
  slotCount: number,
): string {
  return `tray_simple_stepped_${width}x${depth}_${rowCount}rows_${slotCount}slots.stl`;
}
