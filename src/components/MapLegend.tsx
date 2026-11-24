export default function MapLegend() {
  return (
    <div id="legend">
      <button id="legendToggle">Map key</button>
      <div id="legendBody" style={{ display: "grid", gap: 5 }}>
        <div className="row">
          <span className="ramp" />
          flowing → slow → jammed
        </div>
        <div className="row">
          <span className="lg-car" />
          red tail lights: car stopped
        </div>
        <div className="row">
          <span className="lg-dot" style={{ background: "var(--sig-green)" }} />
          <span className="lg-dot" style={{ background: "var(--sig-red)" }} />
          traffic signal state
        </div>
        <div className="row">
          <span className="lg-dot" style={{ background: "var(--accent)" }} />
          where cars enter and leave
        </div>
      </div>
    </div>
  );
}
