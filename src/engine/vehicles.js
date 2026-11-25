/**
 * Cars and trucks: creation, the Intelligent Driver Model, and lane choice.
 */
import { PALETTE } from './constants.js';
import { model } from './model.js';
import { nextLink } from './routing.js';
import { S } from './state.js';

export function makeVehicle(src, trip) {
  const truck = Math.random() < 0.07;
  return { id: S.vid++, len: truck ? 11 : 4.5, w: truck ? 2.5 : 1.9, amax: truck ? 0.9 : 1.6, b: truck ? 2.0 : 2.6, T: truck ? 1.6 : 1.25, s0: 2,
    vf: 0.9 + Math.random() * 0.2, color: truck ? '#e0a526' : PALETTE[(Math.random() * PALETTE.length) | 0],
    dest: trip.dest, t0: trip.t0, ff: trip.ff, src: src.node.id, lane: null, link: null, s: 0, v: 0, a: 0, conn: null, next: null,
    enterT: S.simTime, permit: null, yCycle: -1, yGo: false, noSpace: false };
}
export function idm(veh, v0, gap, vl) {
  const v = veh.v;
  let a = veh.amax * (1 - Math.pow(v / Math.max(v0, 0.1), 4));
  if (gap < 1e8) {
    const ss = veh.s0 + Math.max(0, v * veh.T + v * (v - vl) / (2 * Math.sqrt(veh.amax * veh.b)));
    const g = Math.max(gap, 0.05);
    a -= veh.amax * (ss / g) * (ss / g);
  }
  return Math.max(a, -9);
}
export function laneSpace(ln) {
  const back = ln.veh[ln.veh.length - 1];
  return (back ? back.s - back.len : ln.len) - ln.reserved * 7;
}
// Which lanes of `link` suit the vehicle's next turn: the near-side-most exit uses the curb lane,
// the far-side-most exit uses the inside lane, anything else may use any lane.
export function laneOptions(link, veh) {
  if (link.n < 2 || link.to === veh.dest) return link.lanes;
  const after = nextLink(veh, link); if (!after) return link.lanes;
  const ni = S.net.info.get(link.to);
  const outs = ni.outLinks.filter(m => m.id !== link.reverseId && !ni.banSet.has(link.road.id + '>' + m.road.id));
  if (outs.length < 2) return link.lanes;
  const sgn = model.driveSide === 'right' ? 1 : -1;
  const ang = m => sgn * Math.atan2(link.d.x * m.d.y - link.d.y * m.d.x, link.d.x * m.d.x + link.d.y * m.d.y);
  let mx = -Infinity, mn = Infinity; for (const m of outs) { const a = ang(m); mx = Math.max(mx, a); mn = Math.min(mn, a); }
  const a = ang(after);
  if (a === mx && mx > 0.15) return [link.lanes[link.n - 1]];
  if (a === mn && mn < -0.15) return [link.lanes[0]];
  return link.lanes;
}
export function pickOutLane(link, veh) {
  let best = null, bs = -Infinity;
  for (const ln of laneOptions(link, veh)) { const sp = laneSpace(ln); if (sp > bs) { bs = sp; best = ln; } }
  return bs > veh.len + 2.5 ? best : null;
}
