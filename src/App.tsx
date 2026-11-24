import { useEffect } from "react";
import AppBar from "./shared/AppBar";
import TopBar from "./components/TopBar";
import MapStage from "./components/MapStage";
import SidePanel from "./components/SidePanel";
import { startEngine } from "./startEngine.js";

let started = false;

/**
 * React lays out the page once; the simulation engine then takes over the canvas and
 * the live panels by element id. App has no state, so React never re-renders the parts
 * the engine updates.
 */
export default function App() {
  useEffect(() => {
    // React's development mode runs effects twice; the engine must start only once
    if (started) return;
    started = true;
    startEngine();
  }, []);

  return (
    <div id="app">
      <AppBar title="Traffic Sandbox" />
      <TopBar />
      <div id="main">
        <MapStage />
        <SidePanel />
      </div>
    </div>
  );
}
