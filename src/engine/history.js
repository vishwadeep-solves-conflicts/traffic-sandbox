/**
 * Undo and redo, using a snapshot of the whole network after every edit.
 */
import { model } from './model.js';
import { rebuild } from './network.js';
import { resetMetrics } from './simulation.js';
import { S } from './state.js';
import { endDraw } from '../map/input.js';
import { toast } from '../panels/dom.js';
import { renderInspector } from '../panels/inspector.js';

export function afterEdit(structural = true) {
  rebuild(true);
  resetMetrics();
  renderInspector();
  commitHistory();
}
export const undoStack = [], redoStack = [];
export let lastSnap = null;
export function snapModel() { return JSON.stringify({ nodes: [...model.nodes.values()], roads: [...model.roads.values()] }); }
export function commitHistory() {
  const cur = snapModel();
  if (lastSnap != null && cur !== lastSnap) { undoStack.push(lastSnap); if (undoStack.length > 100) undoStack.shift(); redoStack.length = 0; }
  lastSnap = cur; updateUndoButtons();
}
export function resetHistory() { undoStack.length = 0; redoStack.length = 0; lastSnap = snapModel(); updateUndoButtons(); }
export function restoreSnap(json) {
  const d = JSON.parse(json);
  model.nodes.clear(); model.roads.clear();
  for (const n of d.nodes) { model.nodes.set(n.id, n); S.uid = Math.max(S.uid, n.id + 1); }
  for (const r of d.roads) { model.roads.set(r.id, r); S.uid = Math.max(S.uid, r.id + 1); }
  S.drawFrom = null;
  rebuild(true); resetMetrics();
  lastSnap = json; renderInspector(); updateUndoButtons();
}
export function undo() {
  if (S.drawFrom != null) endDraw();
  commitHistory();
  if (!undoStack.length) { toast('Nothing to undo.'); return; }
  redoStack.push(lastSnap); restoreSnap(undoStack.pop()); toast('Undone.');
}
export function redo() {
  if (!redoStack.length) { toast('Nothing to redo.'); return; }
  undoStack.push(lastSnap); restoreSnap(redoStack.pop()); toast('Redone.');
}
export function updateUndoButtons() {
  const u = document.getElementById('undoBtn'), r = document.getElementById('redoBtn');
  if (u) u.disabled = !undoStack.length; if (r) r.disabled = !redoStack.length;
}
