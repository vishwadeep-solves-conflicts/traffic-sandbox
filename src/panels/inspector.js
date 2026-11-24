/**
 * The Edit tab: settings for the selected road, junction or entry point.
 */
import { ALLRED, KINDS, YELLOW } from '../engine/constants.js';
import { greenFor } from '../engine/control.js';
import { afterEdit, commitHistory } from '../engine/history.js';
import { addServiceRoad, armsOf, compass, deleteNode, deleteRoad, makeFlyover, model, movementType, oppositePairs, setMovementRule, toggleMovement } from '../engine/model.js';
import { queueOn, resetMetrics } from '../engine/simulation.js';
import { S } from '../engine/state.js';
import { $, esc, toast } from './dom.js';
import { junctionName } from './results.js';

export const CONTROL_NAMES = { signal: 'Traffic signal, fixed timing', adaptive: 'Smart signal, reacts to queues', stop: 'All-way stop', priority: 'Give way to the main road', none: 'No control (optimistic)' };
export const CONTROL_HELP = {
  signal: 'Each direction gets its green in turn, then 3 s amber and 1.5 s all-red.',
  adaptive: 'Green ends early once its queue clears and skips directions with nobody waiting. The green time below is the maximum.',
  stop: 'Every car stops, then they go one at a time in arrival order. Low capacity.',
  priority: 'Cars on the main road (most lanes, highest type) go freely. Others wait for a safe gap.',
  none: 'Cars cross whenever there is space ahead. Crashes are not modelled, so this is a best case.',
};
export function renderInspector() {
  const el = $('inspector');
  if (!S.selection || (S.selection.type === 'node' && !model.nodes.has(S.selection.id)) || (S.selection.type === 'road' && !model.roads.has(S.selection.id))) {
    S.selection = null;
    el.innerHTML = `<div class="empty"><h2>Nothing selected</h2><p style="margin:0">Click something on the map to change it.</p>
      <ul><li><b>A junction</b>: switch signals or stop signs, change green times, ban turns, or build a flyover.</li>
      <li><b>A road</b>: lanes in each direction, speed limit, road type, flyover, add a service road.</li>
      <li><b>A blue entry point</b>: how many cars arrive there per hour.</li></ul>
      <p class="small" style="margin:0">To add new roads, pick Road or Flyover in the tools on the left of the map.</p></div>`;
    return;
  }
  let html = '';
  if (S.selection.type === 'node') {
    const n = model.nodes.get(S.selection.id), ni = S.net.info.get(n.id);
    if (!ni) { el.innerHTML = ''; return; }
    if (ni.deg === 1) {
      html += `<div class="ins-head"><span class="name">Entry and exit point</span><span class="meta">Cars appear and leave the map here</span></div>
        <div class="field"><label for="iDem">Cars arriving per hour</label><div class="row"><input type="range" id="iDem" min="0" max="2000" step="25" value="${n.demand}"><span class="val" id="iDemV">${n.demand}/h</span></div>
        <span class="small">Busier points also attract more trips. The Traffic slider at the top scales every point.</span></div>
        <div class="live" id="iStats"></div>`;
    } else if (ni.deg === 2) {
      html += `<div class="ins-head"><span class="name">${n.elevated ? 'Flyover joint' : 'Bend'}</span><span class="meta">Two roads meet here, so no control is needed</span></div>
        <p class="small" style="margin:0">Draw a third road into this point to turn it into a junction.</p>`;
    } else {
      html += `<div class="ins-head"><span class="name">${esc(junctionName(ni)[0].toUpperCase() + junctionName(ni).slice(1))}</span><span class="meta">${ni.deg} roads meet here</span></div>
        <div class="live" id="iStats"></div>
        <div class="field"><label for="iCtl">How it is controlled</label><select id="iCtl" class="ctl">${Object.keys(CONTROL_NAMES).map(k => `<option value="${k}" ${n.control === k ? 'selected' : ''}>${CONTROL_NAMES[k]}</option>`).join('')}</select>
        <span class="small">${CONTROL_HELP[n.control]}</span></div>`;
      if ((n.control === 'signal' || n.control === 'adaptive') && ni.phases.length >= 2) {
        const lostT = ni.phases.length * (YELLOW + ALLRED);
        const cyc = ni.phases.reduce((a, _, p) => a + greenFor(ni, p), 0) + lostT;
        html += `<div class="box"><h3>Green time per direction</h3><span class="small">One full cycle takes <b>${Math.round(cyc)} s</b>. Give more green to the busier direction.</span>`;
        ni.phases.forEach((ph, p) => {
          const label = 'Traffic from ' + ph.map(l => compass(-l.d.x, -l.d.y)).join(' and ');
          html += `<div class="phase"><span class="small">${label}</span><div class="row"><input type="range" data-ph="${p}" min="5" max="90" value="${greenFor(ni, p)}" aria-label="${label} green time"><span class="val" id="iPhV${p}">${greenFor(ni, p)} s</span></div></div>`;
        });
        html += `</div>`;
      }
      const arms = armsOf(n.id), pairs = oppositePairs(arms), bans = new Set(n.bans || []);
      const nearWord = model.driveSide === 'right' ? 'right' : 'left', farWord = nearWord === 'right' ? 'left' : 'right';
      html += `<div class="box"><h3>Which way can cars go?</h3><div class="btns"><button class="btn" data-rule="all">Allow everything</button><button class="btn" data-rule="noFar" title="Ban turns that cut across oncoming traffic">No ${farWord} turns</button>`;
      pairs.forEach((pr, i) => {
        const ax = pr[0].name + '–' + pr[1].name;
        html += `<button class="btn" data-rule="axisOnly" data-pair="${i}" title="Only straight-through traffic along ${ax}; other roads are closed here">Only ${ax} straight through</button>
          <button class="btn" data-rule="median" data-pair="${i}" title="A divider along ${ax}: it goes straight, everyone may turn ${nearWord}, nobody crosses it">Divider on ${ax}</button>
          <button class="btn" data-rule="noCross" data-pair="${i}" title="Traffic on ${ax} may turn here but not go straight across">Stop ${ax} going straight across</button>`;
      });
      const ins = arms.filter(x => x.canIn), outs = arms.filter(x => x.canOut);
      html += `</div><div style="overflow-x:auto"><table class="mv"><tr><td>from ↓ to →</td>${outs.map(b => `<td>${b.name}</td>`).join('')}</tr>`;
      for (const a of ins) {
        html += `<tr><td>${a.name}</td>`;
        for (const b of outs) {
          if (a === b) { html += '<td style="color:var(--muted)">·</td>'; continue; }
          const k = a.road.id + '>' + b.road.id;
          html += `<td><input type="checkbox" data-mv="${k}" ${bans.has(k) ? '' : 'checked'} aria-label="${a.name} to ${b.name}" title="${a.name} → ${b.name} (${movementType(a, b)})"></td>`;
        }
        html += '</tr>';
      }
      html += `</table></div><span class="small">Unticked turns are banned; drivers find another route.</span></div>`;
      if (pairs.length) {
        html += `<div class="box"><h3>Build a flyover</h3><span class="small">Straight-through traffic goes over the junction. Turning traffic uses one-way service roads underneath and the junction below.</span><div class="btns">`;
        pairs.forEach((pr, i) => { html += `<button class="btn primary" data-fly="${i}">Flyover ${pr[0].name}–${pr[1].name}</button>`; });
        html += `</div></div>`;
      }
    }
    html += `<div class="btns"><button class="btn danger" id="iDel">Delete this point</button></div>`;
    el.innerHTML = html;
    if ($('iDem')) { $('iDem').oninput = e => { n.demand = +e.target.value; $('iDemV').textContent = n.demand + '/h'; }; $('iDem').onchange = () => { resetMetrics(); commitHistory(); }; }
    if ($('iCtl')) $('iCtl').onchange = e => { n.control = e.target.value; afterEdit(false); };
    el.querySelectorAll('[data-ph]').forEach(inp => {
      inp.oninput = e => { const p = +e.target.dataset.ph; if (!n.phaseGreens || n.phaseGreens.length !== ni.phases.length) n.phaseGreens = ni.phases.map((_, k) => greenFor(ni, k)); n.phaseGreens[p] = +e.target.value; $('iPhV' + p).textContent = e.target.value + ' s'; };
      inp.onchange = () => { resetMetrics(); renderInspector(); commitHistory(); };
    });
    if (ni.deg >= 3) {
      const arms = armsOf(n.id), pairs = oppositePairs(arms);
      el.querySelectorAll('[data-rule]').forEach(b => b.onclick = () => {
        setMovementRule(n.id, b.dataset.rule, b.dataset.pair != null ? pairs[+b.dataset.pair] : null);
        if (b.dataset.rule === 'axisOnly' || b.dataset.rule === 'median') toast('Turns updated. With fewer conflicts, "Give way" control often works better than signals here.');
        afterEdit();
      });
      el.querySelectorAll('[data-mv]').forEach(c => c.onchange = () => { const [f, t] = c.dataset.mv.split('>'); toggleMovement(n.id, f, t); afterEdit(); });
      el.querySelectorAll('[data-fly]').forEach(b => b.onclick = () => { if (makeFlyover(n.id, pairs[+b.dataset.fly])) { afterEdit(); toast('Flyover built. Straight traffic goes over; turning traffic uses the service roads below.'); } });
    }
  } else {
    const r = model.roads.get(S.selection.id), A = model.nodes.get(r.a), B = model.nodes.get(r.b);
    const L = Math.hypot(B.x - A.x, B.y - A.y);
    const dirAB = compass(B.x - A.x, B.y - A.y), dirBA = compass(A.x - B.x, A.y - B.y);
    const opt = (v) => [0, 1, 2, 3, 4].map(k => `<option value="${k}" ${k === v ? 'selected' : ''}>${k}</option>`).join('');
    const flyEnds = [];
    for (const endId of [r.a, r.b]) {
      const eni = S.net.info.get(endId); if (!eni || eni.deg < 3 || r.elevated) continue;
      const pr = oppositePairs(armsOf(endId)).find(p => p.some(a => a.road.id === r.id));
      if (pr) flyEnds.push({ node: endId, pair: pr, dir: compass(model.nodes.get(endId).x - (endId === r.a ? B.x : A.x), model.nodes.get(endId).y - (endId === r.a ? B.y : A.y)) });
    }
    html += `<div class="ins-head"><span class="name">${r.name ? esc(r.name) : (KINDS[r.kind] || KINDS.street).label}${r.elevated ? ' (flyover)' : ''}</span><span class="meta">${Math.round(L)} m long</span></div>
      <div class="live" id="iStats"></div>
      <div class="field"><span class="flabel">Lanes</span><div class="row"><label class="small" for="iLF">heading ${dirAB}</label><select id="iLF" class="ctl">${opt(r.lanesF)}</select><label class="small" for="iLB">heading ${dirBA}</label><select id="iLB" class="ctl">${opt(r.lanesB)}</select></div>
        <span class="small">Set one direction to 0 for a one-way road.</span></div>
      <div class="field"><label for="iSp">Speed limit</label><div class="row"><input type="range" id="iSp" min="20" max="120" step="10" value="${r.speed}"><span class="val" id="iSpV">${r.speed} km/h</span></div></div>
      <div class="field"><span class="flabel">Road type</span><div class="chips" id="iKinds">${Object.keys(KINDS).map(k => `<button class="chip ${r.kind === k ? 'on' : ''}" data-k="${k}">${KINDS[k].label}</button>`).join('')}</div>
        <span class="small">At give-way junctions the higher type has priority: highway, main road, street, service road.</span></div>
      <label class="check"><input type="checkbox" id="iElev" ${r.elevated ? 'checked' : ''}> Flyover or bridge (passes over the roads it crosses)</label>
      ${flyEnds.length ? `<div class="box"><h3>Take this road over a junction</h3><span class="small">Builds a flyover for straight-through traffic, with one-way service roads below for turning traffic.</span><div class="btns">${flyEnds.map((f, i) => `<button class="btn primary" data-flyend="${i}">Flyover over the ${f.dir} junction</button>`).join('')}</div></div>` : ''}
      <div class="btns"><button class="btn" id="iSvc2">Service roads on both sides</button><button class="btn" id="iSvc">Service road on one side</button>${r.lanesB === 0 || r.lanesF === 0 ? '<button class="btn" id="iRev">Reverse one-way direction</button>' : ''}<button class="btn danger" id="iDel">Delete road</button></div>`;
    el.innerHTML = html;
    const setLanes = () => {
      const lf = +$('iLF').value, lb = +$('iLB').value;
      if (lf + lb === 0) { toast('A road needs at least one lane.'); renderInspector(); return; }
      r.lanesF = lf; r.lanesB = lb; afterEdit();
    };
    $('iLF').onchange = setLanes; $('iLB').onchange = setLanes;
    $('iSp').oninput = e => { $('iSpV').textContent = e.target.value + ' km/h'; };
    $('iSp').onchange = e => { r.speed = +e.target.value; afterEdit(false); };
    el.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { r.kind = b.dataset.k; delete r.rank; afterEdit(false); });
    $('iElev').onchange = e => { r.elevated = e.target.checked; afterEdit(false); };
    el.querySelectorAll('[data-flyend]').forEach(b => b.onclick = () => { const f = flyEnds[+b.dataset.flyend]; if (makeFlyover(f.node, f.pair)) { S.selection = { type: 'node', id: f.node }; afterEdit(); toast('Flyover built. To stop cross traffic going straight over the junction below, use "Stop … going straight across" here.'); } });
    $('iSvc2').onclick = () => { if (addServiceRoad(r.id, true)) { S.selection = null; afterEdit(); toast('One-way service roads added on both sides, joined by give-way slip roads at each end.'); } };
    $('iSvc').onclick = () => { if (addServiceRoad(r.id)) { S.selection = null; afterEdit(); toast('Service road added beside it, joined by give-way slip roads at both ends.'); } };
    if ($('iRev')) $('iRev').onclick = () => { [r.lanesF, r.lanesB] = [r.lanesB, r.lanesF]; afterEdit(); };
  }
  $('iDel').onclick = () => { if (S.selection.type === 'node') deleteNode(S.selection.id); else deleteRoad(S.selection.id); S.selection = null; afterEdit(); };
  updateInspectorStats();
}
export function updateInspectorStats() {
  const el = $('iStats'); if (!el || !S.selection) return;
  const T2 = Math.max(1, S.simTime - S.metricsStart);
  if (S.selection.type === 'road') {
    const ls = S.net.links.filter(l => l.road.id === S.selection.id);
    el.innerHTML = ls.map(l => {
      let n = 0, sv = 0; for (const ln of l.lanes) for (const v of ln.veh) { n++; sv += v.v; }
      return 'heading ' + compass(l.d.x, l.d.y) + ': ' + n + ' cars, ' + (n ? (sv / n * 3.6).toFixed(0) + ' km/h' : '–') + ', ' + Math.round(l.countIn / T2 * 3600) + '/h';
    }).join('<br>') || 'no lanes';
  } else {
    const ni = S.net.info.get(S.selection.id); if (!ni) return;
    if (ni.deg === 1) el.textContent = ni.pending.length + ' cars stuck waiting to enter';
    else {
      let q = 0; for (const l of ni.inLinks) q += queueOn(l);
      const flow = ni.inLinks.reduce((a, l) => a + l.countIn, 0) / T2 * 3600;
      el.textContent = 'now: ' + q + ' cars waiting · ' + Math.round(flow) + ' cars/h through';
    }
  }
}
