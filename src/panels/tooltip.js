/**
 * The live numbers shown when hovering over a road or junction.
 */
import { KINDS } from '../engine/constants.js';
import { model } from '../engine/model.js';
import { queueOn, ui } from '../engine/simulation.js';
import { S } from '../engine/state.js';
import { drag } from '../map/input.js';
import { cv } from '../map/view.js';
import { $ } from './dom.js';
import { junctionName } from './results.js';

export function tipHTML(h) {
  const T2 = Math.max(1, S.simTime - S.metricsStart);
  const kv = (k, v) => `<div class="kv"><span>${k}</span><span>${v}</span></div>`;
  if (h.type === 'road') {
    const r = model.roads.get(h.id); if (!r) return null;
    const ls = S.net.links.filter(l => l.road.id === r.id);
    let n = 0, sv = 0, flow = 0; for (const l of ls) { flow += l.countIn; for (const ln of l.lanes) for (const v of ln.veh) { n++; sv += v.v; } }
    const name = (r.name ? r.name.replace(/[<>&]/g, '') : (KINDS[r.kind] || KINDS.street).label) + (r.elevated ? ' (flyover)' : '');
    const lanes = r.lanesF && r.lanesB ? r.lanesF + ' + ' + r.lanesB + ' lanes' : 'one-way, ' + (r.lanesF || r.lanesB) + ' lane' + ((r.lanesF || r.lanesB) > 1 ? 's' : '');
    return `<b>${name}</b>${kv('Lanes', lanes)}${kv('Speed limit', r.speed + ' km/h')}${kv('Cars on it', n)}${kv('Their speed', n ? (sv / n * 3.6).toFixed(0) + ' km/h' : '–')}${kv('Flow', Math.round(flow / T2 * 3600) + ' cars/h')}<div class="note">Click to change lanes, type or speed.</div>`;
  }
  const ni = S.net.info.get(h.id); if (!ni) return null;
  if (ni.deg === 1) return `<b>Entry and exit point</b>${kv('Cars arriving', Math.round(ni.node.demand * ui.demand) + '/h')}${kv('Stuck, cannot enter', ni.pending.length)}<div class="note">Click to change how many cars come in.</div>`;
  if (ni.deg === 2) return `<b>${ni.node.elevated ? 'Flyover joint' : 'Bend'}</b><div class="note">Two roads meet here; no control needed.</div>`;
  let q = 0; for (const l of ni.inLinks) q += queueOn(l);
  const flow = ni.inLinks.reduce((a, l) => a + l.countIn, 0) / T2 * 3600;
  const ctlName = { signal: 'Traffic signal', adaptive: 'Smart signal', stop: 'All-way stop', priority: 'Give way', none: 'No control' }[ni.node.control];
  const bans = (ni.node.bans || []).length;
  return `<b>${junctionName(ni)[0].toUpperCase() + junctionName(ni).slice(1)}</b>${kv('Control', ctlName)}${kv('Cars waiting', q)}${kv('Flow through', Math.round(flow) + ' cars/h')}${bans ? kv('Banned turns', bans) : ''}<div class="note">Click to change signals, ban turns or build a flyover.</div>`;
}

/** Wires this module's part of the page. Called once by startEngine(). */
export function initTooltip() {
  cv.addEventListener('pointermove', e => {
    const tip = $('tip');
    if (drag || !S.hover || ui.tool !== 'select') { tip.hidden = true; return; }
    const html = tipHTML(S.hover); if (!html) { tip.hidden = true; return; }
    tip.innerHTML = html; tip.hidden = false;
    const r = $('stage').getBoundingClientRect();
    let x = e.offsetX + 16, y = e.offsetY + 16;
    if (x + 250 > r.width) x = e.offsetX - 256; if (y + 170 > r.height) y = e.offsetY - 176;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  });
  cv.addEventListener('pointerleave', () => { $('tip').hidden = true; S.hover = null; });
}
