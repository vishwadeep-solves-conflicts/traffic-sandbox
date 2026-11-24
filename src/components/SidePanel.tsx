import ResultsPane from "./ResultsPane";
import DataPane from "./DataPane";

/** Results, Edit and Map & settings tabs. The Edit tab's inspector is built by panels/inspector.js. */
export default function SidePanel() {
  return (
    <aside id="panel">
      <div id="tabs" role="tablist">
        <button data-tab="results" className="on" role="tab">
          Results
        </button>
        <button data-tab="edit" role="tab">
          Edit
        </button>
        <button data-tab="data" role="tab">
          Map &amp; settings
        </button>
      </div>
      <ResultsPane />
      <section className="pane" id="pane-edit" hidden>
        <div id="inspector" />
      </section>
      <DataPane />
    </aside>
  );
}
