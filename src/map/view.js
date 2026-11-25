/**
 * The map canvas, the camera (pan and zoom) and screen/world coordinate conversion.
 */
import { model } from '../engine/model.js';
import { S } from '../engine/state.js';

export let cv = null, ctx = null;
export let W = 0, H = 0, DPR = 1;
export const cam = { x: 0, y: 0, z: 1.2 };
export function resize() {
  const r = cv.getBoundingClientRect(); DPR = window.devicePixelRatio || 1;
  W = r.width; H = r.height; cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
}
export const w2s = (x, y) => [(x - cam.x) * cam.z + W / 2, (y - cam.y) * cam.z + H / 2];
export const s2w = (x, y) => [(x - W / 2) / cam.z + cam.x, (y - H / 2) / cam.z + cam.y];
export function fitView() {
  if (!model.nodes.size) { cam.x = 0; cam.y = 0; cam.z = 1.2; return; }
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const n of model.nodes.values()) { x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y); x1 = Math.max(x1, n.x); y1 = Math.max(y1, n.y); }
  const padL = W > 600 ? 110 : 30, padT = W > 600 ? 70 : 90;
  cam.z = Math.max(0.05, Math.min(4, Math.min((W - padL - 60) / Math.max(50, x1 - x0), (H - padT - 50) / Math.max(50, y1 - y0))));
  cam.x = (x0 + x1) / 2 - (padL - 30) / 2 / cam.z; cam.y = (y0 + y1) / 2 - (padT - 50) / 2 / cam.z;
}
// arrow keys pan the map smoothly while held
export const arrowKeys = new Set();
export function panByKeys(dt) {
  if (!arrowKeys.size) return;
  const v = (S.arrowFast ? 1500 : 600) * dt / cam.z;
  if (arrowKeys.has('ArrowLeft')) cam.x -= v; if (arrowKeys.has('ArrowRight')) cam.x += v;
  if (arrowKeys.has('ArrowUp')) cam.y -= v; if (arrowKeys.has('ArrowDown')) cam.y += v;
}
export function zoomBy(f) { cam.z = Math.max(0.03, Math.min(12, cam.z * f)); }

/** Wires this module's part of the page. Called once by startEngine(). */
export function initView() {
  cv = document.getElementById('cv');
  ctx = cv.getContext('2d');
  window.addEventListener('resize', resize);
}
