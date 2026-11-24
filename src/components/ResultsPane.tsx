const TILES = [
  { k: "Cars getting through", v: "mThr", unit: "/hour", d: "dThr" },
  { k: "Time lost per trip", v: "mDelay", unit: "s", d: "dDelay" },
  { k: "Average speed", v: "mSpeed", unit: "km/h", d: "dSpeed" },
  { k: "Stuck at entry", v: "mWait", unit: "cars", d: "dWait" },
];

/** Live status, the four headline numbers, before/after comparison and charts. Updated by panels/results.js. */
export default function ResultsPane() {
  return (
    <section className="pane" id="pane-results">
      <div className="status st-idle" id="status">
        <span className="pill">
          <i />
          <span id="stLabel">Starting up</span>
        </span>
        <p id="stText">Cars are entering the map.</p>
        <button className="linkbtn" id="stShow" hidden>
          Show me where
        </button>
      </div>
      <div className="tiles">
        {TILES.map((t) => (
          <div className="tile" key={t.v}>
            <span className="k">{t.k}</span>
            <span className="v" id={t.v} dangerouslySetInnerHTML={{ __html: `0<small>${t.unit}</small>` }} />
            <span className="delta" id={t.d} />
          </div>
        ))}
      </div>
      <div className="small" id="mFoot">
        0 cars on the roads · 0 trips finished · averages over the last 5 minutes
      </div>
      <div className="compare">
        <h2>Before and after</h2>
        <div className="small" id="baseInfo">
          Save the current numbers as "before", change something on the map, let it run 3 minutes, then compare.
        </div>
        <div className="btns">
          <button className="btn primary" id="saveBase">
            Save as before
          </button>
          <button className="btn" id="clearBase" hidden>
            Clear
          </button>
        </div>
      </div>
      <div className="chart">
        <span className="t">Cars getting through, per hour</span>
        <canvas id="chThr" />
        <span className="ctip" id="tipThr" hidden />
      </div>
      <div className="chart">
        <span className="t">Time lost per trip, seconds</span>
        <canvas id="chDelay" />
        <span className="ctip" id="tipDelay" hidden />
      </div>
      <div className="warn small" id="gridlock" hidden />
    </section>
  );
}
