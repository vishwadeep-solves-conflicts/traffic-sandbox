/** Hint, hover tooltip, toast and the quick-start guide, all filled in by the engine. */
export default function MapOverlays() {
  return (
    <>
      <div id="hint" />
      <div id="tip" hidden />
      <div id="toast" hidden />
      <div id="coach" hidden>
        <div className="card">
          <div className="step" id="coachStep" />
          <h3 id="coachTitle" />
          <p id="coachText" />
          <div className="btns">
            <button className="btn primary" id="coachNext">
              Next
            </button>
            <button className="btn" id="coachSkip">
              Skip
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
