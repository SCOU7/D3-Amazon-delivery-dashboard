// scripts/mapManager.js

let mapSvg = null;
let projection = null;

/**
 * initMap():
 * - Clears any existing SVG in #mapViewport
 * - Creates a new <svg> for the map
 * - Based on appState.currentLevel, calls the appropriate render function.
 */
function initMap() {
  const mapContainer = d3.select("#mapViewport");
  mapContainer.selectAll("svg").remove(); // Clear old map

  const width = mapContainer.node().clientWidth;
  const height = mapContainer.node().clientHeight;

  // Create a new SVG
  mapSvg = mapContainer.append("svg")
    .attr("width", width)
    .attr("height", height);

  // Choose projection & draw based on current level
  if (appState.currentLevel === 1) {
    // Level 1: Nation
    // We'll use a fixed scale & center for the continental US
    projection = d3.geoMercator()
      .scale(700)
      .translate([width / 2, height / 2])
      .center([-95, 40]);

    renderLevel1Stations();
  }
  else if (appState.currentLevel === 2) {
    // Level 2: Station
    // Fit the bounding box of the selected station's stops
    fitMapToStationStops(width, height);
    renderLevel2StationRoutes();
  }
  else if (appState.currentLevel === 3) {
    // Level 3: Route-level (Not yet implemented in this example)
    // In the future, we'll fit bounding box of the selected route's stops, etc.
  }
}

/**
 * renderLevel1Stations():
 * Draws station circles for the entire nation-level view.
 * Each station is sized by its total_routes.
 */
function renderLevel1Stations() {
  if (!mapSvg || !projection) return;

  const stationData = appState.stations; // e.g. [{ station_code, lat, lng, total_routes }, ...]

  const stationGroup = mapSvg.append("g")
    .attr("class", "station-group");

  stationGroup.selectAll("circle.station-circle")
    .data(stationData)
    .enter()
    .append("circle")
    .attr("class", "station-circle")
    .attr("cx", d => projection([d.lng, d.lat])[0])
    .attr("cy", d => projection([d.lng, d.lat])[1])
    .attr("r", d => Math.sqrt(d.total_routes) * 0.5)
    .attr("fill", "steelblue")
    .attr("stroke", "#333")
    .attr("stroke-width", 1)
    .on("mouseover", (event, d) => {
      // Minimal logging; remove if data is large
      console.log(`Hovered station: ${d.station_code} (Routes: ${d.total_routes})`);
    })
    .on("click", (event, d) => {
      // Move to station level
      handleStationClick(d.station_code);
    });
}

/**
 * handleStationClick(stationCode):
 * - Clears old station data in appState
 * - Retrieves preloaded data from appState.stationData[stationCode]
 * - Sets appState fields (stationStops, stationSequences, etc.)
 * - Switches to Level 2 and re-initializes the map
 */
async function handleStationClick(stationCode) {
  console.log(`Station ${stationCode} clicked. Transitioning to Level 2...`);
  clearStationData(); // function from stateManager.js

  const stationObj = appState.stationData[stationCode];
  if (!stationObj) {
    console.error(`No preloaded data found for station ${stationCode}`);
    return;
  }

  // Populate appState for the selected station
  appState.selectedStation = stationCode;
  appState.stationRoutes = stationObj.routes;
  appState.stationStops = stationObj.stops;
  appState.stationSequences = stationObj.sequences;

  // (Optional) Pre-sort stationSequences if you want them sorted up front
  // appState.stationSequences.sort((a,b) => {
  //   // If route_id differs, compare them. Otherwise compare sequence_order
  //   const routeCmp = d3.ascending(a.route_id, b.route_id);
  //   return routeCmp !== 0 ? routeCmp : d3.ascending(a.sequence_order, b.sequence_order);
  // });

  // Switch to Level 2
  setLevel(2);
  initMap(); // This calls fitMapToStationStops() + renderLevel2StationRoutes()
}

