/**
 * Mouse and keyboard on the map: selecting, drawing roads and flyovers, deleting, tools.
 */
import { afterEdit, redo, undo } from '../engine/history.js';
import { addNode, addRoad, deleteNode, deleteRoad, model, roadHalfWidth, splitRoad } from '../engine/model.js';
import { rebuild } from '../engine/network.js';
import { ui } from '../engine/simulation.js';
import { S } from '../engine/state.js';
import { arrowKeys, cam, cv, s2w, w2s, zoomBy } from './view.js';
import { showTab, togglePlay } from '../panels/controls.js';
import { $, toast } from '../panels/dom.js';
import { renderInspector } from '../panels/inspector.js';

export function adoptRoadSpec(r) {
  const lanes = Math.max(r.lanesF, r.lanesB), oneway = !(r.lanesF && r.lanesB);
  $('newLanes').value = (oneway ? 'o' : '') + Math.min(3, Math.max(1, lanes));
  const sp = [20, 30, 40, 50, 60, 80, 100].reduce((a, b) => Math.abs(b - r.speed) < Math.abs(a - r.speed) ? b : a);
  $('newSpeed').value = String(sp);
  $('newKind').value = r.kind || 'street';
  document.querySelectorAll('#kindChips .chip').forEach(c => c.classList.toggle('on', c.dataset.kind === $('newKind').value));
}
export function newRoadSpec() {
  return newRoadSpecRaw();
}
export function newRoadExtra() { return { kind: document.getElementById('newKind').value, elevated: ui.tool === 'bridge' }; }
export function newRoadSpecRaw() {
  const v = document.getElementById('newLanes').value, sp = +document.getElementById('newSpeed').value;
  if (v[0] === 'o') return [+v[1], 0, sp];
  return [+v, +v, sp];
}
export let mouseW = [0, 0], mouseS = [0, 0];
export let drag = null;
export function nodeAt(sx, sy) {
  let best = null, bd = 12;
  for (const n of model.nodes.values()) { const [x, y] = w2s(n.x, n.y); const d = Math.hypot(x - sx, y - sy) + (n.elevated && ui.tool !== 'bridge' ? 4 : 0); if (d < bd) { bd = d; best = n; } }
  return best;
}
export function roadAt(wx, wy, level) {
  let best = null, bd = Infinity, bp = null;
  for (const r of model.roads.values()) {
    if (level != null && !!r.elevated !== level) continue;
    const A = model.nodes.get(r.a), B = model.nodes.get(r.b);
    const dx = B.x - A.x, dy = B.y - A.y, L2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((wx - A.x) * dx + (wy - A.y) * dy) / L2));
    const px = A.x + dx * t, py = A.y + dy * t, d = Math.hypot(wx - px, wy - py);
    const score = d - (r.elevated ? 3 : 0);
    if (d < roadHalfWidth(r) + 6 / cam.z && score < bd) { bd = score; best = r; bp = { x: px, y: py, t }; }
  }
  return best ? { road: best, p: bp } : null;
}
export function snapW(x, y) { return ui.snap ? [Math.round(x / 5) * 5, Math.round(y / 5) * 5] : [x, y]; }
// selecting something opens the Edit tab
export function select(sel) { S.selection = sel; renderInspector(); if (sel) showTab('edit'); }
export function endDraw() {
  if (S.drawFrom != null) { const ni = [...model.roads.values()].some(r => r.a === S.drawFrom || r.b === S.drawFrom); if (!ni) model.nodes.delete(S.drawFrom); }
  S.drawFrom = null; rebuild(true);
}
export let spaceDown = false;
export function setTool(t) {
  if ((ui.tool === 'road' || ui.tool === 'bridge') && t !== ui.tool) endDraw();
  ui.tool = t;
  document.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === t));
  updateHint();
  // the cursor and the drawing options follow the tool
  $('drawOpts').hidden = !(t === 'road' || t === 'bridge');
  cv.classList.toggle('drawing', t === 'road' || t === 'bridge');
  cv.classList.toggle('deleting', t === 'delete');
  cv.classList.toggle('panning', t === 'pan');
}
export function updateHint() {
  const h = { select: 'Hover for live numbers. Click a road or junction to edit it. Drag empty map to pan, scroll to zoom.',
    road: 'Click point to point to draw. Click on a road to join it with a junction. Press Esc or right-click to finish.',
    bridge: 'Click on a road to start the ramp, click on a road beyond the crossing to land it. It passes over anything in between. Esc to finish.',
    delete: 'Click a road or junction to delete it. Press V to go back to selecting.',
    pan: 'Drag to move the map. Arrow keys work with any tool; hold Shift to go faster.' };
  document.getElementById('hint').textContent = h[ui.tool];
}

