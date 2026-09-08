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

/**
 * 生成网格堆叠盒体的 body / lid STL 文件名。
 */
export function generateGridBoxSTLFilename(
  width: number,
  depth: number,
  height: number,
  columns: number,
  rows: number,
  part: "body" | "lid",
): string {
  return `box_grid_${width}x${depth}x${height}_${columns}x${rows}_${part}.stl`;
}

/**
 * 生成自由布局堆叠盒体的 body / lid STL 文件名。
 */
export function generateCustomBoxSTLFilename(
  width: number,
  depth: number,
  height: number,
  slotCount: number,
  part: "body" | "lid",
): string {
  return `box_custom_${width}x${depth}x${height}_${slotCount}slots_${part}.stl`;
}
