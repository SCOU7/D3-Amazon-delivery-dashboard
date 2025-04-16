// scripts/scatterPlot.js

function formatTime(seconds) {
  seconds = Math.round(seconds);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatTimeShort(seconds) {
  seconds = Math.round(seconds);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m % 60 === 0 ? `${h}h` : `${h}h ${m % 60}m`;
}

// Append a tooltip element (only once).
const tooltip = d3.select("body")
  .append("div")
  .attr("class", "tooltip")

function renderScatterPlot() {
  const container = d3.select("#scatterPlot");
  container.selectAll("svg").remove();

  const margin = { top: 40, right: 30, bottom: 50, left: 60 };
  const width = container.node().clientWidth - margin.left - margin.right;
  const height = container.node().clientHeight - margin.top - margin.bottom;

  const svg = container.append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Determine routes based on current level.
  let routePoints = [];
  const level = appState.currentLevel;
  if (level === 1) {
    // Level 1: All routes across stations.
    routePoints = Object.values(appState.stationData).flatMap(st => st.routes);
  } else if (level === 2) {
    // Level 2: Only the filtered routes for the selected station.
    routePoints = appState.filteredStationRoutes || [];
  } else if (level === 3) {
    // Level 3: Only the selected route.
    const route = appState.stationRoutes.find(r => r.route_id === appState.selectedRoute);
    routePoints = route ? [route] : [];
  }
  // Filter out routes missing transit or service time data.
  routePoints = routePoints.filter(r =>
    r.total_service_time_sec != null &&
    r.total_transit_time_sec != null
  );

  if (routePoints.length === 0) {
    svg.append("text")
      .attr("x", width / 2)
      .attr("y", height / 2)
      .attr("text-anchor", "middle")
      .style("font-size", "14px")
      .text("No data available to display.");
    return;
  }

  // Set up scales and axes.
  const xScale = d3.scaleLinear()
    .domain(d3.extent(routePoints, d => d.total_transit_time_sec))
    .nice()
    .range([0, width]);
  const yScale = d3.scaleLinear()
    .domain(d3.extent(routePoints, d => d.total_service_time_sec))
    .nice()
    .range([height, 0]);

  const xMin = Math.floor(xScale.domain()[0] / 1800) * 1800;
  const xMax = Math.ceil(xScale.domain()[1] / 1800) * 1800;
  const yMin = Math.floor(yScale.domain()[0] / 1800) * 1800;
  const yMax = Math.ceil(yScale.domain()[1] / 1800) * 1800;
  const xTicks = d3.range(xMin, xMax + 1, 1800);
  const yTicks = d3.range(yMin, yMax + 1, 1800);

  svg.append("g")
    .attr("transform", `translate(0, ${height})`)
    .call(d3.axisBottom(xScale).tickValues(xTicks).tickFormat(formatTimeShort));
  svg.append("g")
    .call(d3.axisLeft(yScale).tickValues(yTicks).tickFormat(formatTimeShort));

  svg.append("text")
    .attr("x", width / 2)
    .attr("y", height + margin.bottom - 10)
    .attr("text-anchor", "middle")
    .text("Total Transit Time")
    .attr("class", "axis-label")
  svg.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", -margin.left + 15)
    .attr("text-anchor", "middle")
    .text("Total Service Time")
    .attr("class", "axis-label")
  svg.append("text")
    .attr("x", width / 2)
    .attr("y", -10)
    .attr("text-anchor", "middle")
    .attr("class", "plot-title")
    .style("font-weight", "bold")
    .text("Transit vs. Service Time per Route")

  // Data join for dots (using route_id as key).
  const dots = svg.selectAll("circle.route-dot")
    .data(routePoints, d => d.route_id);

  // ENTER: Append new circles with an initial radius of 0, then transition to radius 4.
  dots.enter()
    .append("circle")
    .attr("class", "route-dot")
    .attr("cx", d => xScale(d.total_transit_time_sec))
    .attr("cy", d => yScale(d.total_service_time_sec))
    .attr("class", "route-dot")
    .attr("r", 0) // keep r animated
    .on("mouseover", (event, d) => {
      console.log("[scatterPlot] Mouseover on route", d.route_id, "station", d.station_code);
      tooltip.html(`
        <strong>Route ID:</strong> ${d.route_id}<br/>
        <strong>Station:</strong> ${d.station_code || "N/A"}<br/>
        <strong>Departure:</strong> ${d.departure_time_utc}<br/>
        <strong>Score:</strong> ${d.route_score}<br/>
        <strong>Transit Time:</strong> ${formatTime(d.total_transit_time_sec)}<br/>
        <strong>Service Time:</strong> ${formatTime(d.total_service_time_sec)}
      `)
      .style("opacity", 1);

      if (appState.currentLevel === 1) {
        // In Level 1: Find and highlight the matching station circle.
        const sel = d3.select(`circle.station-circle[data-station='${d.station_code}']`);
        if (sel.empty()) {
          console.log("[scatterPlot] Cannot find station element for:", d.station_code);
        } else {
          console.log("[scatterPlot] Found station element for:", d.station_code);
          // Add a CSS class for highlighting.
          sel.classed("station-highlight", true);
        }
      } else if (appState.currentLevel === 2) {
        // In Level 2: Dim all route groups then remove dimming from the linked one.
        d3.selectAll("g.route-group").classed("dimmed", true);
        const target = d3.select(`g.route-group[data-route-id='${d.route_id}']`);
        if (target.empty()) {
          console.log("[scatterPlot] Cannot find route group for route:", d.route_id);
        } else {
          console.log("[scatterPlot] Found route group for route:", d.route_id);
          target.classed("dimmed", false).classed("route-highlight", true);
        }
      }
    })
    .on("mousemove", (event) => {
      tooltip.style("left", (event.pageX + 10) + "px")
             .style("top", (event.pageY + 10) + "px");
    })
    .on("mouseout", (event, d) => {
      console.log("[scatterPlot] Mouseout on route", d.route_id);
      tooltip.style("opacity", 0);
      if (appState.currentLevel === 1) {
        d3.select(`circle.station-circle[data-station='${d.station_code}']`)
          .classed("station-highlight", false);
      } else if (appState.currentLevel === 2) {
        d3.selectAll("g.route-group").classed("dimmed", false).classed("route-highlight", false);
      }
    })
    .transition()
    .duration(1000)
    .attr("r", 4);

  // UPDATE: Transition positions for existing dots.
  dots.transition()
    .duration(1000)
    .attr("cx", d => xScale(d.total_transit_time_sec))
    .attr("cy", d => yScale(d.total_service_time_sec));

  // EXIT: Transition and remove dots that are no longer needed.
  dots.exit()
    .transition()
    .duration(1000)
    .attr("r", 0)
    .remove();
}

// Expose the renderScatterPlot function globally.
window.renderScatterPlot = renderScatterPlot;
