/**
 * Saving and loading networks as text, and importing OpenStreetMap data.
 */
import { HW_CLASS } from './constants.js';
import { resetHistory } from './history.js';
import { addNode, addRoad, clearModel, model } from './model.js';
import { rebuild } from './network.js';
import { resetMetrics } from './simulation.js';
import { S } from './state.js';
import { select } from '../map/input.js';
import { fitView } from '../map/view.js';
import { toast } from '../panels/dom.js';

export function exportJSON() {
  return JSON.stringify({ format: 'traffic-sandbox', version: 1, driveSide: model.driveSide,
    nodes: [...model.nodes.values()].map(n => ({ id: n.id, x: +n.x.toFixed(2), y: +n.y.toFixed(2), control: n.control, green: n.green, phaseGreens: n.phaseGreens || undefined, demand: n.demand, osm: n.osm, elevated: n.elevated || undefined, bans: (n.bans && n.bans.length) ? n.bans : undefined })),
    roads: [...model.roads.values()].map(r => ({ id: r.id, a: r.a, b: r.b, lanesF: r.lanesF, lanesB: r.lanesB, speed: r.speed, name: r.name, rank: r.rank, kind: r.kind, elevated: r.elevated || undefined })) });
}
// Accepts our own format. Nodes may carry lat/lon instead of x/y; they are projected to local metres.
export function importJSON(text) {
  const d = JSON.parse(text);
  if (d.elements) return importOSM(d);
  if (!d.nodes || !d.roads) throw new Error('Expected {nodes:[...], roads:[...]}');
  clearModel(); S.vehicles = []; S.net.info = new Map(); S.net.linkById = new Map();
  if (d.driveSide) { model.driveSide = d.driveSide; document.getElementById('side').value = d.driveSide; }
  const proj = makeProjection(d.nodes.filter(n => n.lat != null));
  const idMap = new Map(), roadIdMap = new Map();
  for (const n of d.nodes) {
    let x = n.x, y = n.y; if (n.lat != null) [x, y] = proj(n.lat, n.lon);
    const nn = addNode(x, y, { control: n.control || 'signal', green: n.green || 25, phaseGreens: n.phaseGreens || null, demand: n.demand != null ? n.demand : 300, osm: n.osm, elevated: !!n.elevated, bans: n.bans || null });
    idMap.set(n.id, nn.id);
  }
  for (const r of d.roads) {
    const a = idMap.get(r.a), b = idMap.get(r.b); if (a == null || b == null) continue;
    let lf = r.lanesF, lb = r.lanesB; if (r.oneway) { lf = lf || 1; lb = 0; }
    const nr = addRoad(a, b, lf != null ? lf : 1, lb != null ? lb : 1, r.speed || 50, { name: r.name, rank: r.rank, elevated: !!r.elevated });
    if (nr && r.kind) nr.kind = r.kind;
    if (nr) roadIdMap.set(r.id, nr.id);
  }
  for (const n of model.nodes.values()) if (n.bans) n.bans = n.bans.map(k => k.split('>').map(x => roadIdMap.get(+x) ?? roadIdMap.get(x) ?? x).join('>'));
  finishImport();
}
export function makeProjection(pts) {
  if (!pts.length) return () => [0, 0];
  const lat0 = pts.reduce((a, p) => a + p.lat, 0) / pts.length, lon0 = pts.reduce((a, p) => a + p.lon, 0) / pts.length;
  const kx = 111320 * Math.cos(lat0 * Math.PI / 180), ky = 110540;
  return (lat, lon) => [(lon - lon0) * kx, -(lat - lat0) * ky];
}
export function osmClass(h) { if (!h) return null; const base = h.replace('_link', ''); const c = HW_CLASS[base]; if (!c) return null; return h.endsWith('_link') ? [Math.min(c[0], 50), 1, c[2] - 0.5] : c; }
export function parseOSMXML(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const tags = el => { const t = {}; el.querySelectorAll(':scope > tag').forEach(g => t[g.getAttribute('k')] = g.getAttribute('v')); return t; };
  const elements = [];
  doc.querySelectorAll('node').forEach(n => elements.push({ type: 'node', id: +n.getAttribute('id'), lat: +n.getAttribute('lat'), lon: +n.getAttribute('lon'), tags: tags(n) }));
  doc.querySelectorAll('way').forEach(w => elements.push({ type: 'way', id: +w.getAttribute('id'), nodes: [...w.querySelectorAll(':scope > nd')].map(n => +n.getAttribute('ref')), tags: tags(w) }));
  if (!elements.length) throw new Error('No OSM nodes or ways found');
  return { elements };
}
export function importOSM(data) {
  const onodes = new Map(), ways = [];
  for (const e of data.elements) {
    if (e.type === 'node') onodes.set(e.id, e);
    else if (e.type === 'way' && e.tags && osmClass(e.tags.highway) && e.tags.area !== 'yes' && e.tags.access !== 'private') ways.push(e);
  }
  if (!ways.length) throw new Error('No drivable roads (highway=*) found in that data');
  const use = new Map();
  for (const w of ways) w.nodes.forEach((id, i) => use.set(id, (use.get(id) || 0) + ((i === 0 || i === w.nodes.length - 1) ? 1 : 2)));
  const proj = makeProjection([...use.keys()].map(id => onodes.get(id)).filter(Boolean));
  clearModel(); S.vehicles = []; S.net.info = new Map(); S.net.linkById = new Map();
  const nodeFor = new Map();
  const getNode = (oid) => {
    if (nodeFor.has(oid)) return nodeFor.get(oid);
    const o = onodes.get(oid); const [x, y] = proj(o.lat, o.lon);
    const t = (o.tags && o.tags.highway) || '';
    const control = t === 'traffic_signals' ? 'signal' : (t === 'stop' || t === 'all_way_stop') ? 'stop' : 'priority';
    const n = addNode(x, y, { control, green: 25, demand: 150, osm: oid }); nodeFor.set(oid, n); return n;
  };
  // A signal tagged on a node just before a junction should control that junction.
  const signalNear = new Set();
  for (const w of ways) {
    const cls = osmClass(w.tags.highway);
    const base = w.tags.highway.replace('_link', '');
    const kind = /motorway|trunk/.test(base) ? 'highway' : /primary|secondary/.test(base) ? 'arterial' : /service|living_street/.test(base) ? 'service' : 'street';
    const elevated = w.tags.bridge && w.tags.bridge !== 'no' || parseInt(w.tags.layer, 10) > 0;
    let speed = cls[0];
    const ms = w.tags.maxspeed; if (ms) { const v = parseFloat(ms); if (!isNaN(v)) speed = /mph/.test(ms) ? Math.round(v * 1.609) : v; }
    const oneway = w.tags.oneway === 'yes' || w.tags.oneway === '1' || w.tags.oneway === '-1' || w.tags.junction === 'roundabout' || w.tags.highway === 'motorway';
    const rev = w.tags.oneway === '-1';
    let lanes = parseInt(w.tags.lanes, 10);
    let lf, lb;
    if (oneway) { lf = Math.max(1, Math.min(4, isNaN(lanes) ? cls[1] : lanes)); lb = 0; }
    else {
      const f = parseInt(w.tags['lanes:forward'], 10), b = parseInt(w.tags['lanes:backward'], 10);
      if (!isNaN(f) && !isNaN(b)) { lf = f; lb = b; }
      else if (!isNaN(lanes)) { lf = Math.max(1, Math.ceil(lanes / 2)); lb = Math.max(1, Math.floor(lanes / 2)); }
      else { lf = lb = cls[1]; }
      lf = Math.min(lf, 4); lb = Math.min(lb, 4);
    }
    const ids = w.nodes.filter(id => onodes.has(id));
    // split at junctions; simplify each piece
    let piece = [ids[0]];
    const flush = () => {
      if (piece.length < 2) return;
      const pts = piece.map(id => { const o = onodes.get(id); const [x, y] = proj(o.lat, o.lon); return { id, x, y }; });
      const keep = simplify(pts, 6, 15);
      for (let i = 1; i < keep.length; i++) {
        const a = getNode(keep[i - 1].id), b = getNode(keep[i].id);
        const ex = { name: w.tags.name, rank: cls[2], kind, elevated: !!elevated };
        if (rev) addRoad(b.id, a.id, lf, lb, speed, ex);
        else addRoad(a.id, b.id, lf, lb, speed, ex);
      }
    };
    for (let i = 1; i < ids.length; i++) {
      piece.push(ids[i]);
      const o = onodes.get(ids[i]);
      if (o.tags && o.tags.highway === 'traffic_signals' && use.get(ids[i]) < 3) signalNear.add(ids[i]);
      if (use.get(ids[i]) >= 3 || i === ids.length - 1) { flush(); piece = [ids[i]]; }
    }
  }
  addEdgeGates();
  finishImport();
  // move stray signal tags onto the nearest junction within 40 m
  for (const oid of signalNear) {
    const o = onodes.get(oid); const [x, y] = proj(o.lat, o.lon); let best = null, bd = 40;
    for (const ni of S.net.info.values()) if (ni.deg >= 3) { const d = Math.hypot(ni.node.x - x, ni.node.y - y); if (d < bd) { bd = d; best = ni; } }
    if (best) best.node.control = 'signal';
  }
  rebuild(false); resetMetrics();
  toast('Imported ' + ways.length + ' OSM ways as ' + model.roads.size + ' road segments and ' + S.net.sources.length + ' entry points. Dead ends and map edges act as entries/exits.');
}
// If the map has (almost) no dead ends, add short entry/exit stubs at nodes on the map edge.
export function addEdgeGates() {
  const deg = new Map(); for (const r of model.roads.values()) { deg.set(r.a, (deg.get(r.a) || 0) + 1); deg.set(r.b, (deg.get(r.b) || 0) + 1); }
  const nodes = [...model.nodes.values()].filter(n => deg.get(n.id));
  if (nodes.filter(n => deg.get(n.id) === 1).length >= 2 || nodes.length < 3) return;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const n of nodes) { x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y); x1 = Math.max(x1, n.x); y1 = Math.max(y1, n.y); }
  const tol = Math.max(15, 0.04 * Math.max(x1 - x0, y1 - y0));
  for (const n of nodes) {
    const dx = n.x - x0 < tol ? -1 : x1 - n.x < tol ? 1 : 0, dy = n.y - y0 < tol ? -1 : y1 - n.y < tol ? 1 : 0;
    if (!dx && !dy) continue;
    const L = Math.hypot(dx, dy), g = addNode(n.x + dx / L * 60, n.y + dy / L * 60, { demand: 150 });
    addRoad(n.id, g.id, 1, 1, 40);
  }
}
// keep endpoints; drop interior points within tol of the chord and points closer than minSeg
export function simplify(pts, tol, minSeg) {
  if (pts.length <= 2) return pts;
  const keep = new Array(pts.length).fill(false); keep[0] = keep[pts.length - 1] = true;
  const rec = (i, j) => {
    let md = 0, mi = -1; const a = pts[i], b = pts[j]; const L = Math.hypot(b.x - a.x, b.y - a.y) || 1e-9;
    for (let k = i + 1; k < j; k++) { const d = Math.abs((b.x - a.x) * (a.y - pts[k].y) - (a.x - pts[k].x) * (b.y - a.y)) / L; if (d > md) { md = d; mi = k; } }
    if (md > tol) { keep[mi] = true; rec(i, mi); rec(mi, j); }
  };
  rec(0, pts.length - 1);
  const out = []; for (let i = 0; i < pts.length; i++) if (keep[i]) out.push(pts[i]);
  const res = [out[0]];
  for (let i = 1; i < out.length - 1; i++) { const p = res[res.length - 1]; if (Math.hypot(out[i].x - p.x, out[i].y - p.y) >= minSeg) res.push(out[i]); }
  const last = out[out.length - 1], pl = res[res.length - 1];
  if (res.length > 1 && Math.hypot(last.x - pl.x, last.y - pl.y) < minSeg) res.pop();
  res.push(last);
  return res;
}
export function finishImport() {
  // remove isolated nodes
  const deg = new Map(); for (const r of model.roads.values()) { deg.set(r.a, (deg.get(r.a) || 0) + 1); deg.set(r.b, (deg.get(r.b) || 0) + 1); }
  for (const id of [...model.nodes.keys()]) if (!deg.get(id)) model.nodes.delete(id);
  for (const n of model.nodes.values()) S.uid = Math.max(S.uid, n.id + 1);
  for (const r of model.roads.values()) S.uid = Math.max(S.uid, r.id + 1);
  rebuild(false); resetMetrics(); S.completed = 0; S.lost = 0; fitView(); select(null); resetHistory();
}
