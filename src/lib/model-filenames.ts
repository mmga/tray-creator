/**
 * 根据托盘参数生成 STL 文件名。
 */
export function generateSTLFilename(
  rows: number,
  columns: number,
  holeDiameter: number,
): string {
  return `tray_${columns}x${rows}_${holeDiameter}mm.stl`;
}

/**
 * 根据自定义托盘参数生成 STL 文件名。
 */
export function generateCustomSTLFilename(
  width: number,
  depth: number,
  slotCount: number,
): string {
  return `tray_custom_${width}x${depth}_${slotCount}slots.stl`;
}
