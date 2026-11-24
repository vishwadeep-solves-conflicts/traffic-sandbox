/**
 * Shortest routes to every exit (Dijkstra on links, so U-turns and banned turns can be excluded).
 */
import { ui } from './simulation.js';
import { S } from './state.js';

export class Heap {
  constructor() { this.a = []; }
  push(k, v) { const a = this.a; a.push([k, v]); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() { const a = this.a, top = a[0], last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } } return top; }
  get size() { return this.a.length; }
}
// For each destination: cost-to-go from the start of every link (link-based so U-turns can be banned).
export function computeRouting(live) {
  const table = new Map();
  for (const sink of S.net.sinks) {
    const dist = new Float64Array(S.net.links.length).fill(Infinity);
    const h = new Heap();
    for (const l of sink.inLinks) { const c = live ? l.tt : l.ff; dist[l.i] = c; h.push(c, l); }
    while (h.size) {
      const [d, L] = h.pop(); if (d > dist[L.i]) continue;
      const via = S.net.info.get(L.from);
      for (const P of via.inLinks) {
        if (P.reverseId === L.id || via.banSet.has(P.road.id + '>' + L.road.id)) continue;
        const nd = d + (live ? P.tt : P.ff);
        if (nd < dist[P.i]) { dist[P.i] = nd; h.push(nd, P); }
      }
    }
    table.set(sink.node.id, dist);
  }
  return table;
}
export function distTo(table, dest, link) { const t = table && table.get(dest); return t ? t[link.i] : Infinity; }
export function nextLink(veh, link) {
  const ni = S.net.info.get(link.to); let best = null, bc = Infinity;
  const t = S.net.dist.get(veh.dest); if (!t) return null;
  for (const M of ni.outLinks) {
    if (M.id === link.reverseId && ni.deg > 1) continue;
    if (ni.banSet.has(link.road.id + '>' + M.road.id)) continue;
    const c = t[M.i] + (ui.smart ? M.lanes.reduce((s, ln) => s + ln.reserved, 0) * 0.5 : 0);
    if (c < bc) { bc = c; best = M; }
  }
  return isFinite(bc) ? best : null;
}
