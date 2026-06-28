import type { SimpleSteppedLayoutParams } from "@/types/custom-tray";
import { MAX_TRAY_SIZE } from "@/lib/config";

const SIMPLE_STEPPED_EMPTY_SIZE = 120;

export const SIMPLE_STEPPED_LAYOUT_DEFAULTS: SimpleSteppedLayoutParams = {
  trayWidth: SIMPLE_STEPPED_EMPTY_SIZE,
  trayDepth: SIMPLE_STEPPED_EMPTY_SIZE,
  rows: [],
  slots: [],
  firstRowHeight: 5,
  stepHeight: 5,
  rowGap: 0,
  spacing: 5,
  outerMarginIndependent: false,
  outerMargin: 5,
  holeDepth: 3,
  cornerRadius: 4,
};

export const SIMPLE_STEPPED_LIMITS = {
  trayWidth: { label: "长度", min: 0, max: MAX_TRAY_SIZE, step: 1, unit: "mm" },
  trayDepth: { label: "深度", min: 0, max: MAX_TRAY_SIZE, step: 1, unit: "mm" },
  firstRowHeight: { label: "首排高度", min: 1, max: 40, step: 0.5, unit: "mm" },
  stepHeight: { label: "阶梯步进", min: 1, max: 40, step: 0.5, unit: "mm" },
  rowGap: { label: "行间距", min: 0, max: 40, step: 1, unit: "mm" },
  spacing: { label: "凹槽间距", min: 0, max: 20, step: 1, unit: "mm" },
  outerMargin: { label: "边界间距", min: 0, max: 20, step: 1, unit: "mm" },
  holeDepth: { label: "凹槽深度", min: 0.2, max: 20, step: 0.2, unit: "mm" },
  cornerRadius: { label: "底板圆角", min: 0, max: 20, step: 1, unit: "mm" },
  diameter: { label: "凹槽直径", min: 1, max: 200, step: 0.1, unit: "mm" },
} as const;
