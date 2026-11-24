/**
 * The curved paths cars follow through a junction, from one lane to another.
 */
import { S } from './state.js';

export function getConn(from, to) {
  const key = from.link.id + '/' + from.idx + '>' + to.link.id + '/' + to.idx;
  let c = S.net.conns.get(key);
  if (c) return c;
  const d1 = from.link.d, d2 = to.link.d;
  const P0 = { x: from.ex, y: from.ey }, P3 = { x: to.sx, y: to.sy };
  const k = Math.hypot(P3.x - P0.x, P3.y - P0.y) * 0.42;
  const P1 = { x: P0.x + d1.x * k, y: P0.y + d1.y * k }, P2 = { x: P3.x - d2.x * k, y: P3.y - d2.y * k };
  const N = 16, tab = [0]; let prev = P0, len = 0;
  for (let i = 1; i <= N; i++) { const p = bez(P0, P1, P2, P3, i / N); len += Math.hypot(p.x - prev.x, p.y - prev.y); tab.push(len); prev = p; }
  const dot = d1.x * d2.x + d1.y * d2.y;
  const vmax = dot > 0.92 ? Math.min(from.link.speed, to.link.speed) : dot > -0.3 ? 7.5 : 4;
  c = { key, from, to, node: S.net.info.get(from.link.to), P0, P1, P2, P3, tab, len: Math.max(len, 0.5), veh: [], vmax };
  S.net.conns.set(key, c);
  return c;
}
export function bez(a, b, c, d, t) {
  const u = 1 - t;
  return { x: u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x,
           y: u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y };
}
export function connPoint(c, s) {
  const tab = c.tab, N = tab.length - 1; s = Math.max(0, Math.min(s, tab[N]));
  let i = 1; while (i < N && tab[i] < s) i++;
  const t = (i - 1 + (s - tab[i - 1]) / Math.max(1e-6, tab[i] - tab[i - 1])) / N;
  const p = bez(c.P0, c.P1, c.P2, c.P3, t), q = bez(c.P0, c.P1, c.P2, c.P3, Math.min(1, t + 0.02)), r = bez(c.P0, c.P1, c.P2, c.P3, Math.max(0, t - 0.02));
  return { x: p.x, y: p.y, a: Math.atan2(q.y - r.y, q.x - r.x) };
}
