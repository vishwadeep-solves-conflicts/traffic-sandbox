/**
 * Map & settings tab: OpenStreetMap import and saving or loading a network.
 */
import { exportJSON, importJSON, importOSM, parseOSMXML } from '../engine/importExport.js';
import { $, toast } from './dom.js';

export function importOSMText(text) {
  text = text.trim();
  try { if (text[0] === '<') importOSM(parseOSMXML(text)); else { const d = JSON.parse(text); if (d.elements) importOSM(d); else importJSON(text); } }
  catch (e) { toast('Could not import that map: ' + e.message); }
}

/** Wires this module's part of the page. Called once by startEngine(). */
export function initDataPane() {
  $('exportBtn').onclick = () => { $('jsonBox').value = exportJSON(); };
  $('copyBtn').onclick = async () => { $('jsonBox').value = exportJSON(); try { await navigator.clipboard.writeText($('jsonBox').value); toast('Copied the network as text.'); } catch (e) { $('jsonBox').select(); toast('Text selected; press Ctrl or Cmd + C to copy.'); } };
  $('importBtn').onclick = () => { try { importJSON($('jsonBox').value); toast('Network loaded.'); } catch (e) { toast('Could not load that text: ' + e.message); } };
  $('osmBtn').onclick = () => importOSMText($('osmBox').value);
  $('osmFile').onchange = e => { const f = e.target.files[0]; if (!f) return; f.text().then(importOSMText); };
}
