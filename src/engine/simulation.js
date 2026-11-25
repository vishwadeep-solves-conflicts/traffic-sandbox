/**
 * One simulation step (spawn, accelerate, move, hand over between lanes and junctions),
 * the rolling metrics, and the signal optimiser.
 */
import { getConn } from './connectors.js';
import { ALLRED, DT, SAT_FLOW, WINDOW, YELLOW } from './constants.js';
import { controlOf, entryPermit, updateSignals } from './control.js';
import { afterEdit } from './history.js';
import { computeRouting, distTo, nextLink } from './routing.js';
import { S } from './state.js';
import { idm, laneOptions, laneSpace, makeVehicle } from './vehicles.js';
import { toast } from '../panels/dom.js';

export const ui = { running: true, speed: 1, demand: 1, heat: false, smart: true, snap: true, tool: 'select' };
export function spawn() {
  for (const src of S.net.sources) {
    const rate = src.node.demand * ui.demand / 3600;
    if (rate > 0 && Math.random() < rate * DT && src.pending.length < 300) {
      const out = src.outLinks[0];
      const cands = S.net.sinks.filter(s => s !== src && isFinite(distTo(S.net.ffDist, s.node.id, out)));
      if (cands.length) {
        const tot = cands.reduce((a, s) => a + Math.max(1, s.node.demand), 0);
        let r = Math.random() * tot, dest = cands[0];
        for (const s of cands) { r -= Math.max(1, s.node.demand); if (r <= 0) { dest = s; break; } }
        src.pending.push({ dest: dest.node.id, t0: S.simTime, ff: distTo(S.net.ffDist, dest.node.id, out) });
      }
    }
    if (src.pending.length) {
      const out = src.outLinks[0];
      let best = null, bs = -Infinity;
      for (const ln of laneOptions(out, { dest: src.pending[0].dest })) { const sp = laneSpace(ln); if (sp > bs) { bs = sp; best = ln; } }
      if (bs > 16) {
        const trip = src.pending.shift();
        const v = makeVehicle(src, trip);
        const back = best.veh[best.veh.length - 1];
        v.link = out; v.lane = best; v.s = 0; v.v = back ? Math.min(out.speed * 0.8, back.v) : out.speed * 0.8; v.enterT = S.simTime;
        v.next = out.to === v.dest ? null : nextLink(v, out);
        best.veh.push(v); S.vehicles.push(v);
      }
    }
  }
}
export function step() {
  S.simTime += DT;
  updateSignals();
  spawn();
  // accelerations
  for (const l of S.net.links) {
    for (const ln of l.lanes) {
      const arr = ln.veh;
      for (let i = 0; i < arr.length; i++) {
        const veh = arr[i];
        let v0 = l.speed * veh.vf;
        if (i > 0) { const ld = arr[i - 1]; veh.a = idm(veh, v0, ld.s - ld.len - veh.s, ld.v); continue; }
        const distEnd = l.len - veh.s;
        veh.permit = null;
        if (!veh.next) { veh.a = idm(veh, v0, 1e9, 0); continue; }
        if (distEnd > 150) { veh.a = idm(veh, v0, 1e9, 0); continue; }
        const toLane = entryPermit(veh);
        veh.permit = toLane;
        if (!toLane) { veh.a = idm(veh, v0, distEnd - 0.5, 0); continue; }
        const conn = getConn(ln, toLane);
        v0 = Math.min(v0, Math.sqrt(conn.vmax * conn.vmax + 2 * 1.4 * Math.max(0, distEnd)));
        let gap = 1e9, vl = 0;
        const le = ln.lastEntered;
        if (le && le.conn && le.conn.from === ln) { gap = distEnd + le.s - le.len; vl = le.v; }
        else { const back = toLane.veh[toLane.veh.length - 1]; if (back) { gap = distEnd + conn.len + back.s - back.len; vl = back.v; } }
        veh.a = idm(veh, v0, gap, vl);
      }
    }
  }
  for (const c of S.net.conns.values()) {
    const arr = c.veh;
    for (let i = 0; i < arr.length; i++) {
      const veh = arr[i], v0 = c.vmax * veh.vf;
      if (i > 0) { const ld = arr[i - 1]; veh.a = idm(veh, v0, ld.s - ld.len - veh.s, ld.v); continue; }
      const back = c.to.veh[c.to.veh.length - 1];
      veh.a = back ? idm(veh, v0, c.len - veh.s + back.s - back.len, back.v) : idm(veh, v0, 1e9, 0);
    }
  }
  // integrate
  for (const veh of S.vehicles) {
    const nv = veh.v + veh.a * DT;
    if (nv < 0) { veh.s += veh.a < 0 ? -veh.v * veh.v / (2 * veh.a) : 0; veh.v = 0; }
    else { veh.s += veh.v * DT + 0.5 * veh.a * DT * DT; veh.v = nv; }
  }
  // transitions: lane -> junction / exit
  const gone = new Set();
  for (const l of S.net.links) {
    const ni = S.net.info.get(l.to);
    for (const ln of l.lanes) {
      while (ln.veh.length && ln.veh[0].s >= ln.len) {
        const veh = ln.veh[0];
        if (!veh.next) {
          if (l.to === veh.dest) {
            ln.veh.shift(); gone.add(veh); S.completed++;
            const tt = S.simTime - veh.t0; S.trips.push({ t: S.simTime, tt, delay: Math.max(0, tt - veh.ff) });
          } else { ln.veh.shift(); gone.add(veh); S.lost++; }
          continue;
        }
        const toLane = veh.permit;
        if (!toLane || !S.net.linkById.has(toLane.link.id)) { veh.s = ln.len; veh.v = 0; break; }
        ln.veh.shift();
        const obs = S.simTime - veh.enterT; l.tt = 0.85 * l.tt + 0.15 * Math.max(l.ff, obs);
        l.countIn++;
        const conn = getConn(ln, toLane);
        ln.lastEntered = veh; toLane.reserved++;
        veh.s -= ln.len; veh.lane = null; veh.conn = conn; conn.veh.push(veh); ni.occ.push(veh);
        const qi = ni.stopQueue.indexOf(veh); if (qi >= 0) ni.stopQueue.splice(qi, 1);
      }
    }
  }
  // transitions: junction -> next link
  for (const c of S.net.conns.values()) {
    while (c.veh.length && c.veh[0].s >= c.len) {
      const veh = c.veh.shift(); const to = c.to, L = to.link;
      to.reserved = Math.max(0, to.reserved - 1);
      const oi = c.node.occ.indexOf(veh); if (oi >= 0) c.node.occ.splice(oi, 1);
      veh.conn = null; veh.lane = to; veh.link = L; veh.s -= c.len; veh.enterT = S.simTime;
      const back = to.veh[to.veh.length - 1];
      if (back && veh.s > back.s - back.len - 0.5) veh.s = Math.max(0, back.s - back.len - 0.5);
      to.veh.push(veh);
      veh.next = L.to === veh.dest ? null : nextLink(veh, L);
      if (!veh.next && L.to !== veh.dest) { to.veh.pop(); gone.add(veh); S.lost++; }
    }
  }
  if (gone.size) S.vehicles = S.vehicles.filter(v => !gone.has(v));
  // link speed EMA for heatmap, every second
  if (S.simTime - S.lastSpd >= 1) {
    S.lastSpd = S.simTime;
    for (const l of S.net.links) {
      // congestion = share of the road taken up by stopped or crawling cars
      let n = 0, stopLen = 0;
      for (const ln of l.lanes) for (const v of ln.veh) { n++; if (v.v < 2) stopLen += v.len + 2; }
      const r = Math.max(0, 1 - 1.6 * stopLen / Math.max(1, l.len * l.n));
      l.spd = 0.8 * l.spd + 0.2 * r;
      if (!n) l.tt = 0.97 * l.tt + 0.03 * l.ff; // empty links recover
    }
  }
  if (ui.smart && S.simTime - S.lastRoute > 15) { S.lastRoute = S.simTime; S.net.dist = computeRouting(true); }
  if (S.simTime - S.lastSample >= 10) { S.lastSample = S.simTime; S.history.push({ t: S.simTime, ...currentMetrics() }); if (S.history.length > 400) S.history.shift(); }
}
export function currentMetrics() {
  const from = Math.max(S.metricsStart, S.simTime - WINDOW);
  while (S.trips.length && S.trips[0].t < S.simTime - WINDOW - 5) S.trips.shift();
  const rec = S.trips.filter(t => t.t >= from);
  const span = Math.max(1, S.simTime - from);
  const thr = rec.length / span * 3600;
  const delay = rec.length ? rec.reduce((a, t) => a + t.delay, 0) / rec.length : 0;
  const trip = rec.length ? rec.reduce((a, t) => a + t.tt, 0) / rec.length : 0;
  let sv = 0; for (const v of S.vehicles) sv += v.v;
  const speed = S.vehicles.length ? sv / S.vehicles.length * 3.6 : 0;
  let wait = 0; for (const s of S.net.sources) wait += s.pending.length;
  return { thr, delay, trip, speed, veh: S.vehicles.length, wait, n: rec.length, span: S.simTime - S.metricsStart };
}
export function resetMetrics() {
  S.trips = []; S.metricsStart = S.simTime; S.history = []; S.lastSample = S.simTime;
  for (const l of S.net.links) l.countIn = 0;
}
export function optimizeSignals() {
  const T = S.simTime - S.metricsStart;
  if (T < 120) { toast('Let the simulation run at least 2 minutes after the last change, then optimize.'); return; }
  let n = 0; const notes = [];
  for (const ni of S.net.info.values()) {
    const ctl = controlOf(ni);
    if ((ctl !== 'signal' && ctl !== 'adaptive') || ni.phases.length < 2) continue;
    const P = ni.phases.length, lostT = P * (YELLOW + ALLRED + 2);
    const ys = ni.phases.map(ph => Math.max(0.02, ...ph.map(l => (l.countIn / T * 3600) / (SAT_FLOW * l.n))));
    let Y = ys.reduce((a, b) => a + b, 0); const Yc = Math.min(Y, 0.9);
    const C = Math.max(60, Math.min(150, (1.5 * lostT + 5) / (1 - Yc)));
    ni.node.phaseGreens = ys.map(y => Math.max(7, Math.round((C - lostT) * y / Y)));
    n++; if (n <= 3) notes.push('#' + ni.node.id + ': ' + ni.node.phaseGreens.join('/') + ' s');
  }
  if (!n) { toast('No signalized junctions to optimize.'); return; }
  afterEdit(false);
  toast('Retimed ' + n + ' signal' + (n > 1 ? 's' : '') + ' with Webster\'s method (' + notes.join(', ') + (n > 3 ? ', …' : '') + '). Metrics reset; run a few minutes to compare.');
}
// queue length (stopped cars near the end) on an approach
export function queueOn(l) {
  let q = 0;
  for (const ln of l.lanes) for (const v of ln.veh) if (v.v < 1.5 && l.len - v.s < 250) q++;
  return q;
}
