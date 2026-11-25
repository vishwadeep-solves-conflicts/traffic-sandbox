/**
 * The shared, changing state of the simulation. These values are reassigned from several
 * modules, so they live on one object instead of as separate exported variables.
 */
export const S = {
  /** next id for nodes and roads */
  uid: 1,
  /** the derived network (see network.js), rebuilt after every edit */
  net: { links: [], linkById: new Map(), info: new Map(), sources: [], sinks: [], conns: new Map(), dist: null, ffDist: null },
  vehicles: [],
  /** next vehicle id */
  vid: 1,
  /** simulated seconds since the network was loaded */
  simTime: 0,

  // metrics
  /** finished trips: {t, tt, delay} */
  trips: [],
  metricsStart: 0,
  completed: 0,
  lost: 0,
  /** samples for the charts, every 10 s */
  history: [],
  lastRoute: 0,
  lastSample: 0,
  lastSpd: 0,
  /** the saved "before" numbers */
  baseline: null,

  // map interaction
  /** {type: 'node' | 'road', id} */
  selection: null,
  hover: null,
  /** node id while drawing a road */
  drawFrom: null,
  arrowFast: false,
};
