/**
 * The two small line charts on the Results tab.
 */
import { T } from '../map/theme.js';
import { $, fmtClock } from './dom.js';

export const chartHover = {};
export function drawChart(id, tipId, pts, fmt, baseVal) {
  const c = $(id), r = c.getBoundingClientRect(); if (!r.width) return;
  const dpr = window.devicePixelRatio || 1; if (c.width !== Math.round(r.width * dpr)) { c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr); }
  const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, r.width, r.height);
  const pad = { l: 36, r: 6, t: 6, b: 16 }, w = r.width - pad.l - pad.r, h = r.height - pad.t - pad.b;
  let max = Math.max(1, baseVal || 0, ...pts.map(p => p[1])); const nice = Math.pow(10, Math.floor(Math.log10(max))); max = Math.ceil(max / nice) * nice;
  g.strokeStyle = T.line; g.lineWidth = 1; g.fillStyle = T.muted; g.font = '10px Overpass Mono, monospace'; g.textAlign = 'right';
  for (const f of [0, 0.5, 1]) { const y = pad.t + h - f * h; g.beginPath(); g.moveTo(pad.l, y); g.lineTo(pad.l + w, y); g.stroke(); g.fillText(pts.length < 2 ? '' : String(Math.round(max * f)), pad.l - 5, y + 3); }
  g.textAlign = 'left';
  if (pts.length < 2) { g.fillText('collecting data…', pad.l + 6, pad.t + h / 2); return; }
  const t0 = pts[0][0], t1 = pts[pts.length - 1][0];
  const X = t => pad.l + (t - t0) / Math.max(1, t1 - t0) * w, Y = v => pad.t + h - v / max * h;
  if (baseVal != null) { g.strokeStyle = T.muted; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(pad.l, Y(baseVal)); g.lineTo(pad.l + w, Y(baseVal)); g.stroke(); g.setLineDash([]); g.fillText('before', pad.l + 4, Y(baseVal) - 4); }
  g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(X(p[0]), Y(p[1])) : g.moveTo(X(p[0]), Y(p[1])));
  g.lineTo(X(t1), pad.t + h); g.lineTo(X(t0), pad.t + h); g.closePath(); g.globalAlpha = 0.12; g.fillStyle = T.accent; g.fill(); g.globalAlpha = 1;
  g.strokeStyle = T.accent; g.lineWidth = 2; g.lineJoin = 'round'; g.beginPath();
  pts.forEach((p, i) => i ? g.lineTo(X(p[0]), Y(p[1])) : g.moveTo(X(p[0]), Y(p[1]))); g.stroke();
  const last = pts[pts.length - 1]; g.fillStyle = T.accent; g.beginPath(); g.arc(X(last[0]), Y(last[1]), 3, 0, Math.PI * 2); g.fill();
  g.fillStyle = T.muted; g.fillText(fmtClock(t0), pad.l, r.height - 3); g.textAlign = 'right'; g.fillText(fmtClock(t1), pad.l + w, r.height - 3); g.textAlign = 'left';
  const hv = chartHover[id], tip = $(tipId);
  if (hv != null) {
    let bi = 0, bd = Infinity; pts.forEach((p, i) => { const d = Math.abs(X(p[0]) - hv); if (d < bd) { bd = d; bi = i; } });
    const p = pts[bi], x = X(p[0]), y = Y(p[1]);
    g.strokeStyle = T.muted; g.lineWidth = 1; g.beginPath(); g.moveTo(x, pad.t); g.lineTo(x, pad.t + h); g.stroke();
    g.fillStyle = T.accent; g.strokeStyle = T.surface; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fill(); g.stroke();
    tip.hidden = false; tip.textContent = fmtClock(p[0]) + '  ' + fmt(p[1]);
    tip.style.left = Math.min(r.width - 120, Math.max(0, x - 50)) + 'px';
  } else tip.hidden = true;
}

/** Wires this module's part of the page. Called once by startEngine(). */
export function initCharts() {
  ['chThr', 'chDelay'].forEach(id => {
    const c = $(id);
    c.addEventListener('pointermove', e => chartHover[id] = e.offsetX);
    c.addEventListener('pointerleave', () => chartHover[id] = null);
  });
}
