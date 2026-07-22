import type { SlotGroup, SteppedLayoutParams } from "@/types/custom-tray";
import { MAX_TRAY_SIZE, VIEW_PALETTE } from "@/lib/config";
import { createGroupStructureOverrides } from "@/lib/stepped-group-params";
import {
  BASE_HOLE_PARAM_DEFAULTS,
  MAGNET_POST_HOLE_LIMITS,
} from "@/lib/base-hole-config";
export { MAGNET_POST_HOLE_BOTTOM_WALL } from "@/lib/base-hole-config";

/**
 * 阶梯模式分组配色：与拆件预览（TrayViewer）共用同一调色板，
 * 保持两种视图颜色一致并排除红色（红色保留给 2D 画布的碰撞/越界警示）。
 */
export const GROUP_COLORS = VIEW_PALETTE;

const STEPPED_DEFAULT_GROUP_ID = "stepped-default-group";
const STEPPED_DEFAULT_SMOOTHING_RADIUS = 60;
const STEPPED_DEFAULT_DISCONNECT_DISTANCE = 0;
const STEPPED_DEFAULT_BOUNDARY_SPACING = 5;
const STEPPED_DEFAULT_CORNER_RADIUS = 4;

export const STEPPED_LAYOUT_DEFAULTS: SteppedLayoutParams = {
  // 现有/新建阶梯默认贴合轮廓（CONTEXT:592）
  footprintStyle: "contoured",
  trayWidth: 260,
  trayDepth: 260,
  slots: [],
  groups: [
    {
      id: STEPPED_DEFAULT_GROUP_ID,
      name: "组 1",
      color: GROUP_COLORS[0],
      bottomHeight: 10,
      ...createGroupStructureOverrides({
        smoothingRadius: STEPPED_DEFAULT_SMOOTHING_RADIUS,
        disconnectDistance: STEPPED_DEFAULT_DISCONNECT_DISTANCE,
      }),
    } satisfies SlotGroup,
  ],
  activeGroupId: STEPPED_DEFAULT_GROUP_ID,
  spacing: 5,
  boundarySpacing: STEPPED_DEFAULT_BOUNDARY_SPACING,
  boundarySpacingIndependent: false,
  traySizingMode: "auto",
  cornerRadius: STEPPED_DEFAULT_CORNER_RADIUS,
  holeDepth: 3,
  splitGrooveDepth: 2,
  enableSplitAssembly: false,
  enableSplitRecess: false,
  splitGrooveType: "profile",
  enableSplitLocators: false,
  smoothingRadius: STEPPED_DEFAULT_SMOOTHING_RADIUS,
  disconnectDistance: STEPPED_DEFAULT_DISCONNECT_DISTANCE,
  ...BASE_HOLE_PARAM_DEFAULTS,
  baseHoleStructure: "none",
};

export const STEPPED_LIMITS = {
  trayWidth: { label: "长度", min: 50, max: MAX_TRAY_SIZE, step: 1, unit: "mm" },
  trayDepth: { label: "宽度", min: 50, max: MAX_TRAY_SIZE, step: 1, unit: "mm" },
  spacing: { label: "凹槽间距", min: 0, max: 20, step: 1, unit: "mm" },
  boundarySpacing: { label: "边界间距", min: 0, max: 20, step: 1, unit: "mm" },
  cornerRadius: { label: "底板圆角", min: 0, max: 30, step: 0.5, unit: "mm" },
  holeDepth: { label: "凹槽深度", min: 0.2, max: 20, step: 0.2, unit: "mm" },
  magnetPostHoleDiameter: MAGNET_POST_HOLE_LIMITS.diameter,
  magnetPostHoleDepth: MAGNET_POST_HOLE_LIMITS.depth,
  splitGrooveDepth: { label: "装配槽深度", min: 0, max: 10, step: 0.2, unit: "mm" },
  bottomHeight: { label: "圆柱高度", min: 3, max: 100, step: 1, unit: "mm" },
  smoothingRadius: { label: "平滑半径", min: 1, max: 150, step: 1, unit: "mm" },
  disconnectDistance: {
    label: "槽群断连距离",
    min: 0,
    max: 60,
    step: 1,
    unit: "mm",
  },
} as const;
