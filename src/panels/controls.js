/**
 * The top bar and Map & settings controls, the tabs, and the new-road options.
 */
import { KINDS } from '../engine/constants.js';
import { redo, undo } from '../engine/history.js';
import { model } from '../engine/model.js';
import { rebuild } from '../engine/network.js';
import { loadPreset } from '../engine/presets.js';
import { computeRouting } from '../engine/routing.js';
import { optimizeSignals, resetMetrics, ui } from '../engine/simulation.js';
import { S } from '../engine/state.js';
import { $ } from './dom.js';
import { renderInspector } from './inspector.js';
import { renderBaseline } from './results.js';

export function togglePlay() {
  ui.running = !ui.running;
  $('playLbl').textContent = ui.running ? 'Pause' : 'Play';
  $('playIcon').innerHTML = ui.running ? '<rect x="2" y="1" width="3.5" height="12" rx="1" fill="currentColor"/><rect x="8.5" y="1" width="3.5" height="12" rx="1" fill="currentColor"/>' : '<path d="M3 1.5v11l9.5-5.5z" fill="currentColor"/>';
}
export const SPEEDS = [1, 2, 5, 10, 25];
// tabs
export function showTab(name) {
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === name));
  for (const p of ['results', 'edit', 'data']) $('pane-' + p).hidden = p !== name;
}

/** Wires this module's part of the page. Called once by startEngine(). */
export function initControls() {
  $('play').onclick = togglePlay;
  $('undoBtn').onclick = undo;
   $('redoBtn').onclick = redo;
  $('speeds').innerHTML = SPEEDS.map(s => `<button data-sp="${s}" class="${s === 1 ? 'on' : ''}">${s}×</button>`).join('');
  $('speeds').querySelectorAll('button').forEach(b => b.onclick = () => { ui.speed = +b.dataset.sp; $('speeds').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); });
  $('volume').oninput = e => { ui.demand = e.target.value / 100; $('volumeV').textContent = e.target.value + '%'; };
  $('volume').onchange = () => resetMetrics();
  $('heat').onchange = e => ui.heat = e.target.checked;
  ui.heat = true;
  $('smart').onchange = e => { ui.smart = e.target.checked; S.net.dist = computeRouting(ui.smart); };
  $('snap').onchange = e => ui.snap = e.target.checked;
  $('side').onchange = e => { model.driveSide = e.target.value; S.vehicles = []; rebuild(false); resetMetrics(); renderInspector(); };
  $('preset').onchange = () => { loadPreset($('preset').value); S.baseline = null; renderBaseline(); };
  $('clearVeh').onclick = () => { S.vehicles = []; for (const s of S.net.sources) s.pending = []; rebuild(false); resetMetrics(); };
  $('optimize').onclick = optimizeSignals;
  $('resetM').onclick = resetMetrics;
  document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => showTab(b.dataset.tab));
  // road type chips in the drawing options
  {
  const kindChips = $('kindChips');
  kindChips.innerHTML = Object.entries(KINDS).map(([k, v]) => `<button class="chip ${k === 'street' ? 'on' : ''}" data-kind="${k}"><span class="sw" style="background:${k === 'highway' ? 'var(--road-hwy)' : k === 'service' ? 'var(--road-service)' : 'var(--road)'};height:${k === 'highway' ? 10 : k === 'service' ? 5 : 8}px"></span>${v.label}</button>`).join('');
  kindChips.querySelectorAll('.chip').forEach(c => c.onclick = () => {
    kindChips.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === c));
    $('newKind').value = c.dataset.kind; const k = KINDS[c.dataset.kind];
    $('newLanes').value = String(k.lanes); $('newSpeed').value = String(k.speed);
  });
  }
  $('newSpeed').value = '50';
  // legend
  $('legendToggle').onclick = () => { const b = $('legendBody'); b.style.display = b.style.display === 'none' ? 'grid' : 'none'; };
}
