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
    seqArray.sort((a,b) => d3.ascending(a.sequence_order, b.sequence_order));

    const stopsForRoute = seqArray.map(seq => {
      return stopDict[seq.route_id + "|" + seq.stop_id];
    }).filter(d => d);

    if (stopsForRoute.length < 2) continue;

    const coords = stopsForRoute.map(s => projection([s.lng, s.lat]));
    const lineGenerator = d3.line();

    const routeGroup = routesGroup.append("g")
      .attr("class", "route-group")
      .on("mouseover", () => {
        // minimal logging
      })
      .on("click", () => {
        // **When user clicks a route, go to handleRouteClick**
        handleRouteClick(route_id);
      });

    // First segment black, rest white...
    if (coords.length >= 2) {
      routeGroup.append("path")
        .datum(coords.slice(0,2))
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

    // draw red circles
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

/**
 * handleRouteClick(route_id):
 * - Sets appState.selectedRoute = route_id
 * - Loads route-specific travel_times
 * - Finds the subset of stationStops & packages for that route
 * - Switches to Level 3
 */
async function handleRouteClick(route_id) {
  console.log(`Route ${route_id} clicked, transitioning to Level 3...`);

  // Clear old route data
  clearRouteData();
  appState.selectedRoute = route_id;

  // 1) Build routeStops array from appState.stationStops
  const routeStops = appState.stationStops.filter(s => s.route_id === route_id);
  appState.routeStops = routeStops;

  // 2) Optionally load route's packages if needed
  // If you want a "no delay" approach, you can preload them just like we do for stops.
  // Otherwise, let's do it on demand. We'll show an example:
  let routePackages = [];
  try {
    // We do have "packages.csv" for the station, so let's filter that
    // or load the entire packages.csv and filter it.
    // For brevity, let's assume we've preloaded stationPackages at startup. If not, you can do:
    // const stationPackages = await loadStationPackages(appState.selectedStation);
    // routePackages = stationPackages.filter(p => p.route_id === route_id);

    // If you've already got stationPackages in appState, do:
    // routePackages = appState.stationPackages.filter(p => p.route_id === route_id);

    // For now, let's assume we skip or we have an empty array
    routePackages = [];
  } catch (e) {
    console.warn("Could not load packages for route", route_id, e);
  }
  appState.routePackages = routePackages;

  // 3) Load route travel_times
  let travelTimes = null;
  try {
    travelTimes = await loadRouteTravelTimes(appState.selectedStation, route_id);
    appState.routeTravelTimes = travelTimes;
  } catch (err) {
    console.error("Error loading route travel times:", err);
    appState.routeTravelTimes = null;
  }

  // 4) setLevel(3) & re-init map
  setLevel(3);
  initMap(); // calls renderLevel3Route()
}

/**
 * renderLevel3Route():
 * - Uses appState.routeStops + appState.routeTravelTimes
 * - Colors each link by ratio = travel_time / distance
 * - Colors each stop by "average service time"
 */
function renderLevel3Route() {
  console.log("Rendering Level 3 route view");
  if (!mapSvg) return;

  // 1) Fit bounding box to all routeStops
  fitMapToRouteStops();

  // 2) Build the actual ordered list of stops from appState.stationSequences?
  // or we can do it again here.
  // We'll re-group the sequences by route_id and pick the selectedRoute's array
  const seqArray = appState.stationSequences
    .filter(seq => seq.route_id === appState.selectedRoute)
    .sort((a,b) => d3.ascending(a.sequence_order, b.sequence_order));

  if (!seqArray.length) {
    console.warn("No sequence data for route", appState.selectedRoute);
    return;
  }

  // Build a dictionary for quick (stop_id -> stop object)
  const stopDict = {};
  for (const s of appState.routeStops) {
    stopDict[s.stop_id] = s;
  }

  // We'll build a path array of consecutive stops
  const orderedStops = seqArray.map(seq => stopDict[seq.stop_id]).filter(d => d);
  if (orderedStops.length < 2) {
    console.warn("Not enough stops in route to draw path.");
    return;
  }

  // 3) We'll create line segments between consecutive stops
  // For each pair (i, i+1), compute ratio = travel_time / geodesic_distance
  const routeGroup = mapSvg.append("g")
    .attr("class", "level3-route");

  for (let i = 0; i < orderedStops.length - 1; i++) {
    const fromStop = orderedStops[i];
    const toStop = orderedStops[i+1];

    // look up travel time in appState.routeTravelTimes
    let travelTime = 0;
    if (appState.routeTravelTimes && 
        appState.routeTravelTimes[fromStop.stop_id] &&
        appState.routeTravelTimes[fromStop.stop_id][toStop.stop_id] !== undefined) {
      travelTime = appState.routeTravelTimes[fromStop.stop_id][toStop.stop_id];
    }

    // compute geodesic distance or approximate
    const dist = distanceBetweenStops(fromStop, toStop);

    const ratio = dist > 0 ? travelTime / dist : 0;

    // color from green to red
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
        // highlight or log details
        console.log(`Hovered link from ${fromStop.stop_id} to ${toStop.stop_id}, 
                     time=${travelTime}, dist=${dist}, ratio=${ratio}`);
      });
  }

  // 4) Draw each stop as a circle, color-coded by avg service time
  // We'll compute average service time from appState.routePackages
  // For each stop, gather packages, average planned_service_time_seconds
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
      console.log(`Stop ${d.stop_id} hovered. lat=${d.lat}, lng=${d.lng}`);
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
    // fallback
    projection = d3.geoMercator()
      .scale(700)
      .translate([width / 2, height / 2])
      .center([-95, 40]);
    return;
  }

  const features = routeStops.map(s => ({
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
  projection.fitExtent([[20,20],[width-20, height-20]], geojson);
}

/**
 * distanceBetweenStops(a, b):
 * For a rough approximation, we can do a basic Euclidean distance in lat/lng
 * or use a real geodesic formula. Here's a quick helper:
 */
function distanceBetweenStops(a, b) {
  const R = 6371; // Earth's radius in km if you want a geodesic
  // convert lat/lng to radians
  const lat1 = a.lat * Math.PI/180, lat2 = b.lat * Math.PI/180;
  const dLat = (b.lat - a.lat) * Math.PI/180;
  const dLon = (b.lng - a.lng) * Math.PI/180;

  // Haversine
  const sinDLat = Math.sin(dLat/2);
  const sinDLon = Math.sin(dLon/2);
  const c = 2 * Math.asin( Math.sqrt( sinDLat*sinDLat +
                Math.cos(lat1)*Math.cos(lat2)*sinDLon*sinDLon ) );
  const dist = R * c; // in km
  // we can convert to meters if we want
  return dist; // km
}

/**
 * trafficColorScale(ratio):
 * ratio = (travel_time in seconds) / (distance in km)
 * For example, 300 seconds / 1 km = 300 sec/km
 * We can define an approximate domain, e.g.:
 *   0 -> green
 *   300 -> yellow
 *   600 -> red
 */
function trafficColorScale(ratio) {
  // ratio in sec/km
  // let's define an arbitrary scale:
  return d3.scaleLinear()
    .domain([0, 300, 600]) // adjust as needed
    .range(["green", "yellow", "red"])
    .clamp(true)(ratio);
}

/**
 * serviceColorScale(avgService):
 * e.g. domain = [0, 120, 300, ...]
 */
function serviceColorScale(seconds) {
  // You can define any color scale
  return d3.scaleLinear()
    .domain([0, 60, 300]) // adjust as needed
    .range(["#ccece6", "#66c2a4", "#238b45"])
    .clamp(true)(seconds);
}

// Now, in initMap(), when we see if (appState.currentLevel === 3), we call renderLevel3Route().
function initMap() {
  const mapContainer = d3.select("#mapViewport");
  mapContainer.selectAll("svg").remove();

  const width = mapContainer.node().clientWidth;
  const height = mapContainer.node().clientHeight;

  mapSvg = mapContainer.append("svg")
    .attr("width", width)
    .attr("height", height);

  if (appState.currentLevel === 1) {
    projection = d3.geoMercator().scale(700).translate([width/2,height/2]).center([-95, 40]);
    renderLevel1Stations();
  } else if (appState.currentLevel === 2) {
    fitMapToStationStops(width, height);
    renderLevel2StationRoutes();
  } else if (appState.currentLevel === 3) {
    renderLevel3Route();
  }
}