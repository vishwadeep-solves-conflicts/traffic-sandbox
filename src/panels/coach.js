/**
 * The quick-start guide shown on the first visit.
 */
import { $ } from './dom.js';

export const COACH = [
  ['This is a live traffic simulation', 'Each little rectangle is a car. Red tail lights mean the car is stopped. Roads turn amber or red where traffic is slow or jammed, and red bubbles show how many cars are queuing.'],
  ['Change the roads with the tools on the left', 'Draw a road or a flyover by clicking point to point. Click an existing road to join it. Delete removes roads and junctions.'],
  ['Click any junction or road to edit it', 'Junctions: switch signals, change green times, ban turns, or build a flyover. Roads: lanes, speed and type. Hover first to see live numbers.'],
  ['See if it helped', 'Press "Save as before" on the Results tab, make your change, run it for 3 minutes (10× speed helps), and the numbers show what got better or worse.'],
];
export let coachI = 0;
export function showCoach(i) {
  coachI = i; if (i >= COACH.length) { $('coach').hidden = true; try { localStorage.setItem('ts-coach', '1'); } catch (e) {} return; }
  $('coach').hidden = false; $('coachStep').textContent = (i + 1) + ' of ' + COACH.length;
  $('coachTitle').textContent = COACH[i][0]; $('coachText').textContent = COACH[i][1];
  $('coachNext').textContent = i === COACH.length - 1 ? 'Start' : 'Next';
}

/** Wires this module's part of the page. Called once by startEngine(). */
export function initCoach() {
  $('coachNext').onclick = () => showCoach(coachI + 1);
  $('coachSkip').onclick = () => showCoach(COACH.length);
  $('helpBtn').onclick = () => showCoach(0);
}
