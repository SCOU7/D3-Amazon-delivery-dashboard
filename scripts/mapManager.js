// scripts/mapManager.js

let mapSvg = null;
let projection = null;

/**
 * showMapMonitorInfo(htmlString):
 * Replaces the content of #mapMonitorContent in the left sidebar
 * with the provided HTML string.
 */
function showMapMonitorInfo(htmlString) {
  d3.select("#mapMonitorContent").html(htmlString);
}

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
    fitMapToStationStops(width, height);
    renderLevel2StationRoutes();
  }
  else if (appState.currentLevel === 3) {
    // Level 3: Route-level
    renderLevel3Route();
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
      // Show station details in the Map Monitor
      const infoHtml = `
        <p><strong>Station: ${d.station_code}</strong></p>
        <p>Total Routes: ${d.total_routes}</p>
      `;
      showMapMonitorInfo(infoHtml);
    })
    .on("mouseout", () => {
      // Reset sidebar content
      showMapMonitorInfo("<p>Hover over a station, route, or stop to see details.</p>");
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
  if (!mapSvg || !projection) return;

  const { stationStops, stationSequences } = appState;

  // Build stop dictionary for quick lookups
  const stopDict = {};
  for (const s of stationStops) {
    stopDict[s.route_id + "|" + s.stop_id] = s;
  }

  // Group sequences by route_id
  const seqByRoute = d3.group(stationSequences, d => d.route_id);
  const routesGroup = mapSvg.append("g").attr("class", "routes-group");

  for (const [route_id, seqArray] of seqByRoute.entries()) {
    // Sort stops by sequence_order
    seqArray.sort((a,b) => d3.ascending(a.sequence_order, b.sequence_order));

    const stopsForRoute = seqArray.map(seq => {
      return stopDict[seq.route_id + "|" + seq.stop_id];
    }).filter(d => d);

    if (stopsForRoute.length < 2) continue;

    // Convert each stop to projected coordinates
    const coords = stopsForRoute.map(s => projection([s.lng, s.lat]));
    const lineGenerator = d3.line();

    // One <g> per route
    const routeGroup = routesGroup.append("g")
      .attr("class", "route-group")
      .on("mouseover", () => {
        // Show route info in the sidebar
        const infoHtml = `
          <p><strong>Route ID:</strong> ${route_id}</p>
          <p>Stops in route: ${stopsForRoute.length}</p>
        `;
        showMapMonitorInfo(infoHtml);
      })
      .on("mouseout", () => {
        showMapMonitorInfo("<p>Hover over a station, route, or stop to see details.</p>");
      })
      .on("click", () => {
        // When user clicks a route, transition to Level 3
        handleRouteClick(route_id);
      });

    // First segment black
    if (coords.length >= 2) {
      routeGroup.append("path")
        .datum(coords.slice(0,2))
        .attr("d", lineGenerator)
        .attr("fill", "none")
        .attr("stroke", "black")
        .attr("stroke-width", 2);
    }

    // Remaining segments white
    if (coords.length > 2) {
      routeGroup.append("path")
        .datum(coords.slice(1))
        .attr("d", lineGenerator)
        .attr("fill", "none")
        .attr("stroke", "white")
        .attr("stroke-width", 2);
    }

    // Draw red circles for each stop
    routeGroup.selectAll("circle.stop-point")
      .data(stopsForRoute)
      .enter()
      .append("circle")
      .attr("class", "stop-point")
      .attr("cx", d => projection([d.lng, d.lat])[0])
      .attr("cy", d => projection([d.lng, d.lat])[1])
      .attr("r", 3)
      .attr("fill", "#f00")
      .on("mouseover", (event, d) => {
        // Show stop details in the Map Monitor
        const infoHtml = `
          <p><strong>Stop ID:</strong> ${d.stop_id}</p>
          <p>lat: ${d.lat.toFixed(4)}, lng: ${d.lng.toFixed(4)}</p>
        `;
        showMapMonitorInfo(infoHtml);
      })
      .on("mouseout", () => {
        // Return to route-level hover info or default
        const infoHtml = `
          <p><strong>Route ID:</strong> ${route_id}</p>
          <p>Stops in route: ${stopsForRoute.length}</p>
        `;
        showMapMonitorInfo(infoHtml);
      });
  }
}

/**
 * handleRouteClick(route_id):
 * - Sets appState.selectedRoute = route_id
 * - Loads route-specific travel_times
 * - Finds the subset of stationStops & packages for that route
 * - Switches to Level 3
 */
async function handleRouteClick(route_id) {
  clearRouteData();
  appState.selectedRoute = route_id;

  // 1) Build routeStops array
  const routeStops = appState.stationStops.filter(s => s.route_id === route_id);
  appState.routeStops = routeStops;

  // 2) Load packages for this route
  const allPackages = appState.stationData[appState.selectedStation].packages || [];
  const routePackages = allPackages.filter(p => p.route_id === route_id);
  appState.routePackages = routePackages;

  // 3) Load travel times
  try {
    const travelTimes = await loadRouteTravelTimes(appState.selectedStation, route_id);
    appState.routeTravelTimes = travelTimes;
  } catch (err) {
    console.error("Error loading route travel times:", err);
    appState.routeTravelTimes = null;
  }

  // 4) Switch to Level 3 and re-render
  setLevel(3);
  initMap();
}

/**
 * renderLevel3Route():
 * - Uses appState.routeStops + appState.routeTravelTimes
 * - Colors each link by ratio = travel_time / distance
 * - Colors each stop by "average service time"
 */
function renderLevel3Route() {
  if (!mapSvg) return;

  // 1) Fit bounding box to all routeStops
  fitMapToRouteStops();

  // 2) Build the actual ordered list of stops from appState.stationSequences
  const seqArray = appState.stationSequences
    .filter(seq => seq.route_id === appState.selectedRoute)
    .sort((a,b) => d3.ascending(a.sequence_order, b.sequence_order));

  if (!seqArray.length) {
    console.warn("No sequence data for route", appState.selectedRoute);
    return;
  }

  // Dictionary for quick stop lookups
  const stopDict = {};
  for (const s of appState.routeStops) {
    stopDict[s.stop_id] = s;
  }

  const orderedStops = seqArray.map(seq => stopDict[seq.stop_id]).filter(d => d);
  if (orderedStops.length < 2) {
    console.warn("Not enough stops in route to draw path.");
    return;
  }

  // 3) Draw line segments with color scale for traffic ratio
  const routeGroup = mapSvg.append("g")
    .attr("class", "level3-route");

  for (let i = 0; i < orderedStops.length - 1; i++) {
    const fromStop = orderedStops[i];
    const toStop = orderedStops[i+1];

    let travelTime = 0;
    if (appState.routeTravelTimes &&
        appState.routeTravelTimes[fromStop.stop_id] &&
        appState.routeTravelTimes[fromStop.stop_id][toStop.stop_id] !== undefined) {
      travelTime = appState.routeTravelTimes[fromStop.stop_id][toStop.stop_id];
    }
    const dist = distanceBetweenStops(fromStop, toStop);
    const ratio = dist > 0 ? travelTime / dist : 0;
    const linkColor = trafficColorScale(ratio);

    const lineGenerator = d3.line();
    const segmentCoords = [
      projection([fromStop.lng, fromStop.lat]),
      projection([toStop.lng, toStop.lat])
    ];

    routeGroup.append("path")
      .datum(segmentCoords)
      .attr("d", lineGenerator)
      .attr("fill", "none")
      .attr("stroke", linkColor)
      .attr("stroke-width", 3)
      .on("mouseover", () => {
        const infoHtml = `
          <p><strong>Link Info</strong></p>
          <p>From Stop: ${fromStop.stop_id}</p>
          <p>To Stop: ${toStop.stop_id}</p>
          <p>Travel Time (sec): ${travelTime.toFixed(2)}</p>
          <p>Distance (km): ${dist.toFixed(2)}</p>
          <p>Ratio (sec/km): ${ratio.toFixed(2)}</p>
        `;
        showMapMonitorInfo(infoHtml);
      })
      .on("mouseout", () => {
        showMapMonitorInfo("<p>Hover over a station, route, or stop to see details.</p>");
      });
  }

  // 4) Draw each stop with color-coded average service time
  const packagesByStop = d3.group(appState.routePackages, p => p.stop_id);

  const nodeGroup = routeGroup.append("g")
    .attr("class", "route-nodes");

  nodeGroup.selectAll("circle.node")
    .data(orderedStops)
    .enter()
    .append("circle")
    .attr("class", "node")
    .attr("cx", d => projection([d.lng, d.lat])[0])
    .attr("cy", d => projection([d.lng, d.lat])[1])
    .attr("r", 5)
    .attr("fill", d => {
      const pkgs = packagesByStop.get(d.stop_id) || [];
      const avgService = d3.mean(pkgs, p => +p.planned_service_time_seconds) || 0;
      return serviceColorScale(avgService);
    })
    .on("mouseover", (event, d) => {
      const pkgs = packagesByStop.get(d.stop_id) || [];
      const avgService = d3.mean(pkgs, p => +p.planned_service_time_seconds) || 0;

      const infoHtml = `
        <p><strong>Stop: ${d.stop_id}</strong></p>
        <p>Coordinates: ${d.lat.toFixed(4)}, ${d.lng.toFixed(4)}</p>
        <p>Avg Service (sec): ${avgService.toFixed(2)}</p>
        <p>Package Count: ${pkgs.length}</p>
      `;
      showMapMonitorInfo(infoHtml);
    })
    .on("mouseout", () => {
      showMapMonitorInfo("<p>Hover over a station, route, or stop to see details.</p>");
    });
}

/**
 * fitMapToRouteStops():
 * Fit bounding box to the route's stops, which are in appState.routeStops
 */
function fitMapToRouteStops() {
  const mapContainer = d3.select("#mapViewport");
  const width = mapContainer.node().clientWidth;
  const height = mapContainer.node().clientHeight;

  const routeStops = appState.routeStops;
  if (!routeStops.length) {
    projection = d3.geoMercator()
      .scale(700)
      .translate([width / 2, height / 2])
      .center([-95, 40]);
    return;
  }

  const features = routeStops.map(s => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: [s.lng, s.lat] }
  }));

  const geojson = { type: "FeatureCollection", features };

  projection = d3.geoMercator();
  projection.fitExtent([[20,20],[width-20, height-20]], geojson);
}

