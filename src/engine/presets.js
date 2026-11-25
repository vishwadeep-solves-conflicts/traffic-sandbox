/**
 * The built-in example networks.
 */
import { resetHistory } from './history.js';
import { addNode, addRoad, clearModel } from './model.js';
import { rebuild } from './network.js';
import { resetMetrics } from './simulation.js';
import { S } from './state.js';
import { select } from '../map/input.js';
import { fitView } from '../map/view.js';

export function loadPreset(name) {
  clearModel(); S.vehicles = []; S.simTime = 0; S.lastRoute = 0; S.lastSpd = 0; S.net.info = new Map(); S.net.linkById = new Map();
  const N = (x, y, e) => addNode(x, y, e), R = (a, b, lf, lb, sp) => addRoad(a.id, b.id, lf, lb, sp, { kind: sp >= 80 ? 'highway' : lf >= 2 ? 'arterial' : 'street' });
  if (name === 'busy') {
    const c = N(0, 0), w = N(-420, 0, { demand: 1100 }), e = N(420, 0, { demand: 1100 }), n = N(0, -320, { demand: 450 }), s = N(0, 320, { demand: 450 });
    R(w, c, 2, 2, 60); R(c, e, 2, 2, 60); R(n, c, 1, 1, 40); R(c, s, 1, 1, 40);
  } else if (name === 'single') {
    const c = N(0, 0), w = N(-320, 0, { demand: 650 }), e = N(320, 0, { demand: 650 }), n = N(0, -320, { demand: 300 }), s = N(0, 320, { demand: 300 });
    c.green = 25; R(w, c, 2, 2, 60); R(c, e, 2, 2, 60); R(n, c, 1, 1, 40); R(c, s, 1, 1, 40);
  } else if (name === 'grid') {
    const sp = 220, g = [];
    for (let i = 0; i < 3; i++) { g.push([]); for (let j = 0; j < 3; j++) g[i].push(N((j - 1) * sp, (i - 1) * sp, { green: 20 })); }
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { if (j < 2) R(g[i][j], g[i][j + 1], 1, 1, 50); if (i < 2) R(g[i][j], g[i + 1][j], 1, 1, 50); }
    const arm = 200, dem = 220;
    for (let k = 0; k < 3; k++) {
      R(N((k - 1) * sp, -sp - arm, { demand: dem }), g[0][k], 1, 1, 50); R(g[2][k], N((k - 1) * sp, sp + arm, { demand: dem }), 1, 1, 50);
      R(N(-sp - arm, (k - 1) * sp, { demand: dem }), g[k][0], 1, 1, 50); R(g[k][2], N(sp + arm, (k - 1) * sp, { demand: dem }), 1, 1, 50);
    }
  } else if (name === 'arterial') {
    const xs = [-450, -150, 150, 450];
    const W = N(-750, 0, { demand: 900 }), E = N(750, 0, { demand: 900 });
    let prev = W;
    for (const x of xs) {
      const j = N(x, 0, { green: 30 });
      R(prev, j, 2, 2, 60); prev = j;
      R(N(x, -260, { demand: 220 }), j, 1, 1, 40); R(j, N(x, 260, { demand: 220 }), 1, 1, 40);
    }
    R(prev, E, 2, 2, 60);
  } else if (name === 'bottleneck') {
    const W = N(-700, 0, { demand: 1500 }), a = N(-250, 0), b = N(150, 0), c = N(450, 0, { control: 'priority' }), E = N(800, 0, { demand: 300 });
    R(W, a, 3, 3, 80); R(a, b, 3, 3, 80); R(b, c, 1, 1, 60); R(c, E, 1, 1, 60);
    R(N(450, -250, { demand: 250 }), c, 1, 1, 40);
  }
  rebuild(false);
  resetMetrics(); S.completed = 0; S.lost = 0;
  fitView(); select(null); resetHistory();
}
