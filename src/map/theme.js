/**
 * Reads the map colours from the CSS variables, and again whenever the theme changes.
 */
export let T = {};
export function readTheme() {
  const cs = getComputedStyle(document.documentElement), g = k => cs.getPropertyValue('--' + k).trim();
  T = {};
  for (const k of ['paper', 'paper-grid', 'block', 'road', 'road-edge', 'road-service', 'road-hwy', 'hwy-edge', 'mark', 'center', 'bridge', 'bridge-edge', 'shadow',
    'ink', 'ink-2', 'muted', 'surface', 'surface-2', 'line', 'accent', 'accent-ink', 'good', 'warn', 'serious', 'critical', 'sig-green', 'sig-amber', 'sig-red', 'sig-body', 'sel'])
    T[k] = g(k);
}

/** Wires this module's part of the page. Called once by startEngine(). */
export function initTheme() {
  readTheme();
  new MutationObserver(readTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}