/** Wires this module's part of the page. Called once by startEngine(). */
export function initInput() {
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('wheel', e => {
    e.preventDefault();
    const [wx, wy] = s2w(e.offsetX, e.offsetY);
    cam.z = Math.max(0.03, Math.min(12, cam.z * Math.exp(-e.deltaY * 0.0015)));
    const [nx, ny] = s2w(e.offsetX, e.offsetY); cam.x += wx - nx; cam.y += wy - ny;
  }, { passive: false });
  cv.addEventListener('pointerdown', e => {
    cv.setPointerCapture(e.pointerId);
    const sx = e.offsetX, sy = e.offsetY; const [wx, wy] = s2w(sx, sy);
    if (e.button === 1 || e.button === 2 || spaceDown) {
      if (e.button === 2 && (ui.tool === 'road' || ui.tool === 'bridge') && S.drawFrom != null) { endDraw(); return; }
      drag = { kind: 'pan', sx, sy, cx: cam.x, cy: cam.y }; return;
    }
    if (ui.tool === 'pan') { drag = { kind: 'pan', sx, sy, cx: cam.x, cy: cam.y }; cv.classList.add('grabbing'); return; }
    if (ui.tool === 'select') {
      const n = nodeAt(sx, sy);
      if (n) { select({ type: 'node', id: n.id }); drag = { kind: 'node', id: n.id, moved: false }; return; }
      const r = roadAt(wx, wy);
      if (r) { select({ type: 'road', id: r.road.id }); return; }
      select(null); drag = { kind: 'pan', sx, sy, cx: cam.x, cy: cam.y };
    } else if (ui.tool === 'delete') {
      const n = nodeAt(sx, sy);
      if (n) { deleteNode(n.id); if (S.selection && S.selection.id === n.id) S.selection = null; afterEdit(); return; }
      const r = roadAt(wx, wy);
      if (r) { deleteRoad(r.road.id); if (S.selection && S.selection.id === r.road.id) S.selection = null; afterEdit(); return; }
      drag = { kind: 'pan', sx, sy, cx: cam.x, cy: cam.y };
    } else if (ui.tool === 'road' || ui.tool === 'bridge') {
      const bridge = ui.tool === 'bridge';
      let n = nodeAt(sx, sy);
      if (!n) {
        // a flyover passes over ground roads instead of joining them; it only joins other flyovers
        // clicked points snap onto existing roads (a flyover end on a ground road becomes a ramp junction);
        // the stretch between clicks passes over whatever it crosses without joining it
        const r = roadAt(wx, wy);
        if (r && r.p.t > 0.02 && r.p.t < 0.98) {
          n = splitRoad(r.road, r.p.x, r.p.y);
          if (bridge && !r.road.elevated) n.control = 'priority';
          if (bridge && S.drawFrom == null) adoptRoadSpec(r.road);   // a flyover starting on a road copies its size
        }
        else { const [x, y] = snapW(wx, wy); n = addNode(x, y, bridge ? { elevated: true, control: 'none' } : undefined); }
      }
      if (S.drawFrom != null && S.drawFrom !== n.id) {
        const A = model.nodes.get(S.drawFrom);
        if (Math.hypot(A.x - n.x, A.y - n.y) < 12) { toast('Road too short (min 12 m).'); return; }
        const [lf, lb, sp] = newRoadSpec(); addRoad(S.drawFrom, n.id, lf, lb, sp, newRoadExtra());
        afterEdit();
      }
      S.drawFrom = n.id;
    }
  });
  cv.addEventListener('pointermove', e => {
    mouseS = [e.offsetX, e.offsetY]; mouseW = s2w(e.offsetX, e.offsetY);
    if (drag && drag.kind === 'pan') { cam.x = drag.cx - (e.offsetX - drag.sx) / cam.z; cam.y = drag.cy - (e.offsetY - drag.sy) / cam.z; return; }
    if (drag && drag.kind === 'node') {
      const n = model.nodes.get(drag.id); if (!n) return;
      const [x, y] = snapW(mouseW[0], mouseW[1]); if (x !== n.x || y !== n.y) { n.x = x; n.y = y; drag.moved = true; rebuild(true); }
      return;
    }
    const n = nodeAt(e.offsetX, e.offsetY);
    S.hover = n ? { type: 'node', id: n.id } : (() => { const r = roadAt(mouseW[0], mouseW[1]); return r ? { type: 'road', id: r.road.id } : null; })();
  });
  cv.addEventListener('pointerup', () => { if (drag && drag.kind === 'node' && drag.moved) afterEdit(); drag = null; cv.classList.remove('grabbing'); });
  window.addEventListener('keydown', e => {
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); redo(); return; }
    if (e.code === 'Space') { e.preventDefault(); if (!spaceDown) togglePlay(); spaceDown = true; }
    else if (e.key === 'Escape') { endDraw(); }
    else if (e.key === 'v' || e.key === 'V') setTool('select');
    else if (e.key === 'r' || e.key === 'R') setTool('road');
    else if (e.key === 'd' || e.key === 'D') setTool('delete');
    else if (e.key === 'f' || e.key === 'F') setTool('bridge');
    else if (e.key === 'h' || e.key === 'H') setTool('pan');
    else if (e.key.startsWith('Arrow')) { e.preventDefault(); arrowKeys.add(e.key); S.arrowFast = e.shiftKey; }
    else if (e.key === '+' || e.key === '=') zoomBy(1.25);
    else if (e.key === '-' || e.key === '_') zoomBy(0.8);
    else if ((e.key === 'Delete' || e.key === 'Backspace') && S.selection) {
      if (S.selection.type === 'node') deleteNode(S.selection.id); else deleteRoad(S.selection.id);
      S.selection = null; afterEdit();
    }
  });
  window.addEventListener('keyup', e => { if (e.code === 'Space') spaceDown = false; arrowKeys.delete(e.key); S.arrowFast = e.shiftKey; });
  window.addEventListener('blur', () => arrowKeys.clear());
  document.querySelectorAll('[data-tool]').forEach(b => b.addEventListener('click', () => setTool(b.dataset.tool)));
}
