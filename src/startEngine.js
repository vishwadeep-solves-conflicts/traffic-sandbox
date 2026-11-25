/**
 * Starts the engine once React has mounted the page, and runs the frame loop.
 */
import { DT } from './engine/constants.js';
import { redo, undo } from './engine/history.js';
import { exportJSON, importJSON, importOSM, parseOSMXML } from './engine/importExport.js';
import { model } from './engine/model.js';
import { loadPreset } from './engine/presets.js';
import { currentMetrics, optimizeSignals, step, ui } from './engine/simulation.js';
import { S } from './engine/state.js';
import { initInput, updateHint } from './map/input.js';
import { draw } from './map/render.js';
import { initTheme } from './map/theme.js';
import { initView, panByKeys, resize, w2s } from './map/view.js';
import { initCharts } from './panels/charts.js';
import { initCoach, showCoach } from './panels/coach.js';
import { initControls } from './panels/controls.js';
import { initDataPane } from './panels/dataPane.js';
import { $ } from './panels/dom.js';
import { renderInspector } from './panels/inspector.js';
import { initResults, renderBaseline, updateMetricsUI } from './panels/results.js';
import { initTooltip } from './panels/tooltip.js';

let lastTs = performance.now(), acc = 0, lastUI = 0;
function frame(ts) {
  const real = Math.min(0.1, (ts - lastTs) / 1000); lastTs = ts;
  if (ui.running) {
    acc += real * ui.speed; let n = 0; const t0 = performance.now();
    while (acc >= DT && n < 600) { step(); acc -= DT; n++; if ((n & 15) === 0 && performance.now() - t0 > 30) { acc = 0; break; } }
  }
  panByKeys(real);
  draw();
  if (ts - lastUI > 400) { lastUI = ts; updateMetricsUI(); }
  requestAnimationFrame(frame);
}

/** Starts the simulation. Call once, after the page's markup is mounted. */
export function startEngine() {
  initView();
  initInput();
  initTheme();
  initControls();
  initResults();
  initDataPane();
  initCharts();
  initTooltip();
  initCoach();
  try { new ResizeObserver(() => resize()).observe($('stage')); } catch (e) {}
  resize();
  updateHint();
  loadPreset('grid');
  renderInspector();
  renderBaseline();
  try { if (!localStorage.getItem('ts-coach')) showCoach(0); } catch (e) { showCoach(0); }
  requestAnimationFrame(frame);
  window.sim = { undo: () => undo(), redo: () => redo(), w2s: (x, y) => w2s(x, y), step, model, get net() { return S.net; }, get vehicles() { return S.vehicles; }, currentMetrics, loadPreset, optimizeSignals, importOSM, parseOSMXML, importJSON, exportJSON, ui, get time() { return S.simTime; }, showCoach };
}
