type Point = { x: number; y: number };
export type CanvasView = { zoom: number; pan: Point };
export type CanvasGeometry = {
  bounds: { w: number; h: number };
  sheet: { width: number; height: number };
  fit: number;
};
type WheelInput = {
  deltaMode: number;
  deltaX: number;
  deltaY: number;
  ctrlKey: boolean;
  metaKey: boolean;
};

export function canvasOffset(view: CanvasView, { bounds, sheet, fit }: CanvasGeometry): Point {
  return {
    x: (bounds.w - sheet.width * fit * view.zoom) / 2 + 30 + view.pan.x,
    y: (bounds.h - sheet.height * fit * view.zoom) / 2 + 12 + view.pan.y,
  };
}

export function canvasPoint(view: CanvasView, geometry: CanvasGeometry, screen: Point): Point {
  const offset = canvasOffset(view, geometry), scale = geometry.fit * view.zoom;
  return { x: (screen.x - offset.x) / scale, y: (screen.y - offset.y) / scale };
}

// Keep the drawing point under the gesture stationary, even at a zoom limit.
export function zoomCanvasAt(view: CanvasView, geometry: CanvasGeometry, next: number, screen: Point): CanvasView {
  const anchor = canvasPoint(view, geometry, screen);
  const zoom = Math.max(.25, Math.min(24, next));
  const offset = canvasOffset({ zoom, pan: { x: 0, y: 0 } }, geometry);
  return { zoom, pan: {
    x: screen.x - anchor.x * geometry.fit * zoom - offset.x,
    y: screen.y - anchor.y * geometry.fit * zoom - offset.y,
  } };
}

export function wheelCanvasView(view: CanvasView, geometry: CanvasGeometry, event: WheelInput, screen: Point): CanvasView {
  const mode = event.deltaMode;
  const dx = event.deltaX * (mode === 1 ? 16 : mode === 2 ? geometry.bounds.w : 1);
  const dy = event.deltaY * (mode === 1 ? 16 : mode === 2 ? geometry.bounds.h : 1);
  // Trackpads emit ordinary wheel events for swipes and Ctrl+wheel for pinches.
  // Do not guess the input device from delta size: momentum uses small deltas too.
  if (event.ctrlKey || event.metaKey) return zoomCanvasAt(view, geometry, view.zoom * Math.exp(-dy * .005), screen);
  return { zoom: view.zoom, pan: { x: view.pan.x - dx, y: view.pan.y - dy } };
}
