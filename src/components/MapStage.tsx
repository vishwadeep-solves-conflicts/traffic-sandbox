import ToolRail from "./ToolRail";
import DrawOptions from "./DrawOptions";
import MapLegend from "./MapLegend";
import MapOverlays from "./MapOverlays";

export default function MapStage() {
  return (
    <div id="stage">
      <canvas id="cv" />
      <ToolRail />
      <DrawOptions />
      <MapLegend />
      <MapOverlays />
    </div>
  );
}
