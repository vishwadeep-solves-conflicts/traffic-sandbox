/**
 * Draws the map every frame: roads, junctions, cars, signals, queues and labels.
 */
import { connPoint } from '../engine/connectors.js';
import { LW } from '../engine/constants.js';
import { greenFor, signalState } from '../engine/control.js';
import { model, roadHalfWidth } from '../engine/model.js';
import { queueOn, ui } from '../engine/simulation.js';
import { S } from '../engine/state.js';
import { mouseS, mouseW, newRoadSpec, nodeAt, snapW } from './input.js';
import { T } from './theme.js';
import { DPR, H, W, cam, ctx, s2w, w2s } from './view.js';

export function hexToRgb(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
export function lerpColor(r) { // 0 = jammed, 1 = free
  r = Math.max(0, Math.min(1, r));
  const a = hexToRgb(T.critical || '#c42b2b'), b = hexToRgb(T.warn || '#c98a0b'), c = hexToRgb(T.good || '#1f8a52');
  const [c0, c1, f] = r < 0.5 ? [a, b, r / 0.5] : [b, c, (r - 0.5) / 0.5];
  return 'rgb(' + c0.map((v, k) => Math.round(v + (c1[k] - v) * f)).join(',') + ')';
}
export const isElevLink = l => !!l.road.elevated;
export function vehElevated(v) {
  if (v.lane) return isElevLink(v.lane.link);
  if (v.conn) return isElevLink(v.conn.from.link) && isElevLink(v.conn.to.link);
  return false;
}
export function roadFill(r, elev) { if (elev) return T.bridge; return r.kind === 'highway' ? T['road-hwy'] : r.kind === 'service' ? T['road-service'] : T.road; }
export function roadEdge(r, elev) { if (elev) return T['bridge-edge']; return r.kind === 'highway' ? T['hwy-edge'] : T['road-edge']; }
export function strokeSeg(A, B, color, width) { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke(); }
export function vehPose(v) {
  if (v.lane) { const ln = v.lane, d = ln.link.d; const s = v.s - v.len / 2; return { x: ln.sx + d.x * s, y: ln.sy + d.y * s, a: Math.atan2(d.y, d.x) }; }
  if (v.conn) return connPoint(v.conn, v.s - v.len / 2);
  return null;
}
export function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
export function drawVehicle(v, px) {
  const p = vehPose(v); if (!p) return;
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a);
  const zoomedOut = cam.z < 0.9;
  const L = Math.max(v.len, (zoomedOut ? 4 : 3) * px), Wd = Math.max(v.w, (zoomedOut ? 2.6 : 1.6) * px);
  const stopped = v.v < 1;
  if (zoomedOut) {
    ctx.fillStyle = stopped ? T['sig-red'] : v.color; ctx.fillRect(-L / 2, -Wd / 2, L, Wd);
  } else {
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; roundRect(-L / 2 + 0.25, -Wd / 2 + 0.35, L, Wd, 0.7); ctx.fill();
    ctx.fillStyle = v.color; roundRect(-L / 2, -Wd / 2, L, Wd, 0.7); ctx.fill();
    ctx.fillStyle = 'rgba(25,35,45,0.55)';
    if (v.len > 6) ctx.fillRect(L / 2 - 2.2, -Wd / 2 + 0.25, 1.6, Wd - 0.5);         // truck cab window
    else { ctx.fillRect(L / 2 - 1.75, -Wd / 2 + 0.25, 0.85, Wd - 0.5); ctx.fillRect(-L / 2 + 0.55, -Wd / 2 + 0.3, 0.6, Wd - 0.6); }
    ctx.fillStyle = stopped ? T['sig-red'] : 'rgba(120,20,20,0.55)';
    ctx.fillRect(-L / 2 - 0.05, -Wd / 2 + 0.15, stopped ? 0.45 : 0.25, 0.5); ctx.fillRect(-L / 2 - 0.05, Wd / 2 - 0.65, stopped ? 0.45 : 0.25, 0.5);
    if (stopped && cam.z > 1.6) { ctx.fillStyle = 'rgba(224,48,47,0.25)'; ctx.beginPath(); ctx.arc(-L / 2 - 0.4, 0, Wd * 0.75, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.restore();
}
export function drawLayer(elev, px) {
  const roads = [...model.roads.values()].filter(r => !!r.elevated === elev);
  const nodes = [...S.net.info.values()].filter(ni => ni.deg >= 2 && !!ni.node.elevated === elev);
  const discR = ni => Math.max(ni.deg >= 3 ? ni.setback : ni.hw + 0.4, 1.5 * px);
  if (elev) {
    for (const r of roads) { const A = model.nodes.get(r.a), B = model.nodes.get(r.b); strokeSeg({ x: A.x + 2.5, y: A.y + 4 }, { x: B.x + 2.5, y: B.y + 4 }, T.shadow, roadHalfWidth(r) * 2 + 3); }
    // pillars
    if (cam.z > 0.5) for (const r of roads) {
      const A = model.nodes.get(r.a), B = model.nodes.get(r.b), L = Math.hypot(B.x - A.x, B.y - A.y);
      ctx.fillStyle = T['bridge-edge'];
      for (let s = 20; s < L - 10; s += 30) { const t = s / L; ctx.beginPath(); ctx.arc(A.x + (B.x - A.x) * t + 1.5, A.y + (B.y - A.y) * t + 2.5, 1.4, 0, Math.PI * 2); ctx.fill(); }
    }
  }
  // curbs, then surfaces (so junctions merge cleanly)
  for (const r of roads) { const A = model.nodes.get(r.a), B = model.nodes.get(r.b); strokeSeg(A, B, roadEdge(r, elev), Math.max(roadHalfWidth(r) * 2 + (elev ? 1.8 : 1.4), 3 * px)); }
  for (const ni of nodes) { ctx.fillStyle = elev ? T['bridge-edge'] : T['road-edge']; ctx.beginPath(); ctx.arc(ni.node.x, ni.node.y, discR(ni) + 0.7, 0, Math.PI * 2); ctx.fill(); }
  for (const r of roads) {
    const A = model.nodes.get(r.a), B = model.nodes.get(r.b);
    const sel = S.selection && S.selection.type === 'road' && S.selection.id === r.id, hov = S.hover && S.hover.type === 'road' && S.hover.id === r.id;
    strokeSeg(A, B, roadFill(r, elev), Math.max(roadHalfWidth(r) * 2, 2 * px));
    if (sel || hov) { ctx.globalAlpha = sel ? 0.9 : 0.45; strokeSeg(A, B, T.sel, Math.max(1.2, 2.5 * px)); ctx.globalAlpha = 1; }
  }
  for (const ni of nodes) { ctx.fillStyle = elev ? T.bridge : T.road; ctx.beginPath(); ctx.arc(ni.node.x, ni.node.y, discR(ni), 0, Math.PI * 2); ctx.fill(); }
  const links = S.net.links.filter(l => isElevLink(l) === elev);
  // congestion tint: only where traffic is actually slow, so problems stand out
  if (ui.heat) {
    for (const l of links) {
      if (l.spd > 0.85) continue;
      ctx.globalAlpha = Math.min(0.75, 0.25 + (0.85 - l.spd) * 0.8);
      ctx.strokeStyle = lerpColor(l.spd); ctx.lineWidth = Math.max(l.n * LW - 0.6, 2.5 * px);
      const off = (l.lanes[0].off + l.lanes[l.n - 1].off) / 2;
      const sx = l.sx + l.perp.x * off, sy = l.sy + l.perp.y * off;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + l.d.x * l.len, sy + l.d.y * l.len); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  if (cam.z > 0.45) {
    for (const l of links) {
      const r = l.road; const twoWay = r.lanesF > 0 && r.lanesB > 0;
      if (twoWay && l.dirc === 'f') {
        const svc = r.kind === 'service';
        ctx.strokeStyle = svc ? T.mark : T.center; ctx.lineWidth = svc ? 0.2 : 0.3; ctx.setLineDash(svc ? [2, 4] : []);
        ctx.beginPath(); ctx.moveTo(l.sx, l.sy); ctx.lineTo(l.sx + l.d.x * l.len, l.sy + l.d.y * l.len); ctx.stroke();
      }
      ctx.strokeStyle = T.mark; ctx.lineWidth = 0.2; ctx.setLineDash([3, 6]);
      for (let i = 1; i < l.n; i++) {
        const off = l.lanes[i].off - LW / 2;
        const sx = l.sx + l.perp.x * off, sy = l.sy + l.perp.y * off;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + l.d.x * l.len, sy + l.d.y * l.len); ctx.stroke();
      }
      ctx.setLineDash([]);
    }
  }
  // stop lines
  for (const ni of S.net.info.values()) {
    if (ni.deg < 3) continue;
    const ctl = ni.node.control;
    for (const l of ni.inLinks) {
      if (isElevLink(l) !== elev) continue;
      let col = null, dash = null;
      if (!ni.phaseLinks.has(l)) { col = T.muted; dash = [0.6, 0.6]; }
      else if (ctl === 'signal' || ctl === 'adaptive') { const st = signalState(ni, l); col = st === 'G' ? T['sig-green'] : st === 'Y' ? T['sig-amber'] : T['sig-red']; }
      else if (ctl === 'stop') col = T.ink;
      else if (ctl === 'priority' && !ni.major.has(l.id)) { col = T.ink; dash = [0.8, 0.8]; }
      if (!col) continue;
      const ex = l.sx + l.d.x * l.len, ey = l.sy + l.d.y * l.len;
      const o0 = l.lanes[0].off - LW / 2, o1 = l.lanes[l.n - 1].off + LW / 2;
      ctx.strokeStyle = col; ctx.lineWidth = Math.max(0.5, 2 * px); if (dash) ctx.setLineDash(dash);
      ctx.beginPath(); ctx.moveTo(ex + l.perp.x * o0, ey + l.perp.y * o0); ctx.lineTo(ex + l.perp.x * o1, ey + l.perp.y * o1); ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  for (const v of S.vehicles) if (vehElevated(v) === elev) drawVehicle(v, px);
}
export function pill(x, y, text, bg, fg, opts = {}) {
  ctx.font = (opts.bold ? '700 ' : '600 ') + (opts.size || 11) + 'px ' + 'Overpass, system-ui, sans-serif';
  const w = ctx.measureText(text).width + 12, h = (opts.size || 11) + 8;
  ctx.fillStyle = bg; roundRect(x - w / 2, y - h / 2, w, h, h / 2); ctx.fill();
  if (opts.border) { ctx.strokeStyle = opts.border; ctx.lineWidth = 1; ctx.stroke(); }
  ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y + 1);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}
export function signalHead(sx, sy, state, secs) {
  // small three-lamp head drawn in screen space
  const w = 10, h = 26;
  ctx.fillStyle = T['sig-body']; roundRect(sx - w / 2, sy - h / 2, w, h, 3); ctx.fill();
  const lamps = [['R', T['sig-red']], ['Y', T['sig-amber']], ['G', T['sig-green']]];
  lamps.forEach(([k, c], i) => { ctx.fillStyle = state === k ? c : 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.arc(sx, sy - 8 + i * 8, 2.8, 0, Math.PI * 2); ctx.fill(); });
  if (secs != null && cam.z > 1.1) { ctx.font = '700 10px Overpass Mono, monospace'; ctx.fillStyle = T.ink; ctx.textAlign = 'center'; ctx.fillText(String(secs), sx, sy + h / 2 + 10); ctx.textAlign = 'left'; }
}
export function drawOverlays() {
  // signal heads beside each signalised approach
  if (cam.z > 0.55) for (const ni of S.net.info.values()) {
    if (ni.deg < 3 || ni.node.elevated) continue;
    const ctl = ni.node.control; if (ctl !== 'signal' && ctl !== 'adaptive') continue;
    for (const l of ni.inLinks) {
      if (!ni.phaseLinks.has(l)) continue;
      const st = signalState(ni, l);
      const off = l.lanes[l.n - 1].off + LW / 2 + 2.2;   // curb side
      const wx = l.sx + l.d.x * (l.len - 1.5) + l.perp.x * off, wy = l.sy + l.d.y * (l.len - 1.5) + l.perp.y * off;
      const [sx, sy] = w2s(wx, wy);
      let secs = null; const s = ni.sig;
      if (st === 'G' && ctl === 'signal') secs = Math.max(0, Math.ceil(greenFor(ni, s.phase) - s.t));
      signalHead(sx, sy, st, secs);
    }
  }
  // queue bubbles
  if (cam.z > 0.18) for (const ni of S.net.info.values()) {
    if (ni.deg < 2) continue;
    for (const l of ni.inLinks) {
      const q = queueOn(l); if (q < 4) continue;
      const back = Math.min(l.len - 4, (q / l.n) * 6.5 + 8);
      const off = (l.lanes[0].off + l.lanes[l.n - 1].off) / 2;
      const wx = l.sx + l.d.x * (l.len - back) + l.perp.x * off, wy = l.sy + l.d.y * (l.len - back) + l.perp.y * off;
      const [sx, sy] = w2s(wx, wy);
      const sev = q >= 20 ? T.critical : q >= 9 ? T.serious : T.warn;
      pill(sx, sy - 14, q + ' waiting', sev, '#fff', { bold: true });
    }
  }
  // entry / exit points
  for (const ni of S.net.info.values()) {
    if (ni.deg !== 1) continue;
    const [sx, sy] = w2s(ni.node.x, ni.node.y);
    ctx.fillStyle = T.accent; ctx.beginPath(); ctx.arc(sx, sy, 6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = T.surface; ctx.lineWidth = 2; ctx.stroke();
    if (cam.z > 0.15 && ni.outLinks.length) {
      const d = ni.outLinks[0].d; const lx = sx - d.x * 22, ly = sy - d.y * 22;
      const waiting = ni.pending.length;
      pill(lx, ly, Math.round(ni.node.demand * ui.demand) + ' cars/h' + (waiting > 5 ? '  +' + waiting + ' stuck' : ''), waiting > 5 ? T.critical : T.surface, waiting > 5 ? '#fff' : T['ink-2'], { border: waiting > 5 ? null : T.line });
    }
  }
}
export function draw() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = T.paper; ctx.fillRect(0, 0, W, H);
  const step = cam.z > 1.5 ? 10 : cam.z > 0.4 ? 50 : 250;
  const [gx0, gy0] = s2w(0, 0), [gx1, gy1] = s2w(W, H);
  ctx.strokeStyle = T['paper-grid']; ctx.lineWidth = 1; ctx.beginPath();
  for (let x = Math.floor(gx0 / step) * step; x < gx1; x += step) { const [sx] = w2s(x, 0); ctx.moveTo(sx, 0); ctx.lineTo(sx, H); }
  for (let y = Math.floor(gy0 / step) * step; y < gy1; y += step) { const [, sy] = w2s(0, y); ctx.moveTo(0, sy); ctx.lineTo(W, sy); }
  ctx.stroke();

  ctx.save();
  ctx.translate(W / 2, H / 2); ctx.scale(cam.z, cam.z); ctx.translate(-cam.x, -cam.y);
  const px = 1 / cam.z;
  ctx.lineCap = 'butt';
  drawLayer(false, px);
  drawLayer(true, px);
  for (const ni of S.net.info.values()) {
    const n = ni.node;
    const sel = S.selection && S.selection.type === 'node' && S.selection.id === n.id, hov = S.hover && S.hover.type === 'node' && S.hover.id === n.id;
    if (sel || hov || ((ui.tool === 'road' || ui.tool === 'bridge') && ni.deg >= 2 && !n.elevated)) {
      ctx.strokeStyle = sel ? T.sel : hov ? T.sel : T.muted; ctx.globalAlpha = sel ? 1 : hov ? 0.6 : 0.35; ctx.lineWidth = 2.5 * px;
      ctx.setLineDash(sel ? [] : [4 * px, 3 * px]);
      ctx.beginPath(); ctx.arc(n.x, n.y, Math.max(ni.setback, 7 * px) + 3 * px, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha = 1;
    }
  }
  let preview = null;
  if ((ui.tool === 'road' || ui.tool === 'bridge') && S.drawFrom != null && model.nodes.get(S.drawFrom)) {
    const A = model.nodes.get(S.drawFrom); const hn = nodeAt(mouseS[0], mouseS[1]);
    const [tx, ty] = hn ? [hn.x, hn.y] : snapW(mouseW[0], mouseW[1]);
    const [lf, lb] = newRoadSpec();
    ctx.globalAlpha = 0.55; strokeSeg(A, { x: tx, y: ty }, T.sel, Math.max((lf + lb) * LW, 3 * px)); ctx.globalAlpha = 1;
    preview = { tx, ty, len: Math.hypot(tx - A.x, ty - A.y) };
  }
  ctx.restore();
  drawOverlays();
  if (preview) { const [sx, sy] = w2s(preview.tx, preview.ty); pill(sx + 30, sy - 16, Math.round(preview.len) + ' m', T.ink, T.surface, { bold: true }); }
  // scale bar
  const target = 100 / cam.z, nice = [5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000].find(v => v >= target) || 5000;
  const bw = nice * cam.z;
  ctx.strokeStyle = T['ink-2']; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(W - 20 - bw, H - 20); ctx.lineTo(W - 20, H - 20); ctx.moveTo(W - 20 - bw, H - 25); ctx.lineTo(W - 20 - bw, H - 15); ctx.moveTo(W - 20, H - 25); ctx.lineTo(W - 20, H - 15); ctx.stroke();
  ctx.fillStyle = T['ink-2']; ctx.font = '600 11px Overpass, system-ui'; ctx.textAlign = 'right'; ctx.fillText(nice + ' m', W - 20, H - 28); ctx.textAlign = 'left';
}
