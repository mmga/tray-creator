import type { SimpleSteppedLayoutParams } from "@/types/custom-tray";
import { BASE_HOLE_PARAM_DEFAULTS } from "@/lib/base-hole-config";

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
  ...BASE_HOLE_PARAM_DEFAULTS,
  baseHoleStructure: "none",
};
