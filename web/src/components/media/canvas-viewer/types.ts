import type {
  MouseEvent as ReactMouseEvent,
  TouchEvent as ReactTouchEvent,
} from "react";

export interface Point {
  x: number;
  y: number;
}

export interface ZoomLimits {
  min: number;
  max: number;
}

export type TapEvent = ReactMouseEvent | ReactTouchEvent;

export interface CanvasViewerProps {
  onClose: () => void;
}
