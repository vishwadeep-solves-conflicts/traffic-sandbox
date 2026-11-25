/** Type, lanes and speed for new roads. Shown while the Road or Flyover tool is active. */
export default function DrawOptions() {
  return (
    <div id="drawOpts" hidden>
      <div className="lbl">New road type</div>
      <div className="chips" id="kindChips" />
      <div className="row">
        <select id="newLanes" className="ctl" aria-label="Lanes" defaultValue="1">
          <option value="1">1 lane each way</option>
          <option value="2">2 lanes each way</option>
          <option value="3">3 lanes each way</option>
          <option value="o1">One-way, 1 lane</option>
          <option value="o2">One-way, 2 lanes</option>
          <option value="o3">One-way, 3 lanes</option>
        </select>
        <select id="newSpeed" className="ctl" aria-label="Speed limit" defaultValue="50">
          {[20, 30, 40, 50, 60, 80, 100].map((s) => (
            <option key={s} value={s}>
              {s} km/h
            </option>
          ))}
        </select>
      </div>
      <select id="newKind" hidden defaultValue="street">
        <option value="highway">Highway</option>
        <option value="arterial">Main road</option>
        <option value="street">Street</option>
        <option value="service">Service road</option>
      </select>
    </div>
  );
}
