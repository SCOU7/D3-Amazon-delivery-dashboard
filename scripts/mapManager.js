// scripts/mapManager.js

let mapSvg = null;
let projection = null;

/**
 * initMap():
 * Clears the old map, creates a new SVG & projection,
 * then calls the relevant "render" function based on appState.currentLevel
 */
function initMap() {
  const mapContainer = d3.select("#mapViewport");
  mapContainer.selectAll("svg").remove();

  const width = mapContainer.node().clientWidth;
  const height = mapContainer.node().clientHeight;

  mapSvg = mapContainer.append("svg")
    .attr("width", width)
    .attr("height", height);

  if (appState.currentLevel === 1) {
    // For Level 1, show entire US with a fixed scale:
    projection = d3.geoMercator()
      .scale(700)
      .translate([width / 2, height / 2])
      .center([-95, 40]);

    renderLevel1Stations();
  }
  else if (appState.currentLevel === 2) {
    // For Level 2, we fit to the bounding box of the station's stops
    // We'll do that after we know the station's lat/lng range. Let's do it now:
    fitMapToStationStops(width, height);

    renderLevel2StationRoutes();
  }
  else if (appState.currentLevel === 3) {
    // Will come later
  }
}

/**
 * Render Level 1 (Nation) Stations
 */
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
    .attr("r", d => Math.sqrt(d.total_routes) * 0.5)
    .attr("fill", "steelblue")
    .attr("stroke", "#333")
    .attr("stroke-width", 1)
    .on("mouseover", (event, d) => {
      console.log(`Hovered station: ${d.station_code} (Routes: ${d.total_routes})`);
    })
    .on("click", (event, d) => {
      // Now we actually handle the station click
      handleStationClick(d.station_code);
    });
}

/**
 * handleStationClick(stationCode):
 * - Clears old station data
 * - Loads new station data (routes, stops, sequences)
 * - Sets appState (selectedStation, stationRoutes, etc.)
 * - Switches to Level 2
 * - Re-inits the map with a bounding box that fits the station's stops
 */
async function handleStationClick(stationCode) {
  console.log(`Station ${stationCode} clicked. Loading Level 2...`);

  // Clear any old station data
  clearStationData();

  // Load new station data
  const [routes, stops, sequences] = await Promise.all([
    loadStationRoutes(stationCode),
    loadStationStops(stationCode),
    loadStationSequences(stationCode)
  ]);

  appState.selectedStation = stationCode;
  appState.stationRoutes = routes;
  appState.stationStops = stops;
  appState.stationSequences = sequences;

  // Switch to Level 2
  setLevel(2);

  // Re-init the map
  initMap();  // This calls fitMapToStationStops() and renderLevel2StationRoutes() for L2
}

/**
 * fitMapToStationStops(width, height):
 * - Reads appState.stationStops
 * - Computes bounding box
 * - Creates a projection that fits that bounding box
 */
function fitMapToStationStops(width, height) {
  // If no stops, fallback
  if (!appState.stationStops.length) {
    // fallback to something
    projection = d3.geoMercator()
      .scale(700)
      .translate([width / 2, height / 2])
      .center([-95, 40]);
    return;
  }

  // Convert stops to geoJSON-like features
  const features = appState.stationStops.map(s => ({
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

  // Create a mercator projection that we'll "fitExtent" to the data
  projection = d3.geoMercator();
  const path = d3.geoPath(projection);

  // We want some padding
  const boundsPadding = 20; // px

  // Now "fitExtent" modifies the projection to fit the specified geojson in [ [left, top], [right, bottom] ]
  projection.fitExtent(
    [[boundsPadding, boundsPadding], [width - boundsPadding, height - boundsPadding]],
    geojson
  );
}

/**
 * Render Level 2 (Station) routes
 * We'll group stops by route_id, then connect them in "actual_sequence" order.
 */
function renderLevel2StationRoutes() {
  if (!mapSvg || !projection) return;

  const { stationStops, stationSequences } = appState;

  // Group sequences by route_id
  const seqByRoute = d3.group(stationSequences, d => d.route_id);

  // A single group for everything
  const routesGroup = mapSvg.append("g").attr("class", "routes-group");

  // We'll keep track of routeIDs we actually have stops for
  const routeIds = Array.from(seqByRoute.keys());

  routeIds.forEach(route_id => {
    // Get the sequence array for this route
    const seqArray = seqByRoute.get(route_id);
    // Sort by sequence_order ascending
    seqArray.sort((a,b) => d3.ascending(a.sequence_order, b.sequence_order));

    // We need to map each sequence entry to the actual lat/lng from stationStops
    // We'll skip any that can't be found
    const stopsForRoute = seqArray.map(seq => {
      const stopData = stationStops.find(s => s.route_id === route_id && s.stop_id === seq.stop_id);
      if (stopData) {
        return { ...stopData, sequence_order: seq.sequence_order };
      }
      return null;
    }).filter(d => d !== null);

    // If there's fewer than 2 stops, we can't really draw a path. We'll skip
    if (stopsForRoute.length < 2) {
      return;
    }

    // Construct an array of [x, y] for the path
    const coords = stopsForRoute.map(s => projection([s.lng, s.lat]));

    // We'll separate the first segment (station -> first dropoff) from the rest
    // But note: we might not have a separate "station" record if the data doesn't store the station itself as a stop
    // If there's no station, we'll just treat the entire path as "white" for now
    // For demonstration, let's assume the first item is "station" if `type === "Station"`.
    // If it isn't, we just do everything white except the first pair black
    let hasStation = (stopsForRoute[0].type === "Station");

    // We'll draw one path for "station->first drop" in black (or the first pair),
    // then the rest in white

    // Split coords into segments
    // Segment 1 (index 0 to 1) => black
    // Segment 2.. => white
    const lineGenerator = d3.line();
    
    // A group for each route
    const routeGroup = routesGroup.append("g")
      .attr("class", "route-group")
      .on("mouseover", () => {
        console.log(`Hovered route: ${route_id}`);
      })
      .on("click", () => {
        console.log(`Clicked route: ${route_id}`);
        // In future: setLevel(3), selectedRoute = route_id, etc.
      });

    // If we have at least 2 points, draw the first segment
    if (coords.length >= 2) {
      const firstSegment = coords.slice(0,2);
      routeGroup.append("path")
        .datum(firstSegment)
        .attr("d", lineGenerator)
        .attr("fill", "none")
        .attr("stroke", "black")
        .attr("stroke-width", 2);
    }

    // If we have more points, draw the rest in white
    if (coords.length > 2) {
      const restSegment = coords.slice(1); // from index 1 to end
      routeGroup.append("path")
        .datum(restSegment)
        .attr("d", lineGenerator)
        .attr("fill", "none")
        .attr("stroke", "white")
        .attr("stroke-width", 2);
    }

    // Optionally draw small circles at each stop
    routeGroup.selectAll("circle.stop-point")
      .data(stopsForRoute)
      .enter()
      .append("circle")
      .attr("class", "stop-point")
      .attr("cx", d => projection([d.lng, d.lat])[0])
      .attr("cy", d => projection([d.lng, d.lat])[1])
      .attr("r", 3)
      .attr("fill", "#f00");
  });
}
