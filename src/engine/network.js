/**
 * Turns the editable model into the network the cars drive on: directed links with lanes,
 * signal phases and priority roads at each junction.
 */
import { KINDS, LW } from './constants.js';
import { model, roadHalfWidth, sidePerp } from './model.js';
import { computeRouting, distTo, nextLink } from './routing.js';
import { ui } from './simulation.js';
import { S } from './state.js';

export function rebuild(keepVehicles = true) {
  const oldInfo = S.net.info;
  const old = keepVehicles ? S.vehicles : [];
  const info = new Map();
  for (const n of model.nodes.values())
    info.set(n.id, { node: n, roads: [], inLinks: [], outLinks: [], setback: 0, phases: [], sig: null, stopQueue: [], occ: [], major: new Set(), pending: [], hw: 0, banSet: new Set(n.bans || []), phaseLinks: new Set() });
  for (const r of model.roads.values()) {
    if (!info.has(r.a) || !info.has(r.b)) { model.roads.delete(r.id); continue; }
    info.get(r.a).roads.push(r); info.get(r.b).roads.push(r);
  }
  for (const ni of info.values()) {
    ni.deg = ni.roads.length;
    let hw = 0; for (const r of ni.roads) hw = Math.max(hw, roadHalfWidth(r));
    ni.hw = hw;
    ni.setback = ni.deg <= 1 ? 0 : hw + (ni.deg >= 3 ? 2.5 : 0.3);
  }
  const links = [], linkById = new Map();
  for (const r of model.roads.values()) {
    const A = model.nodes.get(r.a), B = model.nodes.get(r.b);
    const dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy);
    if (L < 2) continue;
    const d = { x: dx / L, y: dy / L };
    const sbA = Math.min(info.get(r.a).setback, L * 0.4), sbB = Math.min(info.get(r.b).setback, L * 0.4);
    const twoWay = r.lanesF > 0 && r.lanesB > 0;
    const mk = (dirc, from, to, dd, n, sbFrom, sbTo) => {
      if (n <= 0) return;
      const len = L - sbFrom - sbTo;
      const perp = sidePerp(dd);
      const link = { i: links.length, id: r.id + ':' + dirc, road: r, dirc, from: from.id, to: to.id, d: dd, perp, len, n,
        speed: r.speed / 3.6, lanes: [], sx: from.x + dd.x * sbFrom, sy: from.y + dd.y * sbFrom,
        reverseId: r.id + ':' + (dirc === 'f' ? 'b' : 'f'), countIn: 0, tt: 0, ff: 0, spd: 1 };
      for (let i = 0; i < n; i++) {
        const off = twoWay ? (i + 0.5) * LW : (i + 0.5 - n / 2) * LW;
        const sx = link.sx + perp.x * off, sy = link.sy + perp.y * off;
        link.lanes.push({ link, idx: i, off, sx, sy, ex: sx + dd.x * len, ey: sy + dd.y * len, len, veh: [], lastEntered: null, reserved: 0 });
      }
      links.push(link); linkById.set(link.id, link);
      info.get(from.id).outLinks.push(link); info.get(to.id).inLinks.push(link);
    };
    mk('f', A, B, d, r.lanesF, sbA, sbB);
    mk('b', B, A, { x: -d.x, y: -d.y }, r.lanesB, sbB, sbA);
  }
  for (const l of links) {
    const sbTo = info.get(l.to).setback;
    l.ff = (l.len + 2 * sbTo) / l.speed; l.tt = l.ff;
    const oldL = S.net.linkById.get(l.id); if (oldL) { l.tt = Math.max(l.ff, oldL.tt); l.spd = oldL.spd; }
  }
  // junction phases / priority
  for (const ni of info.values()) {
    if (ni.deg >= 3) {
      // only approaches that still have somewhere to go get a signal phase
      for (const l of ni.inLinks) if (ni.outLinks.some(m => m.id !== l.reverseId && !ni.banSet.has(l.road.id + '>' + m.road.id))) ni.phaseLinks.add(l);
      const ins = [...ni.phaseLinks].sort((a, b) => Math.atan2(a.d.y, a.d.x) - Math.atan2(b.d.y, b.d.x));
      const used = new Set();
      for (const a of ins) {
        if (used.has(a)) continue; used.add(a);
        let best = null, bd = 0.7;
        for (const b of ins) { if (used.has(b)) continue; const dot = -(a.d.x * b.d.x + a.d.y * b.d.y); if (dot > bd) { bd = dot; best = b; } }
        const ph = [a]; if (best) { used.add(best); ph.push(best); }
        ni.phases.push(ph);
      }
      const o = oldInfo.get(ni.node.id);
      ni.sig = (o && o.sig && o.phases.length === ni.phases.length) ? o.sig : { phase: 0, stage: 'G', t: 0, cycle: 1 };
      if (ni.sig.phase >= ni.phases.length) ni.sig.phase = 0;
      // major roads for priority control: top two by rank
      const rank = r => (r.rank != null ? r.rank : (KINDS[r.kind] || KINDS.street).rank) * 100 + (r.lanesF + r.lanesB) * 10 + r.speed / 10;
      const sorted = ni.roads.slice().sort((a, b) => rank(b) - rank(a));
      const majors = new Set(sorted.slice(0, 2).map(r => r.id));
      for (const l of ni.inLinks) if (majors.has(l.road.id)) ni.major.add(l.id);
    }
    if (ni.deg === 1 && ni.outLinks.length) { const o = oldInfo.get(ni.node.id); if (o) ni.pending = o.pending; }
  }
  S.net = { links, linkById, info, conns: new Map(),
    sources: [...info.values()].filter(ni => ni.deg === 1 && ni.outLinks.length),
    sinks: [...info.values()].filter(ni => ni.deg === 1 && ni.inLinks.length), dist: null, ffDist: null };
  S.net.ffDist = computeRouting(false);
  S.net.dist = computeRouting(ui.smart);
  // pending trips may now be invalid
  for (const s of S.net.sources) s.pending = s.pending.filter(p => S.net.info.has(p.dest) && isFinite(distTo(S.net.ffDist, p.dest, s.outLinks[0])));
  // restore vehicles
  S.vehicles = [];
  for (const v of old) {
    if (!v.lane) continue; // vehicles inside a junction are dropped on edit
    const l = linkById.get(v.link.id);
    if (!l || !S.net.info.has(v.dest)) continue;
    const lane = l.lanes[Math.min(v.lane.idx, l.n - 1)];
    v.link = l; v.lane = lane; v.s = Math.min(v.s, l.len); v.conn = null; v.permit = null;
    v.next = l.to === v.dest ? null : nextLink(v, l);
    if (l.to !== v.dest && !v.next) continue;
    lane.veh.push(v); S.vehicles.push(v);
  }
  for (const l of links) for (const ln of l.lanes) ln.veh.sort((a, b) => b.s - a.s);
}
