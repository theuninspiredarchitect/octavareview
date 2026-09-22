import assert from 'node:assert/strict';
import { canvasPoint, wheelCanvasView, zoomCanvasAt } from '../lib/canvas-navigation.ts';

const geometry = { bounds: { w: 1200, h: 800 }, sheet: { width: 1600, height: 1000 }, fit: .6 };
const initial = { zoom: 2, pan: { x: 80, y: -45 } };
const pointer = { x: 430, y: 320 };
const wheel = (deltaX, deltaY, extra = {}) => ({ deltaX, deltaY, deltaMode: 0, ctrlKey: false, metaKey: false, ...extra });
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} ≠ ${expected}`);

// Diagonal swipes and their momentum must translate in screen pixels, at any zoom.
for (const zoom of [.25, 1, 8, 24]) {
  let view = { ...initial, zoom };
  for (let i = 0; i < 100; i++) view = wheelCanvasView(view, geometry, wheel(.75, -1.5), pointer);
  assert.deepEqual(view, { zoom, pan: { x: 5, y: 105 } });
  view = wheelCanvasView(view, geometry, wheel(-75, 150), pointer);
  assert.deepEqual(view, { ...initial, zoom });
}
assert.deepEqual(initial, { zoom: 2, pan: { x: 80, y: -45 } });

// Firefox line/page deltas and ordinary mouse wheels remain predictable.
assert.deepEqual(wheelCanvasView(initial, geometry, wheel(2, -3, { deltaMode: 1 }), pointer), { zoom: 2, pan: { x: 48, y: 3 } });
assert.deepEqual(wheelCanvasView(initial, geometry, wheel(1, 1, { deltaMode: 2 }), pointer), { zoom: 2, pan: { x: -1120, y: -845 } });
assert.equal(wheelCanvasView(initial, geometry, wheel(0, 100), pointer).zoom, initial.zoom);

// Pinch / modifier-wheel zoom stays anchored after a pan and at both limits.
const anchor = canvasPoint(initial, geometry, pointer);
for (const modifier of ['ctrlKey', 'metaKey']) {
  let view = initial;
  for (const dy of [-60, 40, -10000, -1, 10000, 1, -200]) {
    view = wheelCanvasView(view, geometry, wheel(15, dy, { [modifier]: true }), pointer);
    const point = canvasPoint(view, geometry, pointer);
    near(point.x, anchor.x); near(point.y, anchor.y);
    assert.ok(view.zoom >= .25 && view.zoom <= 24);
  }
}
assert.equal(zoomCanvasAt(initial, geometry, 100, pointer).zoom, 24);
assert.equal(zoomCanvasAt(initial, geometry, 0, pointer).zoom, .25);
console.log('Canvas navigation passed: free XY pan, momentum, wheel units, anchored pinch and zoom limits.');
