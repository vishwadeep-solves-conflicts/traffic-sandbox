/**
 * The editable network: junctions (nodes) and roads, and the edits that change it
 * (split a road, ban turns, build a flyover, add service roads).
 */
import { LW } from './constants.js';
import { S } from './state.js';
import { toast } from '../panels/dom.js';

export const model = { nodes: new Map(), roads: new Map(), driveSide: 'right' };
export function addNode(x, y, extra) {
  const n = Object.assign({ id: S.uid++, x, y, control: 'signal', green: 25, phaseGreens: null, demand: 300 }, extra || {});
  model.nodes.set(n.id, n); return n;
}
export function addRoad(a, b, lanesF = 1, lanesB = 1, speed = 50, extra) {
  if (a === b) return null;
  for (const r of model.roads.values()) if ((r.a === a && r.b === b) || (r.a === b && r.b === a)) return r;
  const r = Object.assign({ id: S.uid++, a, b, lanesF, lanesB, speed, kind: (lanesF + lanesB >= 4 ? 'arterial' : 'street'), elevated: false }, extra || {});
  model.roads.set(r.id, r); return r;
}
export function clearModel() { model.nodes.clear(); model.roads.clear(); }
export function roadHalfWidth(r) { return (r.lanesF + r.lanesB) * LW / 2; }
export function sidePerp(d) { // unit vector pointing to the driving side of a direction
  const rx = -d.y, ry = d.x;        // right-hand side in screen coords (y down)
  return model.driveSide === 'right' ? { x: rx, y: ry } : { x: -rx, y: -ry };
}
export function compass(dx, dy) {
  const a = Math.atan2(-dy, dx) * 180 / Math.PI; // 0 = east, 90 = north
  const names = ['E', 'NE', 'N', 'NW', 'W', 'SW', 'S', 'SE'];
  return names[((Math.round(a / 45) % 8) + 8) % 8];
}
export function removeIsolated() {
  const deg = new Map(); for (const r of model.roads.values()) { deg.set(r.a, 1); deg.set(r.b, 1); }
  for (const id of [...model.nodes.keys()]) if (!deg.has(id)) model.nodes.delete(id);
}
export function deleteNode(id) {
  for (const r of [...model.roads.values()]) if (r.a === id || r.b === id) model.roads.delete(r.id);
  model.nodes.delete(id); removeIsolated();
}
export function deleteRoad(id) { model.roads.delete(id); removeIsolated(); }
export function splitRoad(r, x, y) {
  const n = addNode(x, y, r.elevated ? { elevated: true, control: 'none' } : undefined);
  const r2 = Object.assign({}, r, { id: S.uid++, a: n.id, b: r.b });
  const nb = model.nodes.get(r.b);
  if (nb && nb.bans) nb.bans = nb.bans.map(k => k.split('>').map(x => +x === r.id ? r2.id : x).join('>'));
  r.b = n.id; model.roads.set(r2.id, r2);
  return n;
}
export function otherEnd(r, nodeId) { return model.nodes.get(r.a === nodeId ? r.b : r.a); }
export function armDir(r, node) { const o = otherEnd(r, node.id); const dx = o.x - node.x, dy = o.y - node.y, L = Math.hypot(dx, dy) || 1; return { x: dx / L, y: dy / L }; }
export function armsOf(nodeId) {
  const node = model.nodes.get(nodeId);
  return [...model.roads.values()].filter(r => r.a === nodeId || r.b === nodeId).map(r => {
    const d = armDir(r, node), atB = r.b === nodeId;
    const canIn = atB ? r.lanesF > 0 : r.lanesB > 0, canOut = atB ? r.lanesB > 0 : r.lanesF > 0;
    let name = compass(d.x, d.y); if (r.kind === 'service') name += ' svc'; if (r.elevated) name += ' fly';
    return { road: r, d, name, canIn, canOut };
  });
}
export function oppositePairs(arms) {
  const out = [], ok = a => a.canIn && a.canOut && a.road.kind !== 'service' && !a.road.elevated;
  for (let i = 0; i < arms.length; i++) for (let j = i + 1; j < arms.length; j++)
    if (ok(arms[i]) && ok(arms[j]) && arms[i].d.x * arms[j].d.x + arms[i].d.y * arms[j].d.y < -0.8) out.push([arms[i], arms[j]]);
  return out;
}
// movement from arm a (arriving) to arm b (leaving): 'straight' | 'near' (turn without crossing traffic) | 'far' | 'uturn'
export function movementType(a, b) {
  if (a === b) return 'uturn';
  const din = { x: -a.d.x, y: -a.d.y }, dout = b.d;
  const dot = din.x * dout.x + din.y * dout.y; if (dot > 0.7) return 'straight';
  const cross = din.x * dout.y - din.y * dout.x;  // > 0 means a right turn on screen
  const right = cross > 0;
  return (right === (model.driveSide === 'right')) ? 'near' : 'far';
}
export function setMovementRule(nodeId, rule, pair) {
  const node = model.nodes.get(nodeId), arms = armsOf(nodeId), bans = [];
  const onAxis = a => pair && (a.road.id === pair[0].road.id || a.road.id === pair[1].road.id);
  for (const a of arms) for (const b of arms) {
    if (a === b) continue;
    const t = movementType(a, b);
    let ok = true;
    if (rule === 'axisOnly') ok = onAxis(a) && onAxis(b);
    else if (rule === 'median') ok = t === 'near' || (t === 'straight' && onAxis(a));
    else if (rule === 'noFar') ok = t !== 'far';
    else if (rule === 'noCross') ok = !(onAxis(a) && onAxis(b) && t === 'straight');
    if (!ok) bans.push(a.road.id + '>' + b.road.id);
  }
  node.bans = bans;
}
export function toggleMovement(nodeId, from, to) {
  const node = model.nodes.get(nodeId); const k = from + '>' + to;
  const set = new Set(node.bans || []); set.has(k) ? set.delete(k) : set.add(k); node.bans = [...set];
}
// Turn a crossroads into a flyover along one axis, with one-way service roads beneath for turning traffic.
export function makeFlyover(nodeId, pair) {
  const G = model.nodes.get(nodeId);
  for (const arm of pair) if (Math.hypot(otherEnd(arm.road, G.id).x - G.x, otherEnd(arm.road, G.id).y - G.y) < 90) { toast('The ' + arm.name + ' road is too short for ramps (needs 90 m).'); return false; }
  const B = addNode(G.x, G.y, { elevated: true, control: 'none' });
  for (const arm of pair) {
    const r = arm.road, O = otherEnd(r, G.id);
    const L = Math.hypot(O.x - G.x, O.y - G.y), ramp = Math.min(L * 0.6, 130);
    const P = splitRoad(r, G.x + arm.d.x * ramp, G.y + arm.d.y * ramp);
    P.control = 'priority';
    const inner = [...model.roads.values()].find(x => (x.a === P.id && x.b === G.id) || (x.b === P.id && x.a === G.id));
    if (inner.a === G.id) inner.a = B.id; else inner.b = B.id;
    inner.elevated = true;
    // service roads either side: traffic heading to the junction keeps to the driving side
    const u = { x: -arm.d.x, y: -arm.d.y };                     // from P towards G
    const side = sidePerp(u);
    const off = roadHalfWidth(r) + LW * 1.5 + 2;
    const mid = (k) => addNode(P.x + (G.x - P.x) * 0.5 + side.x * off * k, P.y + (G.y - P.y) * 0.5 + side.y * off * k, { control: 'none' });
    const q1 = mid(1), q2 = mid(-1);
    const lanes = Math.min(2, Math.max(r.lanesF, r.lanesB, 1));
    const svc = { kind: 'service' };
    addRoad(P.id, q1.id, lanes, 0, 30, svc); addRoad(q1.id, G.id, lanes, 0, 30, svc);
    addRoad(G.id, q2.id, lanes, 0, 30, svc); addRoad(q2.id, P.id, lanes, 0, 30, svc);
  }
  G.bans = []; G.phaseGreens = null;
  return true;
}
// Parallel two-way service road on the driving side, joined to the road by slip junctions near each end.
// Service roads beside a road, joined to it by give-way slip roads near each end.
// both = false: one two-way service road on the driving side.
// both = true: a one-way service road on each side, running the same way as the traffic next to it.
export function addServiceRoad(roadId, both) {
  const r = model.roads.get(roadId), A = model.nodes.get(r.a), B = model.nodes.get(r.b);
  const dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy);
  if (L < 140) { toast('This road piece is only ' + Math.round(L) + ' m long; a service road needs 140 m. Select a longer piece.'); return false; }
  const d = { x: dx / L, y: dy / L }, side = sidePerp(d), off = roadHalfWidth(r) + 9, inset = Math.min(40, L * 0.15);
  const Pa = splitRoad(r, A.x + d.x * inset, A.y + d.y * inset);
  const r2 = [...model.roads.values()].find(x => x.a === Pa.id && x.b === B.id);
  const Pb = splitRoad(r2, B.x - d.x * inset, B.y - d.y * inset);
  Pa.control = Pb.control = 'priority';
  const svc = { kind: 'service' };
  const build = (k, oneway) => {
    const a2 = addNode(Pa.x + d.x * 25 + side.x * off * k, Pa.y + d.y * 25 + side.y * off * k, { control: 'priority' });
    const b2 = addNode(Pb.x - d.x * 25 + side.x * off * k, Pb.y - d.y * 25 + side.y * off * k, { control: 'priority' });
    if (!oneway) { addRoad(Pa.id, a2.id, 1, 1, 30, svc); addRoad(a2.id, b2.id, 1, 1, 30, svc); addRoad(b2.id, Pb.id, 1, 1, 30, svc); }
    else if (k > 0) { addRoad(Pa.id, a2.id, 1, 0, 30, svc); addRoad(a2.id, b2.id, 1, 0, 30, svc); addRoad(b2.id, Pb.id, 1, 0, 30, svc); }
    else { addRoad(Pb.id, b2.id, 1, 0, 30, svc); addRoad(b2.id, a2.id, 1, 0, 30, svc); addRoad(a2.id, Pa.id, 1, 0, 30, svc); }
  };
  if (both) { build(1, true); build(-1, true); } else build(1, false);
  return true;
}
