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

// Append a tooltip element to the body (only once)
const tooltip = d3.select("body")
  .append("div")
  .attr("class", "tooltip")
  .style("position", "absolute")
  .style("pointer-events", "none")
  .style("background", "#fff")
  .style("border", "1px solid #ccc")
  .style("padding", "5px")
  .style("opacity", 0)
  .style("font-size", "12px");

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

  // Determine the routes to plot based on the current level.
  let routePoints = [];
  const level = appState.currentLevel;
  if (level === 1) {
    // Level 1: Show all routes across stations.
    routePoints = Object.values(appState.stationData).flatMap(st => st.routes);
  } else if (level === 2) {
    // Level 2: Use the station's filtered routes.
    routePoints = appState.filteredStationRoutes || [];
  } else if (level === 3) {
    // Level 3: Show only the selected route.
    const route = appState.stationRoutes.find(r => r.route_id === appState.selectedRoute);
    routePoints = route ? [route] : [];
  }
  routePoints = routePoints.filter(r =>
    r.total_service_time_sec != null &&
    r.total_transit_time_sec != null
  );

  // If no data is available, show a message.
  if (routePoints.length === 0) {
    svg.append("text")
      .attr("x", width / 2)
      .attr("y", height / 2)
      .attr("text-anchor", "middle")
      .style("font-size", "14px")
      .text("No data available to display.");
    return;
  }

  // Set up x and y scales and axes.
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
    .style("font-size", "12px")
    .text("Total Transit Time");

  svg.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", -margin.left + 15)
    .attr("text-anchor", "middle")
    .style("font-size", "12px")
    .text("Total Service Time");

  svg.append("text")
    .attr("x", width / 2)
    .attr("y", -10)
    .attr("text-anchor", "middle")
    .style("font-size", "14px")
    .style("font-weight", "bold")
    .text("Transit vs. Service Time per Route");

  // Data join for the route dots keyed by route_id.
  const dots = svg.selectAll("circle.route-dot")
    .data(routePoints, d => d.route_id);

  // ENTER: Append new circles with an initial radius of 0 then transition to radius 4.
  const dotsEnter = dots.enter()
    .append("circle")
    .attr("class", "route-dot")
    .attr("cx", d => xScale(d.total_transit_time_sec))
    .attr("cy", d => yScale(d.total_service_time_sec))
    .attr("r", 0)
    .attr("fill", "red")
    .attr("opacity", 0.8)
    .on("mouseover", (event, d) => {
      // Show tooltip with route and station information.
      tooltip.html(`
        <strong>Route ID:</strong> ${d.route_id}<br/>
        <strong>Station:</strong> ${d.station_code || "N/A"}<br/>
        <strong>Departure:</strong> ${d.departure_time_utc}<br/>
        <strong>Score:</strong> ${d.route_score}<br/>
        <strong>Transit Time:</strong> ${formatTime(d.total_transit_time_sec)}<br/>
        <strong>Service Time:</strong> ${formatTime(d.total_service_time_sec)}
      `)
      .style("opacity", 1);

      // Highlight the corresponding map element.
      if (appState.currentLevel === 1) {
        // For level 1 (nation view), highlight the matching station circle.
        d3.select(`circle.station-circle[data-station='${d.station_code}']`)
          .transition().duration(250)
          .attr("stroke", "gold")
          .attr("stroke-width", 3);
      } else if (appState.currentLevel === 2) {
        // For level 2 (station view), highlight the matching route group.
        d3.select(`g.route-group[data-route-id='${d.route_id}']`)
          .transition().duration(250)
          .attr("stroke", "gold")
          .attr("stroke-width", 3);
      }
    })
    .on("mousemove", (event) => {
      tooltip.style("left", (event.pageX + 10) + "px")
             .style("top", (event.pageY + 10) + "px");
    })
    .on("mouseout", (event, d) => {
      tooltip.style("opacity", 0);
      // Remove highlight from the corresponding map element.
      if (appState.currentLevel === 1) {
        d3.select(`circle.station-circle[data-station='${d.station_code}']`)
          .transition().duration(250)
          .attr("stroke", "#333")
          .attr("stroke-width", 1);
      } else if (appState.currentLevel === 2) {
        d3.select(`g.route-group[data-route-id='${d.route_id}']`)
          .transition().duration(250)
          .attr("stroke", "black")
          .attr("stroke-width", 2);
      }
    })
    .transition()
    .duration(1000)
    .attr("r", 4);

  // UPDATE: Transition any existing circles to new positions if needed.
  dots.transition()
    .duration(1000)
    .attr("cx", d => xScale(d.total_transit_time_sec))
    .attr("cy", d => yScale(d.total_service_time_sec));

  // EXIT: Transition circles that no longer exist to radius 0 before removal.
  dots.exit()
    .transition()
    .duration(1000)
    .attr("r", 0)
    .remove();
}

// Expose the renderScatterPlot function globally.
window.renderScatterPlot = renderScatterPlot;
