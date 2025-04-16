// scripts/mapManager.js
import { appState, setLevel, clearStationData, clearRouteData } from './stateManager.js';
import { loadRouteTravelTimes } from './dataLoader.js';

/* ────────────────────────────────────────────────────────────────────────── */
/* ‑‑‑‑‑‑ Utility helpers ‑‑‑‑‑‑ */

function formatTime(seconds) {
  seconds = Math.round(seconds);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatTimeShort(seconds) {
  seconds = Math.round(seconds);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m${s.toString().padStart(2, '0')}s`;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* ‑‑‑‑‑‑ Module‑level variables ‑‑‑‑‑‑ */

let mapSvg = null;
let zoomGroup = null;
let projection = null;

/* ────────────────────────────────────────────────────────────────────────── */
/* ‑‑‑‑‑‑ DOM updaters ‑‑‑‑‑‑ */

function setMapMonitorBase(htmlString) {
  d3.select("#mapMonitorBase").html(htmlString);
}

function setMapMonitorHover(htmlString) {
  d3.select("#mapMonitorHover").html(htmlString);
}

/* ────────────────────────────────────────────────────────────────────────── */
/* ‑‑‑‑‑‑ Main entry point ‑‑‑‑‑‑ */

function initMap() {
  console.log("[DEBUG] initMap called");

  /* — clear old svg — */
  const mapContainer = d3.select("#mapViewport");
  mapContainer.selectAll("svg").remove();

  /* — new svg & group — */
  const width  = mapContainer.node().clientWidth;
  const height = mapContainer.node().clientHeight;

  mapSvg = mapContainer.append("svg")
    .attr("width",  width)
    .attr("height", height);

  /* — single marker def used by both L2 & L3 — */
  mapSvg.append("defs").append("marker")
    .attr("id", "arrowhead")
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 10)
    .attr("refY", 0)
    .attr("markerWidth", 3)
    .attr("markerHeight", 3)
    .attr("orient", "auto")
    .append("path")
    .attr("d", "M0,-5L10,0L0,5")
    .attr("fill", "currentColor");

  zoomGroup = mapSvg.append("g").attr("class", "zoom-group");

  /* — choose projection once, before anything is drawn — */
  if (appState.currentLevel === 1) {
    projection = d3.geoMercator()
      .scale(700)
      .translate([width / 2, height / 2])
      .center([-95, 40]);
    console.log("[DEBUG] Projection set for Level 1 (nation view)");
  } else if (appState.currentLevel === 2) {
    fitMapToStationStops(width, height);
    console.log("[DEBUG] Projection set for Level 2 via fitMapToStationStops");
  } else if (appState.currentLevel === 3) {
    /* *** key change: use route stops right here *** */
    fitMapToRouteStops();
    console.log("[DEBUG] Projection set for Level 3 via fitMapToRouteStops");
  } else {
    console.warn("[DEBUG] Unknown level:", appState.currentLevel);
    return;
  }

  /* — county borders background — */
  const backgroundGroup = zoomGroup.append("g").attr("class", "background-group");

  // any station will do – they all share the same borders file
  const firstStation     = appState.stations[0]?.station_code;
  const bordersGeoJSON   = firstStation ? appState.stationData[firstStation]?.borders : null;

  if (bordersGeoJSON) {
    const geoPath = d3.geoPath().projection(projection);
    backgroundGroup.selectAll("path.county-boundary")
      .data(bordersGeoJSON.features)
      .enter()
      .append("path")
      .attr("class", "county-boundary")
      .attr("d", geoPath)
      .attr("fill", "none")
      .attr("stroke", "#144cb3")
      .attr("stroke-width", 1);
  }

  /* — grid lines (drawn in a dedicated group) — */
  const gridGroup = zoomGroup.append("g").attr("class", "grid-lines");

  /* — draw correct level contents — */
  if (appState.currentLevel === 1) {
    renderLevel1Stations();
  } else if (appState.currentLevel === 2) {
    renderLevel2StationRoutes();
    const station        = appState.selectedStation;
    const totalRoutes    = appState.stationRoutes.length;
    setMapMonitorBase(
      `<p><strong>Station:</strong> ${station}</p>
       <p><strong>Total Routes:</strong> ${totalRoutes}</p>
       <p><em>Hover over stops to see zone ID</em></p>`
    );
  } else if (appState.currentLevel === 3) {
    renderLevel3Route();

    const routeId   = appState.selectedRoute;
    const route     = appState.stationRoutes.find(r => r.route_id === routeId);
    const stops     = appState.stationStops.filter(s => s.route_id === routeId);
    const zoneIds   = [...new Set(stops.map(s => s.zone_id))];
    const zoneLabel = zoneIds.length === 0
        ? "Unknown"
        : zoneIds.length === 1
          ? zoneIds[0]
          : `${zoneIds.length} zones`;
    const pkgCount  = appState.routePackages.length;
    const score     = route ? route.route_score : "N/A";

    const totalService = d3.sum(appState.routePackages,
                                p => +p.planned_service_time_seconds || 0);

    /* quick transit‑time calc */
    let totalTransit = 0;
    const travelTimes = appState.routeTravelTimes;
    const seq = appState.stationSequences
                  .filter(s => s.route_id === routeId)
                  .sort((a,b) => a.sequence_order - b.sequence_order);
    for (let i = 0; i < seq.length - 1; i++) {
      const from = seq[i].stop_id, to = seq[i+1].stop_id;
      const travel = travelTimes?.[from]?.[to];
      if (travel != null) totalTransit += travel;
    }

    setMapMonitorBase(
      `<p><strong>Route ID:</strong> ${routeId}</p>
       <p><strong>Zone:</strong> ${zoneLabel}</p>
       <p><strong>Packages:</strong> ${pkgCount}</p>
       <p><strong>Route Score:</strong> ${score}</p>
       <p><strong>Transit Time:</strong> ${formatTime(totalTransit)}</p>
       <p><strong>Service Time:</strong> ${formatTime(totalService)}</p>`
    );
  }

  /* ─ zoom behaviour ─ */
  const zoom = d3.zoom()
    .scaleExtent([0.1, 30])
    .on("zoom", (event) => {
      zoomGroup.attr("transform", event.transform);
      updateGridLines();
    });
  mapSvg.call(zoom);

  /* initial grid */
  updateGridLines();

  /* helper; needs access to width/height/projection */
  function updateGridLines() {
    const transform = d3.zoomTransform(mapSvg.node());
    const k  = transform.k, tx = transform.x, ty = transform.y;

    const x_min = -tx / k,           x_max = (width  - tx) / k;
    const y_min = -ty / k,           y_max = (height - ty) / k;
    const lng_min = projection.invert([x_min, 0])[0];
    const lng_max = projection.invert([x_max, 0])[0];
    const lat_min = projection.invert([0, y_max])[1];
    const lat_max = projection.invert([0, y_min])[1];

    const lng_ints = d3.range(Math.ceil(lng_min), Math.floor(lng_max) + 1);
    const lat_ints = d3.range(Math.ceil(lat_min), Math.floor(lat_max) + 1);

    /* vertical */
    const verticalLines = lng_ints.map(n => ({
      x  : projection([n, 0])[0],
      y1 : -10000,
      y2 :  10000
    }));
    const vLines = gridGroup.selectAll("line.vertical-grid")
      .data(verticalLines, d => d.x);
    vLines.enter().append("line")
      .attr("class", "vertical-grid")
      .merge(vLines)
      .attr("x1", d => d.x).attr("x2", d => d.x)
      .attr("y1", d => d.y1).attr("y2", d => d.y2);
    vLines.exit().remove();

    /* horizontal */
    const horizontalLines = lat_ints.map(m => ({
      y  : projection([0, m])[1],
      x1 : -10000,
      x2 :  10000
    }));
    const hLines = gridGroup.selectAll("line.horizontal-grid")
      .data(horizontalLines, d => d.y);
    hLines.enter().append("line")
      .attr("class", "horizontal-grid")
      .merge(hLines)
      .attr("y1", d => d.y).attr("y2", d => d.y)
      .attr("x1", d => d.x1).attr("x2", d => d.x2);
    hLines.exit().remove();
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/* ‑‑‑‑‑‑ Level 1 (nation view) ‑‑‑‑‑‑ */

function renderLevel1Stations() {
  if (!zoomGroup || !projection) return;

  const stationGroup = zoomGroup.append("g").attr("class", "station-group");

  stationGroup.selectAll("circle.station-circle")
    .data(appState.stations)
    .enter()
    .append("circle")
    .attr("class", "station-circle")
    .attr("data-station", d => d.station_code)
    .attr("cx", d => projection([d.lng, d.lat])[0])
    .attr("cy", d => projection([d.lng, d.lat])[1])
    .attr("r", d => 2.5)            // constant tiny radius
    .on("mouseover", (event, d) => {
      d3.select(event.currentTarget)
        .attr("stroke", "#ffcc00")
        .attr("stroke-width", 3);

      const infoHtml =
        `<p><strong>Station: ${d.station_code}</strong></p>
         <p>Location: (${d.lat.toFixed(4)}, ${d.lng.toFixed(4)})</p>
         <p>Total Routes: ${d.total_routes}</p>`;
      setMapMonitorHover(infoHtml);
    })
    .on("mouseout", (event) => {
      d3.select(event.currentTarget)
        .attr("stroke", "#333")
        .attr("stroke-width", 1);

      setMapMonitorHover("");
    })
    .on("click", (event, d) => handleStationClick(d.station_code));
}

function handleStationClick(stationCode) {
  clearStationData();

  const stationObj = appState.stationData[stationCode];
  if (!stationObj) {
    console.error(`No preloaded data found for station ${stationCode}`);
    return;
  }

  appState.selectedStation  = stationCode;
  appState.stationRoutes    = stationObj.routes;
  appState.stationStops     = stationObj.stops;
  appState.stationSequences = stationObj.sequences;

  setLevel(2);
}

/* ────────────────────────────────────────────────────────────────────────── */
/* ‑‑‑‑‑‑ Projection helpers ‑‑‑‑‑‑ */

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
    geometry: { type: "Point", coordinates: [s.lng, s.lat] }
  }));
  const geojson = { type: "FeatureCollection", features };

  projection = d3.geoMercator();
  projection.fitExtent([[20, 20], [width - 20, height - 20]], geojson);
}

function fitMapToRouteStops() {
  const mapContainer = d3.select("#mapViewport");
  const width        = mapContainer.node().clientWidth;
  const height       = mapContainer.node().clientHeight;

  const routeStops = appState.stationStops
    .filter(s => s.route_id === appState.selectedRoute);
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

function renderLevel2StationRoutes() {
  if (!zoomGroup || !projection) return;

  const { stationStops, stationSequences, filteredStationRoutes } = appState;

  const stopDict = {};
  for (const s of stationStops) {
    stopDict[s.route_id + "|" + s.stop_id] = s;
  }

  const filteredRouteIDs = new Set(filteredStationRoutes.map(r => r.route_id));
  const filteredSequences = stationSequences.filter(s => filteredRouteIDs.has(s.route_id));
  const seqByRoute = d3.group(filteredSequences, d => d.route_id);

  const routesGroup = zoomGroup.append("g").attr("class", "routes-group");

  for (const [route_id, seqArray] of seqByRoute.entries()) {
    seqArray.sort((a, b) => d3.ascending(a.sequence_order, b.sequence_order));

    const stopsForRoute = seqArray.map(seq => stopDict[seq.route_id + "|" + seq.stop_id])
                                  .filter(d => d);
    if (stopsForRoute.length < 2) continue;

    const routeData = appState.stationRoutes.find(r => r.route_id === route_id);

    const routeGroup = routesGroup.append("g")
      .attr("class", "route-group")
      .attr("data-route-id", route_id)
      .on("mouseover", function () {
        routesGroup.selectAll(".route-group")
        .classed("dimmed", true)
        .classed("route-highlight", false); // Clear old highlights

        d3.select(this)
        .classed("dimmed", false)
        .classed("route-highlight", true); // Apply highlight on hover
        const infoHtml = 
          `<p><strong>Route ID:</strong> ${route_id}</p>
           ${routeData ? 
             `<p>Date: ${routeData.date}</p>
              <p>Departure: ${routeData.departure_time_utc}</p>
              <p>Executor Capacity: ${routeData.executor_capacity_cm3}</p>
              <p>Route Score: ${routeData.route_score}</p>` : ''}
           <p>Total Stops: ${stopsForRoute.length}</p>`;
        setMapMonitorHover(infoHtml);
      })
      .on("mouseout", function () {
        routesGroup.selectAll(".route-group")
        .classed("dimmed", false)
        .classed("route-highlight", false);
        const infoHtml = 
          `<p><strong>Station:</strong> ${appState.selectedStation}</p>
           <p><strong>Total Routes:</strong> ${appState.stationRoutes.length}</p>`;
        setMapMonitorHover("");
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
        .attr("stroke-width", 2)
        .attr("marker-end", "url(#arrowhead)")
    }
    if (coords.length > 2) {
      routeGroup.append("path")
        .datum(coords.slice(1))
        .attr("d", lineGenerator)
        .attr("class", "route-segment")
        .attr("marker-end", "url(#arrowhead)")
    }

    routeGroup.selectAll("circle.stop-point")
      .data(stopsForRoute)
      .enter()
      .append("circle")
      .attr("class", "stop-point")
      .attr("cx", d => projection([d.lng, d.lat])[0])
      .attr("cy", d => projection([d.lng, d.lat])[1])
      .on("mouseover", (event, d) => {
        const infoHtml = 
          `<p><strong>Stop ID:</strong> ${d.stop_id}</p>
           <p>Type: ${d.type}</p>
           <p>Zone: ${d.zone_id}</p>
           <p>Coordinates: (${d.lat.toFixed(4)}, ${d.lng.toFixed(4)})</p>`;
        setMapMonitorHover(infoHtml);
      })
      .on("mouseout", () => {
        const infoHtml = 
          `<p><strong>Route ID:</strong> ${route_id}</p>
           <p>Total Stops: ${stopsForRoute.length}</p>`;
        setMapMonitorHover("");
      });
  }
}

function handleRouteClick(route_id) {
  clearRouteData();
  appState.selectedRoute = route_id;

  const routeStops = appState.stationStops.filter(s => s.route_id === route_id);
  appState.routeStops = routeStops;

  const allPackages = appState.stationData[appState.selectedStation].packages || [];
  const routePackages = allPackages.filter(p => p.route_id === route_id);
  appState.routePackages = routePackages;

  loadRouteTravelTimes(appState.selectedStation, route_id)
    .then(travelTimes => {
      appState.routeTravelTimes = travelTimes;
      setLevel(3);
    })
    .catch(err => {
      console.error("Error loading route travel times:", err);
      appState.routeTravelTimes = null;
      setLevel(3);
    });
}

function renderLevel3Route() {
  if (!zoomGroup) return;

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

  const routeGroup = zoomGroup.append("g")
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
      .attr("class", "level3-link")
      .attr("d", lineGenerator)
      .attr("stroke", linkColor)
      .attr("marker-end", "url(#arrowhead)")
      .on("mouseover", () => {
        const infoHtml = 
          `<p><strong>Link Information</strong></p>
           <p>From Stop: ${fromStop.stop_id} (Type: ${fromStop.type}, Zone: ${fromStop.zone_id})</p>
           <p>To Stop: ${toStop.stop_id} (Type: ${toStop.type}, Zone: ${toStop.zone_id})</p>
           <p>Travel Time (sec): ${travelTime.toFixed(2)}</p>
           <p>Distance (km): ${dist.toFixed(2)}</p>
           <p>Traffic Ratio (sec/km): ${ratio.toFixed(2)}</p>`;
        setMapMonitorHover(infoHtml);
      })
      .on("mouseout", () => {
        setMapMonitorHover("");
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
      const infoHtml = 
        `<p><strong>Stop ID:</strong> ${d.stop_id}</p>
         <p>Coordinates: (${d.lat.toFixed(4)}, ${d.lng.toFixed(4)})</p>
         <p>Avg Service Time (sec): ${avgService.toFixed(2)}</p>
         <p>Package Count: ${pkgs.length}</p>
         ${pkgs.length > 0 ? `<p>Package IDs: ${packagePreview}${pkgs.length > 3 ? '...' : ''}</p>` : ''}`;
      setMapMonitorHover(infoHtml);
    })
    .on("mouseout", () => {
      setMapMonitorHover("");
    });
}

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

function trafficColorScale(ratio) {
  return d3.scaleLinear()
    .domain([0, 300, 600])
    .range(["green", "yellow", "red"])
    .clamp(true)(ratio);
}

function serviceColorScale(avgService) {
  return d3.scaleLinear()
    .domain([0, 60, 300])
    .range(["#ccece6", "#66c2a4", "#238b45"])
    .clamp(true)(avgService);
}

export { initMap, handleRouteClick };