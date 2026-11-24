/**
 * Junction control: fixed and smart signals, all-way stops and give-way rules.
 */
import { ALLRED, DT, YELLOW } from './constants.js';
import { S } from './state.js';
import { pickOutLane } from './vehicles.js';

export function controlOf(ni) { return ni.deg >= 3 ? ni.node.control : 'none'; }
export function greenFor(ni, p) { const g = ni.node.phaseGreens; return (g && g.length === ni.phases.length) ? g[p] : ni.node.green; }
export function signalState(ni, link) {
  if (ni.phases.length < 2) return 'G';
  const s = ni.sig; if (!ni.phases[s.phase].includes(link)) return 'R';
  return s.stage === 'G' ? 'G' : s.stage === 'Y' ? 'Y' : 'R';
}
export function phaseHasDemand(ni, p, range) {
  for (const l of ni.phases[p]) for (const ln of l.lanes) { const f = ln.veh[0]; if (f && f.next && l.len - f.s < range) return true; }
  return false;
}
export function updateSignals() {
  for (const ni of S.net.info.values()) {
    const ctl = controlOf(ni);
    if ((ctl !== 'signal' && ctl !== 'adaptive') || ni.phases.length < 2) continue;
    const s = ni.sig, P = ni.phases.length; s.t += DT;
    if (s.stage === 'G') {
      const g = greenFor(ni, s.phase);
      let end = s.t >= g;
      if (ctl === 'adaptive') {
        let other = false; for (let p = 0; p < P; p++) if (p !== s.phase && phaseHasDemand(ni, p, 60)) other = true;
        const here = phaseHasDemand(ni, s.phase, 35);
        if (!other) end = false;                       // rest in green
        else if (s.t >= 6 && !here) end = true;        // gap-out
        else end = s.t >= g;                           // max-out
      }
      if (end) { s.stage = 'Y'; s.t = 0; s.cycle++; }
    } else if (s.stage === 'Y') {
      if (s.t >= YELLOW) { s.stage = 'AR'; s.t = 0; }
    } else if (s.t >= ALLRED) {
      let nxt = (s.phase + 1) % P;
      if (ctl === 'adaptive') for (let k = 1; k <= P; k++) { const p = (s.phase + k) % P; if (phaseHasDemand(ni, p, 60)) { nxt = p; break; } }
      s.phase = nxt; s.stage = 'G'; s.t = 0;
    }
  }
}
export function segCross(a, b, c, d) {
  const o = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
}
// A minor-road vehicle yields only to major-road traffic whose path merges with or crosses its own.
export function gapForMinor(ni, link, veh, toLane) {
  const a0 = { x: veh.lane.ex, y: veh.lane.ey }, a1 = { x: toLane.sx, y: toLane.sy };
  // 0 = no conflict, 1 = merge into the same lane (short gap accepted), 2 = paths cross
  const conflicts = (fromLane, nextLink, toL) => {
    if (nextLink === toLane.link) return (!toL || toL === toLane || nextLink.n === 1) ? 1 : 0;
    const b1 = toL || nextLink.lanes[0];
    return segCross(a0, a1, { x: fromLane.ex, y: fromLane.ey }, { x: b1.sx, y: b1.sy }) ? 2 : 0;
  };
  for (const o of ni.occ) if (o.conn && ni.major.has(o.conn.from.link.id) && conflicts(o.conn.from, o.conn.to.link, o.conn.to) === 2) return false;
  for (const M of ni.inLinks) {
    if (M === link || !ni.major.has(M.id)) continue;
    for (const ln of M.lanes) {
      const f = ln.veh[0]; if (!f || !f.next) continue;
      const d = M.len - f.s;
      if (d > 70) continue;
      const c = conflicts(ln, f.next, f.permit);
      if (c && d / Math.max(f.v, 0.5) < (c === 1 ? 2.5 : 4.5)) return false;
    }
  }
  return true;
}
// Returns the lane to enter on the next link, or null if the vehicle must wait at the stop line.
export function entryPermit(veh) {
  const link = veh.link, ni = S.net.info.get(link.to);
  const toLane = pickOutLane(veh.next, veh);
  veh.noSpace = !toLane;
  const ctl = controlOf(ni), dist = link.len - veh.s;
  if (ctl === 'stop') {
    if (!ni.stopQueue.includes(veh)) { if (dist < 4.5 && veh.v < 0.6) ni.stopQueue.push(veh); return null; }
    if (!toLane) return null;
    for (const q of ni.stopQueue) { if (q === veh) break; if (!q.noSpace) return null; }
    if (ni.occ.some(o => o.conn && o.conn.from.link !== link)) return null;
    return toLane;
  }
  if (!toLane) return null;
  if (ctl === 'signal' || ctl === 'adaptive') {
    const st = signalState(ni, link);
    if (st === 'G') return toLane;
    if (st === 'Y') {
      if (veh.yCycle !== ni.sig.cycle) { veh.yCycle = ni.sig.cycle; veh.yGo = dist < veh.v * veh.v / (2 * 3.2) + 1; }
      return veh.yGo ? toLane : null;
    }
    return null;
  }
  if (ctl === 'priority' && !ni.major.has(link.id)) return gapForMinor(ni, link, veh, toLane) ? toLane : null;
  return toLane;
}
