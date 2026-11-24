/**
 * The Results tab: status in plain words, the four headline numbers, and before/after.
 */
import { WINDOW } from '../engine/constants.js';
import { compass } from '../engine/model.js';
import { currentMetrics, queueOn, ui } from '../engine/simulation.js';
import { S } from '../engine/state.js';
import { select, setTool } from '../map/input.js';
import { cam } from '../map/view.js';
import { drawChart } from './charts.js';
import { $, fmtClock, toast } from './dom.js';
import { updateInspectorStats } from './inspector.js';

export function renderBaseline() {
  $('clearBase').hidden = !S.baseline;
  $('saveBase').textContent = S.baseline ? 'Save again as before' : 'Save as before';
  $('baseInfo').textContent = S.baseline
    ? 'Before: ' + Math.round(S.baseline.thr) + ' cars/hour, ' + Math.round(S.baseline.delay) + ' s lost per trip (saved at ' + fmtClock(S.baseline.at) + '). The arrows on each number show the change.'
    : 'Save the current numbers as "before", change something on the map, let it run 3 minutes, then compare.';
}
export function setDelta(id, cur, base, higherBetter, fmt) {
  const el = $(id);
  if (!S.baseline) { el.textContent = ''; el.className = 'delta'; return; }
  const diff = cur - base, pct = base ? diff / base * 100 : (cur ? 100 : 0);
  const better = higherBetter ? diff > 0 : diff < 0;
  const same = Math.abs(pct) < 3 && Math.abs(diff) < 2;
  el.className = 'delta ' + (same ? 'same' : better ? 'better' : 'worse');
  el.textContent = same ? '≈ same as before' : (diff > 0 ? '▲ ' : '▼ ') + fmt(Math.abs(diff)) + ' ' + (better ? 'better' : 'worse');
}
export function junctionName(ni) {
  const names = [...new Set(ni.roads.map(r => r.name).filter(Boolean))];
  if (names.length >= 2) return names.slice(0, 2).join(' / ');
  return 'junction #' + ni.node.id;
}
export function worstSpot() {
  let best = null;
  for (const ni of S.net.info.values()) {
    for (const l of ni.inLinks) {
      const q = queueOn(l);
      if (!best || q > best.q) best = { q, ni, link: l };
    }
  }
  return best;
}
export let statusTarget = null;
export function updateStatus(m) {
  const st = $('status');
  let cls = 'st-idle', label = 'Starting up', text = 'Cars are entering the map. Results appear after a minute or two.';
  statusTarget = null;
  if (S.vehicles.length >= 5 || m.n > 0) {
    let stopped = 0; for (const v of S.vehicles) if (v.v < 1) stopped++;
    const frac = S.vehicles.length ? stopped / S.vehicles.length : 0;
    const w = worstSpot();
    if (S.vehicles.length > 30 && m.speed < 3) { cls = 'st-critical'; label = 'Gridlocked'; text = 'Almost nothing is moving. Cars are blocking each other across junctions.'; }
    else if (frac > 0.55 || m.wait > 25) { cls = 'st-serious'; label = 'Congested'; text = Math.round(frac * 100) + '% of cars are stopped' + (m.wait > 25 ? ', and ' + m.wait + ' cannot even get onto the map' : '') + '.'; }
    else if (frac > 0.3 || m.wait > 5) { cls = 'st-warn'; label = 'Busy'; text = 'Traffic moves, but ' + Math.round(frac * 100) + '% of cars are waiting at any moment.'; }
    else { cls = 'st-good'; label = 'Flowing well'; text = 'Most cars move freely. Only ' + Math.round(frac * 100) + '% are stopped right now.'; }
    if (w && w.q >= 6) {
      text += ' Longest queue: ' + w.q + ' cars coming from the ' + compass(-w.link.d.x, -w.link.d.y) + ' at ' + (w.ni.deg >= 3 ? junctionName(w.ni) : 'a merge point') + '.';
      statusTarget = w.ni;
    }
  }
  st.className = 'status ' + cls; $('stLabel').textContent = label; $('stText').textContent = text;
  $('stShow').hidden = !statusTarget;
}
export function updateMetricsUI() {
  const m = currentMetrics();
  $('mThr').innerHTML = Math.round(m.thr) + '<small>/hour</small>';
  $('mDelay').innerHTML = (m.delay >= 90 ? (m.delay / 60).toFixed(1) + '<small>min</small>' : Math.round(m.delay) + '<small>s</small>');
  $('mSpeed').innerHTML = m.speed.toFixed(0) + '<small>km/h</small>';
  $('mWait').innerHTML = m.wait + '<small>cars</small>';
  $('mFoot').textContent = m.veh + ' cars on the roads · ' + S.completed + ' trips finished · averages over the last ' + (Math.min(m.span, WINDOW) / 60).toFixed(1) + ' min';
  if (S.baseline) {
    setDelta('dThr', m.thr, S.baseline.thr, true, v => Math.round(v) + '/h');
    setDelta('dDelay', m.delay, S.baseline.delay, false, v => Math.round(v) + ' s');
    setDelta('dSpeed', m.speed, S.baseline.speed, true, v => v.toFixed(0) + ' km/h');
    setDelta('dWait', m.wait, S.baseline.wait, false, v => Math.round(v) + '');
  } else ['dThr', 'dDelay', 'dSpeed', 'dWait'].forEach(id => { $(id).textContent = ''; });
  updateStatus(m);
  $('clock').textContent = fmtClock(S.simTime) + (ui.running ? '' : ' paused');
  if (!$('pane-results').hidden) {
    drawChart('chThr', 'tipThr', S.history.map(h => [h.t, h.thr]), v => Math.round(v) + ' cars/h', S.baseline && S.baseline.thr);
    drawChart('chDelay', 'tipDelay', S.history.map(h => [h.t, h.delay]), v => Math.round(v) + ' s', S.baseline && S.baseline.delay);
  }
  if (S.selection) updateInspectorStats();
}

/** Wires this module's part of the page. Called once by startEngine(). */
export function initResults() {
  $('saveBase').onclick = () => {
    const m = currentMetrics(); if (m.span < 180 || m.n < 5) { toast('Let it run at least 3 minutes after the last change so the numbers settle. Try the 10× speed.'); return; }
    S.baseline = Object.assign({ at: S.simTime }, m); renderBaseline();
  };
  $('clearBase').onclick = () => { S.baseline = null; renderBaseline(); };
  $('stShow').onclick = () => {
    if (!statusTarget) return;
    cam.x = statusTarget.node.x; cam.y = statusTarget.node.y; cam.z = Math.max(cam.z, 1.6);
    setTool('select'); select({ type: 'node', id: statusTarget.node.id });
  };
}
