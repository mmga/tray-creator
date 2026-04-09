export interface CanvasPoint {
  x: number;
  y: number;
}

export interface CanvasSelectionBox {
  start: CanvasPoint;
  current: CanvasPoint;
}

export interface CanvasSlotUpdate {
  id: string;
  x: number;
  y: number;
  rotation?: number;
}

export interface CanvasGuideLine {
  axis: "x" | "y";
  value: number;
}
