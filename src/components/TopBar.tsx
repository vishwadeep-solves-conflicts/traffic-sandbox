/** Scenario picker, play/pause, speed, clock and the traffic slider. The engine wires the controls by id. */
export default function TopBar() {
  return (
    <header id="top">
      <div className="brand">
        <span className="sign">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="5" y="1" width="6" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
            <circle cx="8" cy="4.5" r="1.3" fill="currentColor" />
            <circle cx="8" cy="8" r="1.3" fill="currentColor" />
            <circle cx="8" cy="11.5" r="1.3" fill="currentColor" />
          </svg>
        </span>
        Traffic Sandbox
      </div>
      <div className="grp">
        <select id="preset" className="ctl" aria-label="Scenario" defaultValue="grid">
          <option value="grid">City grid, 9 signals</option>
          <option value="arterial">Main road with side streets</option>
          <option value="single">Single crossroads</option>
          <option value="busy">Overloaded crossroads</option>
          <option value="bottleneck">Lane drop bottleneck</option>
          <option value="blank">Blank canvas</option>
        </select>
      </div>
      <div className="grp">
        <button id="play">
          <svg id="playIcon" width="14" height="14" viewBox="0 0 14 14">
            <rect x="2" y="1" width="3.5" height="12" rx="1" fill="currentColor" />
            <rect x="8.5" y="1" width="3.5" height="12" rx="1" fill="currentColor" />
          </svg>
          <span id="playLbl">Pause</span>
        </button>
        <div className="seg" id="speeds" role="group" aria-label="Simulation speed" />
        <span id="clock">0:00:00</span>
      </div>
      <div className="grp">
        <span className="lbl">Traffic</span>
        <input type="range" id="volume" min="0" max="300" step="5" defaultValue="100" aria-label="Traffic volume" />
        <span className="val" id="volumeV" style={{ minWidth: 42 }}>
          100%
        </span>
      </div>
      <div className="spacer" />
      <button className="btn" id="helpBtn">
        How it works
      </button>
    </header>
  );
}
