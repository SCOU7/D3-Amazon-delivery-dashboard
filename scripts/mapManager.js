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
      const infoHtml = `
        <p><strong>Station: ${d.station_code}</strong></p>
        <p>Location: (${d.lat.toFixed(4)}, ${d.lng.toFixed(4)})</p>
        <p>Total Routes: ${d.total_routes}</p>
      `;
      showMapMonitorInfo(infoHtml);
    })
    .on("mouseout", () => {
      showMapMonitorInfo("<p>Hover over a station, route, or stop to see details.</p>");
    })
    .on("click", (event, d) => {
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
/**
 * handleStationClick(stationCode):
 * - Loads station data into state
 * - Applies current filters immediately
 * - Switches to Level 2
 */
async function handleStationClick(stationCode) {
  clearStationData();

  const stationObj = appState.stationData[stationCode];
  if (!stationObj) {
    console.error(`No preloaded data found for station ${stationCode}`);
    return;
  }

  appState.selectedStation = stationCode;
  appState.stationRoutes = stationObj.routes;
  appState.stationStops = stationObj.stops;
  appState.stationSequences = stationObj.sequences;

  // 🆕 Initialize filters and populate dynamic zones
  initializeFilters(); // loads filter UI
  populateZoneOptionsFromCurrentStation(); // populates zones from this station

  // 🆕 Immediately apply filters for initial map/pie rendering
  applyFilters();

  // Switch to Level 2
  setLevel(2);
  initMap();
}


/**
 * fitMapToStationStops(width, height):
 * - Looks at appState.stationStops
 * - Creates a geoMercator projection that "fits" all stops in the station area
 */
function fitMapToStationStops(width, height) {
  const stops = appState.stationStops;
  if (!stops || stops.length === 0) {
    projection = d3.geoMercator()
      .scale(700)
      .translate([width / 2, height / 2])
      .center([-95, 40]);
    return;
  }

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

  projection = d3.geoMercator();
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

  const { stationStops, stationSequences, filteredStationRoutes } = appState;

  // Build stop dictionary for quick lookups
  const stopDict = {};
  for (const s of stationStops) {
    stopDict[s.route_id + "|" + s.stop_id] = s;
  }

  // Group sequences by route_id
  const filteredRouteIDs = new Set(filteredStationRoutes.map(r => r.route_id));
  const filteredSequences = stationSequences.filter(s => filteredRouteIDs.has(s.route_id));
  const seqByRoute = d3.group(filteredSequences, d => d.route_id);

  const routesGroup = mapSvg.append("g").attr("class", "routes-group");

  for (const [route_id, seqArray] of seqByRoute.entries()) {
    // Sort stops by sequence_order
    seqArray.sort((a, b) => d3.ascending(a.sequence_order, b.sequence_order));

    const stopsForRoute = seqArray.map(seq => stopDict[seq.route_id + "|" + seq.stop_id])
                                  .filter(d => d);
    if (stopsForRoute.length < 2) continue;

    // Look up additional route details from stationRoutes, if available.
    const routeData = appState.stationRoutes.find(r => r.route_id === route_id);

    const routeGroup = routesGroup.append("g")
      .attr("class", "route-group")
      .on("mouseover", () => {
        const infoHtml = `
          <p><strong>Route ID:</strong> ${route_id}</p>
          ${routeData ? `
            <p>Date: ${routeData.date}</p>
            <p>Departure: ${routeData.departure_time_utc}</p>
            <p>Executor Capacity: ${routeData.executor_capacity_cm3}</p>
            <p>Route Score: ${routeData.route_score}</p>` : ''}
          <p>Total Stops: ${stopsForRoute.length}</p>
        `;
        showMapMonitorInfo(infoHtml);
      })
      .on("mouseout", () => {
        showMapMonitorInfo("<p>Hover over a station, route, or stop to see details.</p>");
      })
      .on("click", () => {
        handleRouteClick(route_id);
      });

    const lineGenerator = d3.line();
    const coords = stopsForRoute.map(s => projection([s.lng, s.lat]));
    if (coords.length >= 2) {
      routeGroup.append("path")
        .datum(coords.slice(0, 2))
        .attr("d", lineGenerator)
        .attr("fill", "none")
        .attr("stroke", "black")
        .attr("stroke-width", 2);
    }
    if (coords.length > 2) {
      routeGroup.append("path")
        .datum(coords.slice(1))
        .attr("d", lineGenerator)
        .attr("fill", "none")
        .attr("stroke", "white")
        .attr("stroke-width", 2);
    }

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
        const infoHtml = `
          <p><strong>Stop ID:</strong> ${d.stop_id}</p>
          <p>Type: ${d.type}</p>
          <p>Zone: ${d.zone_id}</p>
          <p>Coordinates: (${d.lat.toFixed(4)}, ${d.lng.toFixed(4)})</p>
        `;
        showMapMonitorInfo(infoHtml);
      })
      .on("mouseout", () => {
        const infoHtml = `
          <p><strong>Route ID:</strong> ${route_id}</p>
          <p>Total Stops: ${stopsForRoute.length}</p>
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

  // Build routeStops array
  const routeStops = appState.stationStops.filter(s => s.route_id === route_id);
  appState.routeStops = routeStops;

  // Load packages for this route
  const allPackages = appState.stationData[appState.selectedStation].packages || [];
  const routePackages = allPackages.filter(p => p.route_id === route_id);
  appState.routePackages = routePackages;

  // Load travel times
  try {
    const travelTimes = await loadRouteTravelTimes(appState.selectedStation, route_id);
    appState.routeTravelTimes = travelTimes;
  } catch (err) {
    console.error("Error loading route travel times:", err);
    appState.routeTravelTimes = null;
  }

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

  fitMapToRouteStops();

  const seqArray = appState.stationSequences
    .filter(seq => seq.route_id === appState.selectedRoute)
    .sort((a, b) => d3.ascending(a.sequence_order, b.sequence_order));

  if (!seqArray.length) {
    console.warn("No sequence data for route", appState.selectedRoute);
    return;
  }

  const stopDict = {};
  for (const s of appState.routeStops) {
    stopDict[s.stop_id] = s;
  }

  const orderedStops = seqArray.map(seq => stopDict[seq.stop_id]).filter(d => d);
  if (orderedStops.length < 2) {
    console.warn("Not enough stops in route to draw path.");
    return;
  }

  const routeGroup = mapSvg.append("g")
    .attr("class", "level3-route");

  for (let i = 0; i < orderedStops.length - 1; i++) {
    const fromStop = orderedStops[i];
    const toStop = orderedStops[i + 1];

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
          <p><strong>Link Information</strong></p>
          <p>From Stop: ${fromStop.stop_id} (Type: ${fromStop.type}, Zone: ${fromStop.zone_id})</p>
          <p>To Stop: ${toStop.stop_id} (Type: ${toStop.type}, Zone: ${toStop.zone_id})</p>
          <p>Travel Time (sec): ${travelTime.toFixed(2)}</p>
          <p>Distance (km): ${dist.toFixed(2)}</p>
          <p>Traffic Ratio (sec/km): ${ratio.toFixed(2)}</p>
        `;
        showMapMonitorInfo(infoHtml);
      })
      .on("mouseout", () => {
        showMapMonitorInfo("<p>Hover over a station, route, or stop to see details.</p>");
      });
  }

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
      const packagePreview = pkgs.length > 0 ? pkgs.map(p => p.package_id).slice(0, 3).join(', ') : 'None';
      const infoHtml = `
        <p><strong>Stop ID:</strong> ${d.stop_id}</p>
        <p>Coordinates: (${d.lat.toFixed(4)}, ${d.lng.toFixed(4)})</p>
        <p>Avg Service Time (sec): ${avgService.toFixed(2)}</p>
        <p>Package Count: ${pkgs.length}</p>
        ${pkgs.length > 0 ? `<p>Package IDs: ${packagePreview}${pkgs.length > 3 ? '...' : ''}</p>` : ''}
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
  projection.fitExtent([[20, 20], [width - 20, height - 20]], geojson);
}

/**
 * distanceBetweenStops(a, b):
 * Calculates the distance between two stops using the Haversine formula.
 */
function distanceBetweenStops(a, b) {
  const R = 6371; // Earth's radius in km
  const lat1 = a.lat * Math.PI / 180, lat2 = b.lat * Math.PI / 180;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLon = (b.lng - a.lng) * Math.PI / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const c = 2 * Math.asin(Math.sqrt(
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon
  ));
  const dist = R * c;
  return dist;
}

/**
 * trafficColorScale(ratio):
 * Returns a color based on the traffic ratio (travel time / distance).
 */
function trafficColorScale(ratio) {
  return d3.scaleLinear()
    .domain([0, 300, 600])
    .range(["green", "yellow", "red"])
    .clamp(true)(ratio);
}

/**
 * serviceColorScale(avgService):
 * Returns a color based on average service time.
 */
function serviceColorScale(seconds) {
  return d3.scaleLinear()
    .domain([0, 60, 300])
    .range(["#ccece6", "#66c2a4", "#238b45"])
    .clamp(true)(seconds);
}