/**
 * fitMapToStationStops(width, height):
 * - Looks at appState.stationStops
 * - Creates a geoMercator projection that "fits" all stops in the station area
 */
function fitMapToStationStops(width, height) {
  const stops = appState.stationStops;
  if (!stops || stops.length === 0) {
    // Fallback to a generic US map
    projection = d3.geoMercator()
      .scale(700)
      .translate([width / 2, height / 2])
      .center([-95, 40]);
    return;
  }

  // Convert station stops into a FeatureCollection
  const features = stops.map(s => ({
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [s.lng, s.lat]
    }
  }));

  const geojson = {
    type: "FeatureCollection",
    features
  };

  // Create a projection
  projection = d3.geoMercator();

  // Use geoPath to "fit" the projection to the bounding box of these stops
  const path = d3.geoPath(projection);
  projection.fitExtent(
    [[20, 20], [width - 20, height - 20]],
    geojson
  );
}

/**
 * renderLevel2StationRoutes():
 * - Draws each route's path in black (station->first) then white (rest of the route)
 * - Draws red circles for each stop
 * - Optimized using a dictionary for fast lookups
 */
function renderLevel2StationRoutes() {
  console.log("renderLevel2StationRoutes (Level 2)");

  if (!mapSvg || !projection) return;

  const { stationStops, stationSequences } = appState;

  // 1) Build a dictionary for quick (route_id, stop_id) -> stop
  const stopDict = {};
  for (const s of stationStops) {
    stopDict[s.route_id + "|" + s.stop_id] = s;
  }

  // 2) Group sequences by route_id
  // If you haven't pre-sorted stationSequences, we can still do local sort per route
  const seqByRoute = d3.group(stationSequences, d => d.route_id);

  // 3) Create a parent group for all routes
  const routesGroup = mapSvg.append("g").attr("class", "routes-group");

  // 4) For each route, build the path
  for (const [route_id, seqArray] of seqByRoute.entries()) {
    // Sort by sequence_order if needed (unless pre-sorted in handleStationClick)
    seqArray.sort((a, b) => d3.ascending(a.sequence_order, b.sequence_order));

    // Map each sequence entry to a stop record in O(1)
    const stopsForRoute = seqArray.map(seq => {
      return stopDict[seq.route_id + "|" + seq.stop_id];
    }).filter(d => d); // remove undefined

    if (stopsForRoute.length < 2) {
      // Not enough to draw a path
      continue;
    }

    // Convert lat/lng -> [x, y]
    const coords = stopsForRoute.map(s => projection([s.lng, s.lat]));
    const lineGenerator = d3.line();

    // Create a group for this route
    const routeGroup = routesGroup.append("g")
      .attr("class", "route-group")
      .on("mouseover", () => {
        // Minimizing logs for performance
        // console.log(`Hovered route: ${route_id}`);
      })
      .on("click", () => {
        // console.log(`Clicked route: ${route_id}`);
      });

    // First segment in black: index [0..1]
    if (coords.length >= 2) {
      const firstSegment = coords.slice(0, 2);
      routeGroup.append("path")
        .datum(firstSegment)
        .attr("d", lineGenerator)
        .attr("fill", "none")
        .attr("stroke", "black")
        .attr("stroke-width", 2);
    }

    // Remaining segments in white: index [1..end]
    if (coords.length > 2) {
      const restSegment = coords.slice(1);
      routeGroup.append("path")
        .datum(restSegment)
        .attr("d", lineGenerator)
        .attr("fill", "none")
        .attr("stroke", "white")
        .attr("stroke-width", 2);
    }

    // Draw small red circles for each stop
    routeGroup.selectAll("circle.stop-point")
      .data(stopsForRoute)
      .enter()
      .append("circle")
      .attr("class", "stop-point")
      .attr("cx", d => projection([d.lng, d.lat])[0])
      .attr("cy", d => projection([d.lng, d.lat])[1])
      .attr("r", 3)
      .attr("fill", "#f00");
  }
}
