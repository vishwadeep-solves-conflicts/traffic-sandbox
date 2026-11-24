/**
 * Fixed numbers and lookup tables: lane width, time step, signal timings, road types.
 */
// Units: metres and seconds. Screen y points down (north = -y).

export const LW = 3.5;            // lane width (m)
export const DT = 0.1;             // sim step (s)
export const YELLOW = 3, ALLRED = 1.5;
export const SAT_FLOW = 1600;      // veh/h/lane, for signal optimisation
export const WINDOW = 300;         // metrics rolling window (s)

// Road types: default lanes per direction, speed (km/h), priority rank, surface colour.
export const KINDS = {
  highway:  { label: 'Highway',      lanes: 3, speed: 100, rank: 9, color: '#353b43' },
  arterial: { label: 'Main road',    lanes: 2, speed: 60,  rank: 6, color: '#3b4149' },
  street:   { label: 'Street',       lanes: 1, speed: 50,  rank: 3, color: '#3b4149' },
  service:  { label: 'Service road', lanes: 1, speed: 30,  rank: 1, color: '#454a50' },
};
export const PALETTE = ['#3d6fb6', '#b8473a', '#2f8f6b', '#6b5b95', '#d08a1f', '#55606b', '#1f7a8c', '#a34d6d', '#7a8b2f', '#2d4a73', '#e7e9ec', '#8a5a3c'];
export const HW_CLASS = { motorway: [100, 2, 9], trunk: [80, 2, 8], primary: [60, 1, 7], secondary: [50, 1, 6], tertiary: [40, 1, 5],
  unclassified: [30, 1, 3], residential: [30, 1, 2], living_street: [20, 1, 1], service: [20, 1, 1] };
