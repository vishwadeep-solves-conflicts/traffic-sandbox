const OVERPASS_QUERY = `[out:json][timeout:25];
way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link|service)$"]({{bbox}});
(._;>;);
out body;`;

/** Simulation settings, OpenStreetMap import, and saving or loading a network. */
export default function DataPane() {
  return (
    <section className="pane" id="pane-data" hidden>
      <div className="box">
        <h3>Simulation</h3>
        <label className="check">
          <input type="checkbox" id="heat" defaultChecked /> Colour roads by congestion
        </label>
        <label className="check">
          <input type="checkbox" id="smart" defaultChecked /> Drivers re-route around jams
        </label>
        <label className="check">
          <input type="checkbox" id="snap" defaultChecked /> Snap new points to a 5 m grid
        </label>
        <div className="row">
          <span className="small">Cars drive on the</span>
          <select id="side" className="ctl" defaultValue="right">
            <option value="right">right</option>
            <option value="left">left</option>
          </select>
        </div>
        <div className="btns">
          <button className="btn" id="optimize" title="Retime every signal from the traffic measured so far (Webster's method)">
            Retime all signals
          </button>
          <button className="btn" id="clearVeh">
            Remove all cars
          </button>
          <button className="btn" id="resetM">
            Reset results
          </button>
        </div>
      </div>
      <div className="box">
        <h3>Real map (OpenStreetMap)</h3>
        <p className="small" style={{ margin: 0 }}>
          Open{" "}
          <a href="https://overpass-turbo.eu/" target="_blank" rel="noopener">
            overpass-turbo.eu
          </a>{" "}
          (overpass-turbo.eu), zoom to an area about 1 km across, run the query below, then Export → raw OSM data, and
          upload or paste it here.
        </p>
        <textarea id="ovq" readOnly style={{ height: 82 }} defaultValue={OVERPASS_QUERY} />
        <input type="file" id="osmFile" accept=".json,.osm,.xml,.txt" />
        <textarea id="osmBox" placeholder="…or paste Overpass JSON / OSM XML here" />
        <div className="btns">
          <button className="btn" id="osmBtn">
            Import pasted map
          </button>
        </div>
      </div>
      <div className="box">
        <h3>Save or load this network</h3>
        <div className="btns">
          <button className="btn" id="exportBtn">
            Show as text
          </button>
          <button className="btn" id="copyBtn">
            Copy
          </button>
          <button className="btn" id="importBtn">
            Load from text
          </button>
        </div>
        <textarea id="jsonBox" placeholder="Network text appears here. Paste one and press Load." />
      </div>
      <p className="small" style={{ margin: 0 }}>
        Keys: Ctrl+Z undo, Ctrl+Shift+Z redo, V select, H hand, arrow keys move the map (Shift for faster), + and − zoom, R
        road, F flyover, D delete, Space pause, Esc stop drawing, Del delete selection. Scroll to zoom, drag empty map to
        pan.
      </p>
    </section>
  );
}
