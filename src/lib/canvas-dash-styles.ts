export const CANVAS_DASH_STYLES = {
  boundary: {
    strokeWidth: 0.5,
    dash: [3, 3],
    strokeOpacity: 0.88,
  },
  guide: {
    strokeWidth: 0.3,
    dash: [2, 2],
    strokeOpacity: 0.8,
  },
  alert: {
    strokeWidth: 0.5,
    dash: [3, 2],
    strokeOpacity: 0.8,
  },
} as const;

export type CanvasDashStyle = keyof typeof CANVAS_DASH_STYLES;

/** 将画布坐标换算为固定的屏幕视觉线宽与虚线密度。 */
export function getCanvasDashAttributes(style: CanvasDashStyle, zoom: number) {
  const config = CANVAS_DASH_STYLES[style];

  return {
    strokeWidth: config.strokeWidth / zoom,
    strokeDasharray: config.dash.map((value) => value / zoom).join(" "),
    strokeOpacity: config.strokeOpacity,
  };
}
