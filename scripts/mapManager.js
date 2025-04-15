// scripts/mapManager.js

let mapSvg = null;
let projection = null;

console.log("mapManager.js is loading...");

function initMap() {
  console.log("initMap is defined.");
  const mapContainer = d3.select("#mapViewport");
  mapContainer.selectAll("svg").remove(); // remove old

  const width = mapContainer.node().clientWidth;
  const height = mapContainer.node().clientHeight;

  mapSvg = mapContainer.append("svg")
    .attr("width", width)
    .attr("height", height);

  projection = d3.geoMercator()
    .scale(700)
    .translate([width / 2, height / 2])
    .center([-95, 40]);  // approximate center of US

  // Only show station circles if we're in Level 1
  if (appState.currentLevel === 1) {
    renderLevel1Stations();
  }
}

function renderLevel1Stations() {
  if (!mapSvg || !projection) return;

  const stationData = appState.stations;

  const stationGroup = mapSvg.append("g").attr("class", "station-group");

  stationGroup.selectAll("circle")
    .data(stationData)
    .enter()
    .append("circle")
    .attr("cx", d => projection([d.lng, d.lat])[0])
    .attr("cy", d => projection([d.lng, d.lat])[1])
    .attr("r", d => Math.sqrt(d.total_routes) * 0.5) // scale by total_routes
    .attr("fill", "steelblue")
    .attr("stroke", "#333")
    .attr("stroke-width", 1)
    .on("mouseover", (event, d) => {
      console.log(`Hovered station: ${d.station_code} (Routes: ${d.total_routes})`);
    })
    .on("click", (event, d) => {
      console.log(`Clicked station: ${d.station_code}`);
      // Future: setLevel(2); appState.selectedStation = d.station_code;
      // Then re-render map, etc.
    });
}