/**
 * distanceBetweenStops(a, b):
 * For a rough approximation, we can do a basic Euclidean or Haversine formula.
 */
function distanceBetweenStops(a, b) {
  const R = 6371; // Earth's radius in km
  const lat1 = a.lat * Math.PI/180, lat2 = b.lat * Math.PI/180;
  const dLat = (b.lat - a.lat) * Math.PI/180;
  const dLon = (b.lng - a.lng) * Math.PI/180;

  const sinDLat = Math.sin(dLat/2);
  const sinDLon = Math.sin(dLon/2);
  const c = 2 * Math.asin( Math.sqrt(
    sinDLat*sinDLat +
    Math.cos(lat1)*Math.cos(lat2)*sinDLon*sinDLon
  ));
  const dist = R * c; // in km
  return dist;
}

/**
 * trafficColorScale(ratio):
 * ratio = (travel_time in seconds) / (distance in km)
 * For example, 300 seconds / 1 km = 300 sec/km
 * domain might be [0, 300, 600] => [green, yellow, red]
 */
function trafficColorScale(ratio) {
  return d3.scaleLinear()
    .domain([0, 300, 600])
    .range(["green", "yellow", "red"])
    .clamp(true)(ratio);
}

/**
 * serviceColorScale(avgService):
 * e.g. domain = [0, 60, 300] => [light, medium, dark]
 */
function serviceColorScale(seconds) {
  return d3.scaleLinear()
    .domain([0, 60, 300])
    .range(["#ccece6", "#66c2a4", "#238b45"])
    .clamp(true)(seconds);
}
